import type { NextFunction, Request, Response } from "express";
import { deletePushToken, EXPO_PUSH_TOKEN, savePushToken } from "../services/pushService.js";
import { header } from "./feedbackController.js";

const INVALID = { error: "token not valid" };

function tokenOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { token } = body as { token?: unknown };
  return typeof token === "string" && EXPO_PUSH_TOKEN.test(token) ? token : null;
}

/** Body parser errors carry the raw body (a token); answer them here so they never reach the logging error handler. */
export function pushBodyErrors(_err: unknown, _req: Request, res: Response, _next: NextFunction) {
  return res.status(400).json(INVALID);
}

export async function postRegister(req: Request, res: Response) {
  const token = tokenOf(req.body);
  if (!token) return res.status(400).json(INVALID);
  try {
    await savePushToken(token, header(req, "x-sirat-app-version"));
    return res.json({ ok: true });
  } catch (err) {
    // Name and code only: Prisma's messages can echo the token.
    const { name, code } = err as { name?: string; code?: string };
    console.error("push_register_failed", name, code);
    return res.status(500).json({ error: "Could not save token" });
  }
}

export async function postUnregister(req: Request, res: Response) {
  const token = tokenOf(req.body);
  if (!token) return res.status(400).json(INVALID);
  try {
    await deletePushToken(token);
    return res.json({ ok: true });
  } catch (err) {
    const { name, code } = err as { name?: string; code?: string };
    console.error("push_unregister_failed", name, code);
    return res.status(500).json({ error: "Could not delete token" });
  }
}
