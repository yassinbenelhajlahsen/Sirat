import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { createFeedbackReport, type FeedbackInput } from "../services/feedbackService.js";
import { sendFeedbackEmail } from "../services/emailService.js";

const MAX_MESSAGE = 4000;
const MAX_EMAIL = 254;
const MAX_DIAGNOSTICS_CHARS = 200_000;
const MAX_DEVICE = 128;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Validated = Pick<FeedbackInput, "type" | "message" | "email"> & {
  diagnostics: Record<string, unknown> | null;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validate(body: unknown): Validated | { error: string } {
  if (!isPlainObject(body)) return { error: "Request body must be a JSON object" };
  const { type, message, email, diagnostics } = body;
  if (type !== "feedback" && type !== "bug") return { error: "type must be feedback or bug" };
  if (typeof message !== "string") return { error: "message is required" };
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE) {
    return { error: `message must be 1 to ${MAX_MESSAGE} characters` };
  }
  let cleanEmail: string | null = null;
  if (email !== undefined && email !== null && email !== "") {
    if (typeof email !== "string") return { error: "email must be a string" };
    cleanEmail = email.trim();
    if (cleanEmail.length > MAX_EMAIL || !EMAIL_SHAPE.test(cleanEmail)) {
      return { error: "email is not valid" };
    }
  }
  // Diagnostics belong to bug reports only; anything sent with feedback is dropped.
  let cleanDiagnostics: Record<string, unknown> | null = null;
  if (type === "bug" && diagnostics !== undefined && diagnostics !== null) {
    if (!isPlainObject(diagnostics)) return { error: "diagnostics must be an object" };
    // Extreme nesting makes JSON.stringify throw; an async handler's throw would kill the process.
    let size: number;
    try {
      size = JSON.stringify(diagnostics).length;
    } catch {
      return { error: "diagnostics not valid" };
    }
    if (size > MAX_DIAGNOSTICS_CHARS) return { error: "diagnostics too large" };
    cleanDiagnostics = diagnostics;
  }
  return { type, message: trimmed, email: cleanEmail, diagnostics: cleanDiagnostics };
}

function deviceLabel(diagnostics: Record<string, unknown> | null): string | null {
  const context = diagnostics?.context;
  if (!isPlainObject(context)) return null;
  const { deviceModel, os, osVersion } = context;
  if (typeof deviceModel !== "string") return null;
  const system = [os, osVersion].filter((v) => typeof v === "string" && v).join(" ");
  return (system ? `${deviceModel} (${system})` : deviceModel).slice(0, MAX_DEVICE);
}

// Sign-in is optional here: any auth failure just means an anonymous report.
export function optionalUserId(req: Request): string | null {
  try {
    const { isAuthenticated, userId } = getAuth(req);
    return isAuthenticated && userId ? userId : null;
  } catch {
    return null;
  }
}

export function header(req: Request, name: string): string | null {
  const value = req.header(name);
  return value ? value.slice(0, 64) : null;
}

export async function postFeedback(req: Request, res: Response) {
  const validated = validate(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }
  const isBug = validated.type === "bug";
  try {
    const report = await createFeedbackReport({
      ...validated,
      userId: optionalUserId(req),
      appVersion: header(req, "x-sirat-app-version"),
      platform: isBug ? header(req, "x-sirat-platform") : null,
      device: isBug ? deviceLabel(validated.diagnostics) : null,
    });
    await sendFeedbackEmail(report).catch((err) => console.error("feedback_email_failed", err));
    return res.status(201).json({ id: report.id });
  } catch (err) {
    // Name and code only: Prisma's messages can echo the report text.
    const { name, code } = err as { name?: string; code?: string };
    console.error("feedback_save_failed", name, code);
    return res.status(500).json({ error: "Could not save feedback" });
  }
}
