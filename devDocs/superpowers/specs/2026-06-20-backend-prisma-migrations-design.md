# Backend: Adopt Prisma Migrate (gradual query adoption) — Design

**Date:** 2026-06-20
**Status:** Approved (brainstorming) — pending implementation plan
**Branch context:** `feat/auth` (builds on the user-accounts & cloud-sync backend, Phase 1)
**Relates to:** `devDocs/superpowers/specs/2026-06-19-user-accounts-cloud-sync-design.md`

## Goal

Replace the hand-rolled SQL migration runner with **Prisma Migrate**, and stand
up a generated **Prisma Client** ready for use — *without* rewriting the existing
raw `pg` query layer. This is a tooling/foundation change with **zero runtime
behavior change**.

## Drivers (confirmed)

1. **Future schema growth.** The backend is the identity foundation for future
   server-backed features; more tables/relations are expected. Adopting Prisma
   now — while only two tables exist — is the cheapest moment to do it.
2. **Better migrations.** The current inline-SQL runner has no down-migrations,
   no drift detection, and no diffing. Prisma Migrate provides declarative
   schema, auto-diffed SQL, drift detection, and a shadow-DB workflow.

Query type-safety was explicitly **not** a primary driver, which is why the
existing raw queries stay as-is and Prisma Client is adopted gradually.

## Current state (what exists today)

- **Schema:** 2 tables — `users` (id/email/name/created_at) and `sync_documents`
  (user_id/domain/doc JSONB/updated_at, PK `(user_id, domain)`). Max ~4 rows per
  user. Essentially frozen for the sync feature.
- **Migrations:** custom runner in `src/db/migrate.ts` + inline SQL in
  `src/db/migrations.ts`, tracked in a `_migrations` table, transactional, run
  via `npm run migrate` (`tsx src/db/migrate.ts`). Tested by
  `__tests__/migrate.test.ts`.
- **Query layer:** 4 small services using raw parameterized `pg`
  (`syncService.ts`, `userService.ts`, `accountService.ts`, plus `db/pool.ts`).
  The only non-trivial query is the sync transaction:
  `SELECT … FOR UPDATE` + JSONB upsert inside `BEGIN/COMMIT`.
- **Stack:** full ESM (`"type": "module"`, `module: ES2020`,
  `moduleResolution: node`, `esModuleInterop: true`). Jest via
  `ts-jest/presets/default-esm` with `NODE_OPTIONS=--experimental-vm-modules`.
  Existing DB tests mock the `pg` client and string-match SQL.
- **Deploy:** Railway, Nixpacks auto-detect (`npm run build` → `npm start`). No
  in-repo Railway/Nixpacks/Procfile config. `DATABASE_URL` already wired through
  `src/config/env.ts`. Raw pool sets SSL via an `ssl` object in prod.

## Chosen approach: C — Prisma toolchain now, gradual query adoption

Rejected alternatives:

- **A — SQL-first migration tool (`node-pg-migrate`/`dbmate`), keep raw queries.**
  Satisfies driver 2 only. Every future table is still hand-written raw SQL with
  no typed client — under-serves driver 1.
- **B — Full Prisma rewrite (migrations + all queries + test rewrite).** Rewrites
  4 working services and their pg-mock tests; the `FOR UPDATE` sync transaction
  drops to `$queryRaw` anyway. Full cost, little marginal benefit on a frozen
  2-table schema.

C answers both drivers: Prisma Migrate for migrations (driver 2), typed client
ready the moment the schema grows (driver 1), and **no speculative rewrite** of
working code today. The usual "migrations-only" anti-pattern (maintaining
`schema.prisma` while never using the client) does not apply here *because* the
client will be used for new tables — incrementally, not retroactively.

## Design

### 1. Schema adoption — baseline, do not recreate

- Add `prisma/schema.prisma` with a `datasource db { provider = "postgresql";
  url = env("DATABASE_URL") }`, a Prisma-client generator block, and `User` +
  `SyncDocument` models matching the **live** schema exactly. Seed it via
  `prisma db pull` against a migrated DB, then hand-tidy names/attributes
  (`@@map("sync_documents")`, composite `@@id([userId, domain])`, etc.).
- Generate the baseline migration as `prisma/migrations/0_init/migration.sql`
  using `prisma migrate diff --from-empty
  --to-schema-datamodel prisma/schema.prisma --script`.
