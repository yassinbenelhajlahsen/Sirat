import { pool } from "../db/pool.js";
import { prisma } from "../db/prisma.js";
import { clerkClient } from "@clerk/express";

/**
 * Deletes all of a user's synced data (users row cascades to sync_documents)
 * and their feedback reports, then removes the Clerk identity. A Clerk 404 means the identity was already
 * gone — treated as success so the call is idempotent.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await prisma.feedbackReport.deleteMany({ where: { userId } });
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  try {
    await clerkClient.users.deleteUser(userId);
  } catch (err: unknown) {
    if ((err as { status?: number })?.status === 404) return;
    throw err;
  }
}
