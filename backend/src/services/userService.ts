import { pool } from "../db/pool.js";
import { clerkClient } from "@clerk/express";
import { addContact } from "./contactService.js";

export async function ensureUser(userId: string): Promise<void> {
  const inserted = await pool.query<{ email: string | null; name: string | null }>(
    `INSERT INTO users (id) VALUES ($1)
     ON CONFLICT (id) DO NOTHING
     RETURNING email, name`,
    [userId],
  );

  let needsProfile: boolean;
  let hadEmail = false;
  if (inserted.rows.length > 0) {
    needsProfile = true; // brand-new row, name/email are null
  } else {
    const existing = await pool.query<{ email: string | null; name: string | null }>(
      `SELECT email, name FROM users WHERE id = $1`,
      [userId],
    );
    const row = existing.rows[0];
    needsProfile = !row || !row.email || !row.name;
    hadEmail = Boolean(row?.email);
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
    // Before the save: if this fails the email stays null, so the next sync retries it.
    // shortcut: a later email change isn't copied to the mailing list, add a Clerk webhook if that matters.
    if (email && !hadEmail) {
      await addContact({ email, firstName: user.firstName, lastName: user.lastName });
    }
    // COALESCE so we never overwrite an existing value with null.
    await pool.query(
      `UPDATE users SET email = COALESCE($2, email), name = COALESCE($3, name) WHERE id = $1`,
      [userId, email, name],
    );
  } catch (err) {
    // Best-effort: leave nulls; retried on the next sync. Never break the sync path.
    console.error("ensure_user_profile_failed", (err as Error)?.message);
  }
}