- For **already-migrated databases** (production, existing local), run
  `prisma migrate resolve --applied 0_init` so Prisma records the baseline as
  applied **without executing it**. Fresh databases apply `0_init` normally via
  `migrate deploy`.

### 2. Retire the custom runner

- Delete `src/db/migrate.ts`, `src/db/migrations.ts`, and
  `__tests__/migrate.test.ts`.
- Add a **second** migration `prisma/migrations/1_drop_legacy_migrations/migration.sql`
  containing `DROP TABLE IF EXISTS _migrations;`. This runs via `migrate deploy`
  on all environments (cleaning prod) and is a harmless no-op on fresh DBs.
  > It must be a separate migration, **not** part of `0_init`: `0_init` is marked
  > `--applied` (skipped) on existing DBs, so a DROP placed there would never run
  > on production.
- Prisma tracks state in its own `_prisma_migrations` table.

### 3. Scripts & deploy

- `migrate` → `prisma migrate deploy` (idempotent; used manually and at boot).
- `migrate:dev` → `prisma migrate dev` (authoring new migrations; needs a local
  shadow DB).
- `build` → `prisma generate && tsc` (client generated during Railway build;
  `generate` needs no DB connection).
- `start` → `prisma migrate deploy && node dist/index.js` (chosen: chain into
  start; no Railway dashboard config needed; `migrate deploy` is idempotent so
  re-running per boot is safe).

### 4. Client coexistence (the deliberate boundary)

- Keep `src/db/pool.ts` (raw `pg` Pool). The 4 existing services stay
  **byte-for-byte**, including the `FOR UPDATE` sync transaction. Their pg-mock
  tests are untouched.
- Add `src/db/prisma.ts` exporting a singleton `PrismaClient` (guarded against
  hot-reload duplication in `dev`).
- **New tables/features query through Prisma Client.** Existing working queries
  are not migrated.
- Two connection mechanisms share Railway's Postgres connection cap: set Prisma's
  `connection_limit` modestly (e.g. via `?connection_limit=` on the Prisma URL or
  datasource config) so the raw pool + Prisma pool don't exhaust connections.

### 5. Deferred — explicitly out of scope

- **No Prisma queries are written in this change.** No new tables exist yet, so
  the change is tooling + boundary only.
- The **test strategy for future Prisma-backed code** (PGlite vs.
  Testcontainers/real Postgres vs. mocked client) is decided when the first
  Prisma query lands — not now. Existing raw-query tests keep their pg-mock
  pattern.

## Risks / verify during implementation

- **ESM compatibility.** Prisma Client under `"type": "module"` + ts-jest ESM
  preset. `moduleResolution: node` + `esModuleInterop: true` is the friendlier
  combo, but verify `import { PrismaClient } from "@prisma/client"` both compiles
  and **runs in one real test** before relying on it. If needed, pin the
  generator `output`/module settings for ESM.
- **SSL on Railway.** The raw pool uses an `ssl` object; Prisma reads SSL from
  the connection string. Ensure prod `DATABASE_URL` carries `?sslmode=require`
  (or equivalent) so **both** clients connect. Confirm local dev (no SSL) still
  works for both.
- **Local shadow DB.** `prisma migrate dev` requires a shadow database; Prisma
  auto-creates one if the local role can `CREATE DATABASE`, otherwise a
  `shadowDatabaseUrl` must be provided. Production uses `migrate deploy` (no
  shadow needed).
- **Drift check.** After baseline, `prisma migrate status` must report a clean,
  in-sync state against production.
- **Build needs the client.** Anything importing `@prisma/client` fails to build
  until `prisma generate` has run; keep `generate` first in the `build` script
  and ensure CI runs it.

## Success criteria

- `prisma migrate status` reports in-sync against a DB created the old way (no
  re-run of `0_init`, `_migrations` dropped).
- A fresh empty DB reaches the identical schema via `prisma migrate deploy`
  alone.
- `npm run build`, `npm test`, `npm run lint`, and app boot all pass; existing
  sync/account behavior and tests are unchanged.
- `src/db/prisma.ts` exports a working `PrismaClient`, proven by one test that
  imports and uses it (read against `_prisma_migrations` or a trivial query).

## Out of scope

- Rewriting any existing raw query (incl. the sync transaction).
- Notification-preference sync, new feature tables, or any schema growth — those
  arrive in their own specs and will use Prisma Client.
- Frontend changes (none).
