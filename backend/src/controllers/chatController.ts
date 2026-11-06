import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { ENV } from "../config/env.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { answerMessage } from "../services/chat/answer.js";
import { decideAllowance } from "../services/chat/deviceCheck.js";
import { getIdentityHash } from "../services/chat/identity.js";
import type { HistoryItem } from "../services/chat/prompt.js";
import {
  MONTHLY_ALLOWANCE,
  claimMessage,
  currentMonth,
  ensureAllowance,
  getUsage,
  refundMessage,
  resetsAt,
} from "../services/chat/quota.js";

// Chat text never reaches a log: errors are logged by name only, responses use fixed strings,
// and nothing here calls next(err), because the global error handler logs the whole error.

const MAX_MESSAGE = 1000;
const MAX_HISTORY = 20;
const MAX_USER_TEXT = 1000;
const MAX_ASSISTANT_TEXT = 4000;
const MAX_SUMMARY = 1500;
const MAX_DEVICE_TOKEN = 4096;

// One deadline for the whole reply (two moderations, up to 4 model rounds, a quote retry),
// kept under the phone's request timeout so a reply nobody sees is refunded, not kept.
const REPLY_DEADLINE_MS = 45_000;

const INVALID = { error: "Invalid chat request" };
const FAILED = { error: "Chat failed, please try again" };

export type ChatRequest = { message: string; history: HistoryItem[]; summary: string | null; deviceToken: string | null };

export const DEV_USER_ID = "dev";
export const DEV_ALLOWANCE = 9999;

/** Local-only: needs CHAT_DEV_BYPASS=1 on the server (refused in production) and this header. */
export function isDevChatRequest(req: Request): boolean {
  return ENV.CHAT_DEV_BYPASS && req.get("x-sirat-chat-dev") === "1";
}

export function requireChatEnabled(_req: Request, res: Response, next: NextFunction) {
  if (!ENV.CHAT_ENABLED) return res.status(503).json({ error: "Chat is unavailable" });
  return next();
}

/** Body parser errors carry the raw body; answer them here so they never reach the logging error handler. */
export function chatBodyErrors(_err: unknown, _req: Request, res: Response, _next: NextFunction) {
  return res.status(400).json(INVALID);
}

const optionalString = (v: unknown, max: number): string | null | undefined =>
  v === null || v === undefined ? null : typeof v === "string" && v.length <= max ? v : undefined;

function parseChatRequest(body: unknown): ChatRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE) return null;
  if (!Array.isArray(b.history) || b.history.length > MAX_HISTORY) return null;
  const history: HistoryItem[] = [];
  for (const item of b.history) {
    const { role, text } = (item ?? {}) as Record<string, unknown>;
    if (typeof text !== "string") return null;
    if (role === "user" && text.length <= MAX_USER_TEXT) history.push({ role, text });
    else if (role === "assistant" && text.length <= MAX_ASSISTANT_TEXT) history.push({ role, text });
    else return null;
  }
  const summary = optionalString(b.summary, MAX_SUMMARY);
  const deviceToken = optionalString(b.deviceToken, MAX_DEVICE_TOKEN);
  if (summary === undefined || deviceToken === undefined) return null;
  return { message, history, summary, deviceToken };
}

export function validateChat(req: Request, res: Response, next: NextFunction) {
  const parsed = parseChatRequest(req.body);
  if (!parsed) return res.status(400).json(INVALID);
  req.body = parsed;
  return next();
}

export async function getChatStatus(req: Request, res: Response) {
  const base = { enabled: true, resetsAt: resetsAt() };
  if (isDevChatRequest(req)) return res.json({ ...base, allowance: DEV_ALLOWANCE, remaining: DEV_ALLOWANCE });
  const { isAuthenticated, userId } = getAuth(req);
  if (!isAuthenticated || !userId) return res.json({ ...base, allowance: null, remaining: null });
  try {
    const usage = await getUsage(await getIdentityHash(userId));
    const allowance = usage?.allowance ?? MONTHLY_ALLOWANCE;
    return res.json({ ...base, allowance, remaining: Math.max(allowance - (usage?.used ?? 0), 0) });
  } catch (err) {
    console.error("chat_status_failed", (err as Error)?.name);
    return res.status(502).json(FAILED);
  }
}

// shortcut: in-process, so "one reply in progress per user" holds per instance only; move to a shared store if the backend runs >1 instance
const inFlight = new Set<string>();

export async function postChat(req: Request, res: Response) {
  const userId = (req as AuthedRequest).userId!;
  if (inFlight.has(userId)) return res.status(409).json({ error: "busy" });
  inFlight.add(userId);

  const { message, history, summary, deviceToken } = req.body as ChatRequest;
  const hangUp = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) hangUp.abort();
  });
  const signal = AbortSignal.any([AbortSignal.timeout(REPLY_DEADLINE_MS), hangUp.signal]);
  const month = currentMonth();
  const reset = resetsAt();
  const dev = isDevChatRequest(req);
  let claimedBy: string | null = null;

  try {
    const hash = dev ? DEV_USER_ID : await getIdentityHash(userId);
    let quota: { allowance: number; remaining: number; resetsAt: string };
    if (dev) {
      quota = { allowance: DEV_ALLOWANCE, remaining: DEV_ALLOWANCE, resetsAt: reset };
    } else {
      await ensureAllowance(hash, () => decideAllowance(deviceToken), month);
      const usage = await claimMessage(hash, month);
      if (!usage) {
        const current = await getUsage(hash, month);
        console.log("chat_reply", "limit");
        return res.json({ kind: "limit", allowance: current?.allowance ?? MONTHLY_ALLOWANCE, remaining: 0, resetsAt: reset });
      }
      claimedBy = hash;
      quota = { allowance: usage.allowance, remaining: usage.allowance - usage.used, resetsAt: reset };
    }

    const outcome = await answerMessage({ message, history, summary, safetyId: hash, signal });
    if (outcome.kind !== "answer") {
      // Crisis and blocked replies don't count toward the month; only a crisis reply skipped the model.
      const refunded = dev ? false : await refundMessage(hash, month, outcome.kind === "blocked");
      claimedBy = null;
      console.log("chat_reply", outcome.kind);
      return res.json({ kind: outcome.kind, ...quota, remaining: quota.remaining + (refunded ? 1 : 0) });
    }

    claimedBy = null;
    console.log("chat_reply", "answer", { citations: outcome.citations.length, ruling: outcome.isRuling });
    return res.json({
      kind: "answer",
      answer: outcome.answer,
      citations: outcome.citations,
      scholarLink: outcome.scholarLink,
      summary: outcome.summary,
      ...quota,
    });
  } catch (err) {
    if (claimedBy) {
      // Users don't pay for our failures.
      await refundMessage(claimedBy, month, true).catch((e) => console.error("chat_refund_failed", (e as Error)?.name));
    }
    const e = err as Error;
    console.error("chat_failed", e?.name, e?.message === "chat_model_failed" ? "model" : "other");
    return res.status(502).json(FAILED);
  } finally {
    inFlight.delete(userId);
  }
}
