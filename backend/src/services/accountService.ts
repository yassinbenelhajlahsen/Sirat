import { pool } from "../db/pool.js";
import { prisma } from "../db/prisma.js";
import { clerkClient } from "@clerk/express";
import { removeContact } from "./contactService.js";

// Best-effort: a mailing list outage must not stop someone deleting their account.
async function removeFromMailingList(userId: string): Promise<void> {
  try {
    const user = await clerkClient.users.getUser(userId);
    await Promise.all(user.emailAddresses.map((e) => removeContact(e.emailAddress)));
  } catch (err) {
    console.error("contact_remove_failed", (err as Error)?.name);
  }
}

/**
 * Deletes all of a user's synced data (users row cascades to sync_documents)
 * and their feedback reports, takes them off the mailing list, then removes the Clerk identity. A Clerk 404 means the identity was already
 * gone — treated as success so the call is idempotent.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await removeFromMailingList(userId);
  await prisma.feedbackReport.deleteMany({ where: { userId } });
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  try {
    await clerkClient.users.deleteUser(userId);
  } catch (err: unknown) {
    if ((err as { status?: number })?.status === 404) return;
    throw err;
  }
}
