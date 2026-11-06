import { prisma } from "../../db/prisma.js";

// The one place the monthly allowance numbers live; a paid entitlement raises them later.
export const MONTHLY_ALLOWANCE = 15;
export const REDUCED_ALLOWANCE = 5;

export type Usage = { allowance: number; used: number };

/** UTC calendar month, `YYYY-MM`. */
export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** First instant of the next UTC month. */
export function resetsAt(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export async function getUsage(identityHash: string, month = currentMonth()): Promise<Usage | null> {
  const row = await prisma.chatUsage.findUnique({
    where: { identityHash_month: { identityHash, month } },
  });
  return row ? { allowance: row.allowance, used: row.used } : null;
}

let purgedMonth: string | null = null;

/** Rows from earlier months only exist to stop a quota reset; drop them once the month turns. */
export async function purgeOldUsage(month = currentMonth()): Promise<void> {
  if (purgedMonth === month) return;
  purgedMonth = month;
  try {
    await prisma.chatUsage.deleteMany({ where: { month: { lt: month } } });
  } catch (err) {
    purgedMonth = null; // housekeeping only: retry on a later request, never fail the chat
    console.error("chat_usage_purge_failed", (err as Error)?.name);
  }
}

/** Creates this month's row on first use, asking `decide` for the allowance only then. */
export async function ensureAllowance(
  identityHash: string,
  decide: () => Promise<number>,
  month = currentMonth(),
): Promise<void> {
  if (await getUsage(identityHash, month)) return;
  const allowance = await decide();
  // skipDuplicates is INSERT ... ON CONFLICT DO NOTHING: a racing first request keeps its row.
  await prisma.chatUsage.createMany({ data: { identityHash, month, allowance }, skipDuplicates: true });
  await purgeOldUsage(month);
}

/** One atomic statement, so two concurrent requests can never both pass the allowance. */
export async function claimMessage(identityHash: string, month = currentMonth()): Promise<Usage | null> {
  const rows = await prisma.$queryRaw<Usage[]>`
    UPDATE chat_usage SET used = used + 1
    WHERE identity_hash = ${identityHash} AND month = ${month} AND used < allowance
    RETURNING allowance, used`;
  return rows[0] ?? null;
}

/** Pass the month the claim was made in, so a refund near midnight UTC lands in the right row. */
export async function refundMessage(identityHash: string, month = currentMonth()): Promise<void> {
  await prisma.$executeRaw`
    UPDATE chat_usage SET used = GREATEST(used - 1, 0)
    WHERE identity_hash = ${identityHash} AND month = ${month}`;
}
