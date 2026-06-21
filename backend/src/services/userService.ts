import { pool } from "../db/pool.js";
import { clerkClient } from "@clerk/express";

export async function ensureUser(userId: string): Promise<void> {
  const inserted = await pool.query<{ email: string | null; name: string | null }>(
    `INSERT INTO users (id) VALUES ($1)
     ON CONFLICT (id) DO NOTHING
     RETURNING email, name`,
    [userId],
  );

  let needsProfile: boolean;
  if (inserted.rows.length > 0) {
    needsProfile = true; // brand-new row, name/email are null
  } else {
    const existing = await pool.query<{ email: string | null; name: string | null }>(
      `SELECT email, name FROM users WHERE id = $1`,
      [userId],
    );
    const row = existing.rows[0];
    needsProfile = !row || !row.email || !row.name;
  }
  if (!needsProfile) return;

  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
    // COALESCE so we never overwrite an existing value with null.
    await pool.query(
      `UPDATE users SET email = COALESCE($2, email), name = COALESCE($3, name) WHERE id = $1`,
      [userId, email, name],
    );
  } catch {
    // Best-effort: leave nulls; retried on the next sync. Never break the sync path.
  }
}
