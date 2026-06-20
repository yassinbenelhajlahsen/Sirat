import { pool } from "./pool.js";
import { MIGRATIONS, type Migration } from "./migrations.js";

export interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}

export async function runMigrations(
  db: Queryable,
  migrations: Migration[] = MIGRATIONS,
): Promise<string[]> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await db.query(`SELECT name FROM _migrations`);
  const applied = new Set(rows.map((r) => r.name as string));

  const ran: string[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    await db.query("BEGIN");
    try {
      await db.query(migration.sql);
      await db.query(`INSERT INTO _migrations (name) VALUES ($1)`, [migration.name]);
      await db.query("COMMIT");
      ran.push(migration.name);
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  }
  return ran;
}

// CLI entry point: `npm run migrate`
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  runMigrations(pool)
    .then((ran) => {
      console.log(`Applied migrations: ${ran.join(", ") || "none"}`);
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
