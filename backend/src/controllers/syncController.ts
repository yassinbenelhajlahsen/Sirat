import type { Request, Response } from "express";
import { syncDomains } from "../services/syncService.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import type { SyncPayload } from "../types/sync.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validate(body: unknown): SyncPayload | { error: string } {
  if (!isPlainObject(body)) return { error: "Request body must be a JSON object" };
  if ("prayer_log" in body && !isPlainObject(body.prayer_log)) {
    return { error: "prayer_log must be an object" };
  }
  if ("habit_log" in body && !isPlainObject(body.habit_log)) {
    return { error: "habit_log must be an object" };
  }
  if ("settings" in body && !isPlainObject(body.settings)) {
    return { error: "settings must be an object" };
  }
  if ("habits" in body && !Array.isArray(body.habits)) {
    return { error: "habits must be an array" };
  }
  return body as SyncPayload;
}

export async function postSync(req: Request, res: Response) {
  const validated = validate(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }
  try {
    const userId = (req as AuthedRequest).userId as string;
    const merged = await syncDomains(userId, validated);
    return res.json(merged);
  } catch (err) {
    console.error("sync_failed", err);
    return res.status(500).json({ error: "Sync failed" });
  }
}
