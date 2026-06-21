# Backend Prisma Migrate Adoption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled SQL migration runner with Prisma Migrate and stand up a generated Prisma Client for future use, without rewriting the existing raw `pg` query layer or changing any runtime behavior.

**Architecture:** Add `prisma/schema.prisma` mirroring the live 2-table schema, baseline the existing schema as an already-applied migration (so production is adopted, not recreated), retire the custom runner, and expose a lazy `PrismaClient` singleton that new feature tables will use going forward. The existing 4 raw `pg` services (including the `FOR UPDATE` sync transaction) stay byte-for-byte.

**Tech Stack:** Node ESM (`"type":"module"`, `module: ES2020`, `moduleResolution: node`), TypeScript 5, Express 4, `pg` 8, Prisma 6, Jest via `ts-jest/presets/default-esm`, Railway + Postgres.

## Global Constraints

- All backend commands run from `backend/`. Paths below are relative to `backend/` unless absolute.
- Backend is **ESM**: every relative import uses an explicit `.js` extension; Jest maps `.js` → source via `moduleNameMapper`.
- **Zero runtime behavior change.** The 4 existing raw `pg` services and their tests must remain untouched and green: `src/services/syncService.ts`, `src/services/userService.ts`, `src/services/accountService.ts`, `src/db/pool.ts`.
- The generated Prisma Client uses the **default output** (`node_modules/.prisma/client`, re-exported by `@prisma/client`) — already covered by the `node_modules` gitignore. Do not configure a custom `output`.
- `new PrismaClient()` is **lazy**: it opens no DB connection until the first query. Importing the singleton is therefore connection-free and safe at module load.
- Migration **content correctness** requires a real Postgres and is verified by explicit manual ops steps. CI-runnable gates are offline: `npx prisma validate`, `npx prisma generate`, `npm run build`, `npm test`, `npm run lint`.
- Never edit an already-applied/shipped migration. Append new ones.
- Migrations directory ordering is lexicographic by folder name: `0_init` before `1_drop_legacy_migrations`.
- Existing live schema (source of truth the baseline must reproduce):
  - `users (id TEXT PK, email TEXT, name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  - `sync_documents (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, domain TEXT NOT NULL, doc JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, domain))`

---

### Task 1: Install Prisma, author `schema.prisma`, wire generate into build/install

**Files:**
- Modify: `backend/package.json` (deps + `build`/`postinstall` scripts)
- Create: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a valid Prisma datamodel with models `User` and `SyncDocument`, mapped to tables `users` / `sync_documents`; a generated `@prisma/client` available to later tasks.

- [ ] **Step 1: Install Prisma packages**

Run (from `backend/`):
```bash
npm install --save-dev prisma@^6
npm install @prisma/client@^6
```
Expected: `prisma` appears under `devDependencies`, `@prisma/client` under `dependencies` in `backend/package.json`.

- [ ] **Step 2: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id
  email         String?
  name          String?
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  syncDocuments SyncDocument[]

  @@map("users")
}

model SyncDocument {
  userId    String   @map("user_id")
  domain    String
  doc       Json     @default("{}")
  updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, domain])
  @@map("sync_documents")
}
```

Note: Prisma's Postgres `Json` type maps to `jsonb` by default — this matches the existing `doc JSONB` column. `@db.Timestamptz(6)` reproduces `TIMESTAMPTZ` (6 is Postgres's default precision).

- [ ] **Step 3: Validate the schema (offline, no DB)**

Run:
```bash
npx prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Generate the client (offline, no DB connection)**

Run:
```bash
npx prisma generate
```
Expected: `Generated Prisma Client (...) to ./node_modules/@prisma/client`. No DATABASE_URL needed (generate does not connect).

- [ ] **Step 5: Wire generate into `build` and `postinstall`**

In `backend/package.json` `scripts`, change `build` and add `postinstall`:
```json
"build": "prisma generate && tsc",
"postinstall": "prisma generate"
```
Rationale: `postinstall` guarantees `@prisma/client` exists after `npm install` on CI/Railway (so `npm test` and builds can import it); `build` regenerates before compile.

- [ ] **Step 6: Verify build and existing tests still pass**

Run:
```bash
npm run build && npm test
```
Expected: build succeeds; all existing suites pass (no behavior changed yet — the old runner is still in place).

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/prisma/schema.prisma
git commit -m "feat(backend): add Prisma schema mirroring live sync schema"
```

---

