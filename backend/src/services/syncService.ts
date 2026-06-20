import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { ensureUser } from "./userService.js";
import {
  mergeHabitLogs,
  mergeHabits,
  mergePrayerLogs,
  mergeSettings,
} from "../utils/syncMerge.js";
import { SYNC_DOMAINS } from "../types/sync.js";
import type { SyncDomain, SyncPayload, SyncResponse } from "../types/sync.js";

function emptyDoc(domain: SyncDomain): unknown {
  return domain === "habits" ? [] : {};
}

function mergeDomain(domain: SyncDomain, stored: any, incoming: any): unknown {
  switch (domain) {
    case "prayer_log":
      return mergePrayerLogs(stored, incoming);
    case "habit_log":
      return mergeHabitLogs(stored, incoming);
    case "habits":
      return mergeHabits(stored, incoming);
    case "settings":
      return mergeSettings(stored, incoming);
  }
}

async function readDoc(client: PoolClient, userId: string, domain: SyncDomain): Promise<unknown> {
  const { rows } = await client.query(
    `SELECT doc FROM sync_documents WHERE user_id = $1 AND domain = $2 FOR UPDATE`,
    [userId, domain],
  );
  return rows.length ? rows[0].doc : emptyDoc(domain);
}

async function writeDoc(
  client: PoolClient,
  userId: string,
  domain: SyncDomain,
  doc: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO sync_documents (user_id, domain, doc, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, domain)
     DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
    [userId, domain, JSON.stringify(doc)],
  );
}

export async function syncDomains(userId: string, payload: SyncPayload): Promise<SyncResponse> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureUser(client, userId);

    const merged: Record<string, unknown> = {};
    const incomingByDomain = payload as Record<string, unknown>;
    for (const domain of SYNC_DOMAINS) {
      const incoming = incomingByDomain[domain] ?? emptyDoc(domain);
      const stored = await readDoc(client, userId, domain);
      const result = mergeDomain(domain, stored, incoming);
      await writeDoc(client, userId, domain, result);
      merged[domain] = result;
    }

    await client.query("COMMIT");
    return { ...(merged as Omit<SyncResponse, "syncedAt">), syncedAt: new Date().toISOString() };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
