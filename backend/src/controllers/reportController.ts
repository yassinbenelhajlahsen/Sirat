import type { Request, Response } from "express";
import { createContentReport } from "../services/reportService.js";
import { header, optionalUserId } from "./feedbackController.js";

const MAX_INPUT = 2000;

type Output = Record<string, unknown>;

function isPlainObject(v: unknown): v is Output {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// One entry per reportable kind; each keeps only the fields it knows, so the client can't store arbitrary JSON.
const MAX_CHAT_ANSWER = 4000;
const MAX_CHAT_CITATIONS = 6;
const CITATION_ID = /^(q:\d{1,3}:\d{1,3}|h:\d+|d:\d+)$/;

const OUTPUT_SHAPES: Record<string, (output: Output) => Output | null> = {
  dua: ({ duaId }) => (Number.isInteger(duaId) && (duaId as number) > 0 ? { duaId } : null),
  // The answer is stored exactly as shown, so a reviewer sees what the user saw.
  chat: ({ answer, citationIds }) =>
    typeof answer === "string" && answer.length >= 1 && answer.length <= MAX_CHAT_ANSWER &&
    Array.isArray(citationIds) && citationIds.length <= MAX_CHAT_CITATIONS &&
    citationIds.every((id) => typeof id === "string" && CITATION_ID.test(id))
      ? { answer, citationIds }
      : null,
};

function validate(body: unknown) {
  if (!isPlainObject(body)) return { error: "Request body must be a JSON object" };
  const { kind, input, output } = body;
  const shape = typeof kind === "string" && Object.prototype.hasOwnProperty.call(OUTPUT_SHAPES, kind) ? OUTPUT_SHAPES[kind] : null;
  if (!shape) return { error: "unknown kind" };
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed || trimmed.length > MAX_INPUT) return { error: `input must be 1 to ${MAX_INPUT} characters` };
  const cleanOutput = isPlainObject(output) ? shape(output) : null;
  if (!cleanOutput) return { error: "output not valid" };
  return { kind: kind as string, input: trimmed, output: cleanOutput };
}

export async function postReport(req: Request, res: Response) {
  const validated = validate(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }
  try {
    const report = await createContentReport({
      ...validated,
      userId: optionalUserId(req),
      appVersion: header(req, "x-sirat-app-version"),
    });
    return res.status(201).json({ id: report.id });
  } catch (err) {
    // Name and code only: Prisma's messages can echo what the user typed.
    const { name, code } = err as { name?: string; code?: string };
    console.error("report_save_failed", name, code);
    return res.status(500).json({ error: "Could not save report" });
  }
}