### Task 2: Baseline migration `0_init` from the datamodel

**Files:**
- Create: `backend/prisma/migrations/migration_lock.toml`
- Create: `backend/prisma/migrations/0_init/migration.sql`

**Interfaces:**
- Consumes: `prisma/schema.prisma` from Task 1.
- Produces: a baseline migration whose SQL reproduces the current schema; recorded as already-applied on existing databases via a manual ops step.

- [ ] **Step 1: Create the migration lock file**

Create `backend/prisma/migrations/migration_lock.toml`:
```toml
# Please do not edit this file manually
# It should be added in your version-control system (e.g. Git)
provider = "postgresql"
```

- [ ] **Step 2: Generate the baseline SQL from the datamodel (offline)**

Run (from `backend/`):
```bash
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```
This diff is fully offline (empty → datamodel; no DB replay).

- [ ] **Step 3: Inspect the generated SQL**

Open `backend/prisma/migrations/0_init/migration.sql`. Expected: it contains `CREATE TABLE "users" (...)`, `CREATE TABLE "sync_documents" (...)`, the composite primary key on `("user_id","domain")`, and the foreign key `sync_documents.user_id → users.id ON DELETE CASCADE`. Confirm column types: `TEXT`, `TIMESTAMPTZ`, `JSONB`, with `created_at`/`updated_at` defaulting to `CURRENT_TIMESTAMP`/`now()` and `doc` defaulting to `'{}'`.

- [ ] **Step 4: Verify the schema is syntactically intact**

Run:
```bash
npx prisma validate
```
Expected: schema valid (the migration files do not affect `validate`, but this confirms nothing was disturbed).

- [ ] **Step 5: MANUAL OPS — adopt existing databases (requires DB access)**

For every database that already has the schema (your local dev DB, then Railway production), mark the baseline as applied **without running it**:
```bash
# DATABASE_URL must point at the existing DB
npx prisma migrate resolve --applied 0_init
npx prisma migrate status
```
Expected: `migrate status` reports `Database schema is up to date!` and lists `0_init` as applied. **Do not run `migrate deploy` on an existing DB before this resolve** — it would attempt to recreate existing tables and fail.

> If no local Postgres is available to the executor, record this step as pending and hand it to whoever runs the Railway deploy; it is a one-time action per environment.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/migrations
git commit -m "feat(backend): baseline 0_init Prisma migration for existing schema"
```

---

### Task 3: Drop the legacy `_migrations` table via a follow-up migration

**Files:**
- Create: `backend/prisma/migrations/1_drop_legacy_migrations/migration.sql`

**Interfaces:**
- Consumes: the Prisma migration system from Task 2.
- Produces: a migration that removes the dead `_migrations` table on all environments; no-op on fresh DBs.

- [ ] **Step 1: Create the drop migration**

Create `backend/prisma/migrations/1_drop_legacy_migrations/migration.sql`:
```sql
-- The custom SQL runner's bookkeeping table is replaced by Prisma's
-- _prisma_migrations. Drop the orphan. No-op on fresh databases.
DROP TABLE IF EXISTS "_migrations";
```

Why a separate migration (not part of `0_init`): `0_init` is marked `--applied` (skipped) on existing DBs, so a DROP placed there would never execute on production. As its own migration, `migrate deploy` runs it everywhere.

- [ ] **Step 2: Validate**

Run:
```bash
npx prisma validate
```
Expected: schema valid.

- [ ] **Step 3: MANUAL OPS — apply on existing databases (requires DB access)**

On each existing DB (local, then production) that already resolved `0_init` in Task 2:
```bash
npx prisma migrate deploy
npx prisma migrate status
```
Expected: `1_drop_legacy_migrations` is applied; `migrate status` clean. Confirm the table is gone:
```bash
psql "$DATABASE_URL" -c "\dt _migrations"
```
Expected: `Did not find any relation named "_migrations".`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/migrations
git commit -m "feat(backend): drop legacy _migrations table"
```

---

### Task 4: Lazy `PrismaClient` singleton + structural test

**Files:**
- Create: `backend/src/db/prisma.ts`
- Test: `backend/__tests__/prismaClient.test.ts`

**Interfaces:**
- Consumes: generated `@prisma/client` from Task 1.
- Produces: `export const prisma: PrismaClient` — a process-wide singleton, hot-reload safe, used by future feature code. No queries run at import.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/prismaClient.test.ts`:
```ts
import { describe, expect, it } from "@jest/globals";
import { prisma } from "../src/db/prisma.js";

