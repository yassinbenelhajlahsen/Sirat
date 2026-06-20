export type Migration = { name: string; sql: string };

// Migrations are inline SQL strings (not .sql files) so `tsc` compiles them
// into dist/ without a separate copy step. Append new entries; never edit
// an already-shipped migration.
export const MIGRATIONS: Migration[] = [
  {
    name: "001_init",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS sync_documents (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        doc JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, domain)
      );
    `,
  },
];
