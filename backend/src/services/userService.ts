import type { PoolClient } from "pg";

// Phase 1 upserts the Clerk user id only. email/name columns stay null until a
// later feature needs them.
export async function ensureUser(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [userId],
  );
}