describe("prisma singleton", () => {
  it("exports a PrismaClient with query/lifecycle methods", () => {
    expect(typeof prisma.$queryRaw).toBe("function");
    expect(typeof prisma.$connect).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
  });

  it("returns the same instance on repeated import", async () => {
    const again = (await import("../src/db/prisma.js")).prisma;
    expect(again).toBe(prisma);
  });
});
```
This test never queries, so it needs no database — it proves the client generated and imports under ESM.

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test -- --testPathPatterns prismaClient
```
Expected: FAIL — `Cannot find module '../src/db/prisma.js'`.

- [ ] **Step 3: Implement the singleton**

Create `backend/src/db/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";

// A single PrismaClient per process. `tsx watch` reloads modules in dev, so
// stash the instance on globalThis to avoid leaking connections across reloads.
// `new PrismaClient()` is lazy: no DB connection is opened until the first query.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test -- --testPathPatterns prismaClient
```
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/prisma.ts backend/__tests__/prismaClient.test.ts
git commit -m "feat(backend): add lazy PrismaClient singleton"
```

---

### Task 5: Retire the custom runner and repoint deploy

**Files:**
- Delete: `backend/src/db/migrate.ts`
- Delete: `backend/src/db/migrations.ts`
- Delete: `backend/__tests__/migrate.test.ts`
- Modify: `backend/package.json` (`migrate` + `start` scripts)

**Interfaces:**
- Consumes: the Prisma migration system (Tasks 2–3).
- Produces: `npm run migrate` runs `prisma migrate deploy`; app boot applies pending migrations before starting.

- [ ] **Step 1: Confirm nothing imports the runner**

Run:
```bash
grep -rn "db/migrate\|db/migrations\|runMigrations\|MIGRATIONS" src __tests__
```
Expected: matches only inside the three files being deleted. (Verified at plan time: `syncService`/`userService`/`accountService` use `db/pool.js`, not the runner.)

- [ ] **Step 2: Delete the custom runner and its test**

Run:
```bash
git rm src/db/migrate.ts src/db/migrations.ts __tests__/migrate.test.ts
```

- [ ] **Step 3: Repoint the `migrate` and `start` scripts**

In `backend/package.json` `scripts`, set:
```json
"start": "prisma migrate deploy && node dist/index.js",
"migrate": "prisma migrate deploy"
```
`migrate deploy` is idempotent, so chaining it into `start` is safe on every boot (Prisma takes an advisory lock, so concurrent instances serialize).

- [ ] **Step 4: Add a `migrate:dev` authoring script**

In the same `scripts` block, add:
```json
"migrate:dev": "prisma migrate dev"
```
Used only to author new migrations locally; it needs a shadow database (see Task 6).

- [ ] **Step 5: Verify build and the full suite are green**

Run:
```bash
npm run build && npm test && npm run lint
```
Expected: build succeeds, all suites pass (the deleted `migrate.test.ts` is gone), lint clean.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json
git commit -m "refactor(backend): replace custom migration runner with prisma migrate deploy"
```

---

### Task 6: Config, env example, and docs

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.ts`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documented env + workflow so a fresh engineer can run migrations and understand the raw-pg/Prisma boundary.

- [ ] **Step 1: Add DB/Prisma env to `backend/.env.example`**

Append to `backend/.env.example`:
```bash
# Database (Postgres). Required for account & sync endpoints and Prisma.
# In production include sslmode, e.g. ...railway.../db?sslmode=require
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sirat

# Only needed for `npm run migrate:dev` if your local Postgres role cannot
# CREATE DATABASE (Prisma auto-creates a shadow DB otherwise). Not used in prod.
SHADOW_DATABASE_URL=

# Clerk (auth). Backend verifies JWTs and performs admin account deletion.
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
```

- [ ] **Step 2: Add `SHADOW_DATABASE_URL` to the env object**

In `backend/src/config/env.ts`, add inside the `ENV` object (after `DATABASE_URL`):
```ts
  SHADOW_DATABASE_URL: process.env.SHADOW_DATABASE_URL || "",
```
(No warning block needed — it is optional and dev-only.)

- [ ] **Step 3: Verify the env change compiles and tests pass**

Run:
```bash
npm run build && npm test
```
Expected: green.

- [ ] **Step 4: Document the migration workflow and boundary in `AGENTS.md`**

In `AGENTS.md`, under the Backend section (near the env/commands area), add:
```markdown
- Database migrations: Prisma Migrate. Schema in `backend/prisma/schema.prisma`;
  migrations in `backend/prisma/migrations/`. Apply with `npm run migrate`
  (`prisma migrate deploy`); author new ones with `npm run migrate:dev`.
  `start` runs `prisma migrate deploy` before boot.
- DB query boundary: existing tables (`users`, `sync_documents`) are queried with
  raw `pg` via `src/db/pool.ts` (incl. the `FOR UPDATE` sync transaction). New
  feature tables use the Prisma Client singleton in `src/db/prisma.ts`.
```

- [ ] **Step 5: Document the boundary in `CLAUDE.md`**

In `CLAUDE.md`, under the Backend patterns area, add one line:
```markdown
- **Migrations:** Prisma Migrate (`prisma/schema.prisma`, `prisma/migrations/`); `npm run migrate` = `prisma migrate deploy`, chained into `start`. Existing `users`/`sync_documents` queries stay raw `pg` (`src/db/pool.ts`); new tables use the `PrismaClient` singleton (`src/db/prisma.ts`). When the Prisma client starts serving request-path queries, cap its pool with a `?connection_limit=` URL param so it plus the raw `pg` pool stay under Railway's Postgres connection limit.
```

- [ ] **Step 6: Confirm migrations are tracked by git (not ignored)**

Run:
```bash
git check-ignore backend/prisma/migrations/0_init/migration.sql; echo "exit=$?"
```
Expected: `exit=1` (not ignored). If ignored, add `!backend/prisma/migrations/` un-ignore rule.

- [ ] **Step 7: Final full verification**

Run:
```bash
npm run build && npm test && npm run lint
```
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add backend/.env.example backend/src/config/env.ts AGENTS.md CLAUDE.md
git commit -m "docs(backend): document Prisma migration workflow and query boundary"
```

---

## Manual integration verification (run once, with a real Postgres)

These prove migration correctness end-to-end (CI cannot, lacking a DB). Run after Task 6, before relying on the change in production.

- [ ] **Fresh-DB path:** create an empty throwaway database, point `DATABASE_URL` at it, run `npx prisma migrate deploy`, then confirm `npx prisma migrate status` is clean and `\d users` / `\d sync_documents` match the schema in Global Constraints. Run the app against it and exercise `POST /api/sync` once to confirm behavior is unchanged.
- [ ] **Existing-DB path (production rehearsal):** against a clone of prod (already on the old `_migrations` runner), run `npx prisma migrate resolve --applied 0_init`, then `npx prisma migrate deploy` (applies only `1_drop_legacy_migrations`), then `npx prisma migrate status` (clean) and confirm `_migrations` is gone and `sync_documents` data is intact.
- [ ] **ESM smoke:** with `DATABASE_URL` set, run a one-off `prisma.$queryRaw\`SELECT 1 as ok\`` (via `tsx`) to confirm the client connects and runs under ESM at runtime, not just in the structural test.

---

## Self-Review

**Spec coverage** (against `2026-06-20-backend-prisma-migrations-design.md`):
- Schema adoption / baseline, resolve-as-applied → Task 2. ✓
- Retire custom runner, `_migrations` drop as separate migration → Tasks 3, 5. ✓
- Scripts/deploy (`migrate deploy`, `build` generate, `start` chain) → Tasks 1, 5. ✓
- Client coexistence (`pool.ts` kept, `prisma.ts` added, raw services untouched) → Tasks 4, 5 (delete only runner), Global Constraints. ✓
- Deferred: no Prisma queries written; future test strategy not chosen → respected (Task 4 is structural-only). ✓
- Risks: ESM verified (Task 4 + manual smoke), SSL (.env.example note Task 6), shadow DB (Tasks 5–6), drift/`migrate status` (manual steps), build needs client (`postinstall`, Task 1), connection_limit (CLAUDE.md note, Task 6). ✓

**Placeholder scan:** every code/SQL/script step contains literal content; no TBD/TODO. Manual DB steps are explicitly flagged as ops actions with exact commands and expected output. ✓

**Type/name consistency:** `prisma` singleton name and `@prisma/client` import match across Task 4 and docs; script names (`migrate`, `migrate:dev`, `start`, `build`, `postinstall`) consistent across Tasks 1, 5, 6; migration folder names (`0_init`, `1_drop_legacy_migrations`) consistent across Tasks 2, 3, 6, and manual verification. ✓
