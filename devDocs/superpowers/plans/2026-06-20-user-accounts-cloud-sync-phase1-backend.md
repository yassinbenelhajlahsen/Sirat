# User Accounts & Cloud Sync — Phase 1 (Backend Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stateful backend (Postgres on Railway) with Clerk-verified auth and a `POST /api/sync` endpoint that server-side LWW-merges a user's tracker + settings documents, plus `DELETE /api/account`.

**Architecture:** Extend the existing ESM Express app (`backend/`). New layers: a `pg` connection pool + migration runner; a `requireAuth` middleware that verifies Clerk session JWTs (`@clerk/express`); ported `Cell` last-write-wins merge functions; a transactional `syncService` that reads each domain doc `FOR UPDATE`, merges, and writes it back; thin controllers/routes following the existing routes→controllers→services→utils pattern. This is approach **C** from the design spec (JSONB-per-domain, server-side merge in a transaction).

**Tech Stack:** TypeScript (ESM, `"type": "module"`), Express 4, `pg`, `@clerk/express`, `express-rate-limit`, Jest + `ts-jest` ESM preset, `supertest`.

**Spec:** `devDocs/superpowers/specs/2026-06-19-user-accounts-cloud-sync-design.md`

## Global Constraints

- **Run all commands from `backend/`.** The backend resolves paths via `process.cwd()`.
- **ESM source:** every relative import MUST end in `.js` (e.g. `import { ENV } from "../config/env.js"`), even though the file is `.ts`. This is required by the `ts-jest` ESM preset + `tsc` config.
- **Tests live in `backend/__tests__/**/*.test.ts`** and run with `npm test` (`NODE_OPTIONS=--experimental-vm-modules jest`).
- **ESM module mocking:** use `jest.resetModules()` + `jest.unstable_mockModule("<path>.js", factory)` BEFORE a dynamic `await import("<path>.js")`. Static `import` of the module-under-test does NOT pick up the mock — follow the existing `duaRoutes.test.ts` pattern.
- **All config goes through the `ENV` object** in `src/config/env.ts` — never read `process.env` directly elsewhere.
- **Production strips error detail:** never return raw error messages to clients in handlers; return a fixed string and `console.error` the detail (matches `errorHandler.ts` + `duaController.ts`).
- **Per-route rate limiting** via `express-rate-limit`, matching `routes/dua.ts`.
- **Merge tie-break rule (server):** an incoming cell/habit replaces the stored one **iff `incoming.updatedAt > stored.updatedAt`** (stored wins ties). The ported merge functions keep argument `a` on ties, so always call them as `merge(stored, incoming)`.
- **Console output is suppressed in tests** via `__tests__/setup.ts` — do not assert on console output.

---

### Task 1: Database layer — pool, schema migration, runner

**Files:**
- Modify: `backend/package.json` (deps + `migrate` script)
- Modify: `backend/src/config/env.ts`
- Create: `backend/src/db/pool.ts`
- Create: `backend/src/db/migrations.ts`
- Create: `backend/src/db/migrate.ts`
- Test: `backend/__tests__/migrate.test.ts`

**Interfaces:**
- Produces: `pool` (a `pg.Pool`) from `src/db/pool.js`.
- Produces: `MIGRATIONS: Migration[]` and `type Migration = { name: string; sql: string }` from `src/db/migrations.js`.
- Produces: `runMigrations(db: Queryable, migrations?: Migration[]): Promise<string[]>` from `src/db/migrate.js`, where `Queryable = { query(text: string, params?: unknown[]): Promise<{ rows: any[] }> }`. Returns the names of migrations applied this run.
- Produces (DB schema): `users(id TEXT PK, email TEXT, name TEXT, created_at TIMESTAMPTZ)` and `sync_documents(user_id TEXT FK→users ON DELETE CASCADE, domain TEXT, doc JSONB, updated_at TIMESTAMPTZ, PK(user_id, domain))`.

- [ ] **Step 1: Install dependencies**

Run (from `backend/`):
```bash
npm install pg @clerk/express
npm install -D @types/pg
```
Expected: `package.json` gains `pg` + `@clerk/express` under dependencies and `@types/pg` under devDependencies.

- [ ] **Step 2: Add the `migrate` npm script**

In `backend/package.json`, add to `"scripts"` (after `"start"`):
```json
"migrate": "tsx src/db/migrate.ts",
```

- [ ] **Step 3: Extend `ENV` with DB + Clerk config**

In `backend/src/config/env.ts`, add these keys inside the `ENV` object (after `ENFORCE_MIN_VERSION`):
```ts
  DATABASE_URL: process.env.DATABASE_URL || "",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
```
And add these warnings after the existing `if (!ENV.OPENAI_API_KEY)` block:
```ts
if (!ENV.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL is not set. Account & sync endpoints will fail.");
}

if (!ENV.CLERK_SECRET_KEY) {
  console.warn("⚠️  CLERK_SECRET_KEY is not set. Auth verification will fail.");
}
```

- [ ] **Step 4: Write the connection pool**

Create `backend/src/db/pool.ts`:
```ts
import pg from "pg";
import { ENV } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  // Railway Postgres requires SSL in production; local dev does not.
  ssl: ENV.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});
```

- [ ] **Step 5: Write the migration definitions**

Create `backend/src/db/migrations.ts`:
```ts
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
```

- [ ] **Step 6: Write the failing test for the runner**

Create `backend/__tests__/migrate.test.ts`:
```ts
import { afterEach, describe, expect, it, jest } from "@jest/globals";

describe("runMigrations", () => {
  afterEach(() => jest.resetModules());

  function fakeDb(appliedNames: string[]) {
    const calls: { text: string; params?: unknown[] }[] = [];
    const db = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        calls.push({ text, params });
        if (text.includes("SELECT name FROM _migrations")) {
          return { rows: appliedNames.map((name) => ({ name })) };
        }
        return { rows: [] };
      }),
    };
    return { db, calls };
  }

  it("applies a pending migration and records it", async () => {
    const { runMigrations } = await import("../src/db/migrate.js");
    const { db, calls } = fakeDb([]);

    const ran = await runMigrations(db as any);

    expect(ran).toEqual(["001_init"]);
    expect(calls.some((c) => c.text.includes("CREATE TABLE IF NOT EXISTS _migrations"))).toBe(true);
    expect(calls.some((c) => c.text.includes("INSERT INTO _migrations") && c.params?.[0] === "001_init")).toBe(true);
    expect(calls.some((c) => c.text === "COMMIT")).toBe(true);
  });

  it("skips a migration that is already applied", async () => {
    const { runMigrations } = await import("../src/db/migrate.js");
    const { db, calls } = fakeDb(["001_init"]);

    const ran = await runMigrations(db as any);

    expect(ran).toEqual([]);
    expect(calls.some((c) => c.text.includes("INSERT INTO _migrations"))).toBe(false);
  });

  it("rolls back when a migration throws", async () => {
    const { runMigrations } = await import("../src/db/migrate.js");
    const calls: string[] = [];
    const db = {
      query: jest.fn(async (text: string) => {
        calls.push(text);
        if (text.includes("SELECT name FROM _migrations")) return { rows: [] };
        if (text.includes("CREATE TABLE IF NOT EXISTS users")) throw new Error("boom");
        return { rows: [] };
      }),
    };

    await expect(runMigrations(db as any)).rejects.toThrow("boom");
    expect(calls).toContain("ROLLBACK");
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm test -- migrate`
Expected: FAIL — cannot find module `../src/db/migrate.js`.

- [ ] **Step 8: Write the migration runner**

Create `backend/src/db/migrate.ts`:
```ts
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
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test -- migrate`
Expected: PASS (3 tests).

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/config/env.ts src/db/ __tests__/migrate.test.ts
git commit -m "feat(backend): add Postgres pool, schema migrations, and runner"
```

---

### Task 2: Sync domain types + ported LWW merge functions

**Files:**
- Create: `backend/src/types/sync.ts`
- Create: `backend/src/utils/syncMerge.ts`
- Test: `backend/__tests__/syncMerge.test.ts`

**Interfaces:**
- Produces (types from `src/types/sync.js`): `Cell<T>`, `PrayerName`, `PrayerStatus`, `PrayerLog`, `HabitFrequency`, `HabitReminder`, `Habit`, `HabitLog`, `SettingsEnvelope`, `SyncPayload`, `SyncResponse`, `SyncDomain`, and `SYNC_DOMAINS: readonly SyncDomain[]`.
- Produces (functions from `src/utils/syncMerge.js`): `mergePrayerLogs(local, remote)`, `mergeHabitLogs(local, remote)`, `mergeHabits(local, remote)`, `mergeSettings(local, remote)` — each returning the merged value. All keep argument `a` (the first/`local` arg) on `updatedAt` ties.

- [ ] **Step 1: Write the types**

Create `backend/src/types/sync.ts`:
```ts
/** A synced value plus a last-modified stamp (epoch-ms) for LWW conflict resolution. */
export type Cell<T> = { value: T; updatedAt: number };

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export type PrayerStatus = "prayed" | "late" | "missed";

/** dateKey ("YYYY-MM-DD") -> prayer -> status cell. */
export type PrayerLog = Record<string, Partial<Record<PrayerName, Cell<PrayerStatus>>>>;

export type HabitFrequency = { type: "daily" } | { type: "weekly"; days: number[] };
export type HabitReminder = { enabled: boolean; time?: string };

export type Habit = {
  id: string;
  name: string;
  icon: string;
  frequency: HabitFrequency;
  reminder?: HabitReminder;
  order: number;
  archived: boolean;
  createdAtKey: string;
  updatedAt: number;
  deletedAt?: number;
};

/** dateKey -> habitId -> done cell. */
export type HabitLog = Record<string, Record<string, Cell<boolean>>>;

/** settingKey -> stamped value. */
export type SettingsEnvelope = Record<string, Cell<unknown>>;

export const SYNC_DOMAINS = ["prayer_log", "habits", "habit_log", "settings"] as const;
export type SyncDomain = (typeof SYNC_DOMAINS)[number];

export type SyncPayload = {
  prayer_log?: PrayerLog;
  habits?: Habit[];
  habit_log?: HabitLog;
  settings?: SettingsEnvelope;
};

export type SyncResponse = {
  prayer_log: PrayerLog;
  habits: Habit[];
  habit_log: HabitLog;
  settings: SettingsEnvelope;
  syncedAt: string;
};
```

- [ ] **Step 2: Write the failing test (ported merge vector + settings)**

Create `backend/__tests__/syncMerge.test.ts`:
```ts
import { describe, expect, it } from "@jest/globals";
import {
  mergeHabitLogs,
  mergeHabits,
  mergePrayerLogs,
  mergeSettings,
} from "../src/utils/syncMerge.js";
import type { Habit } from "../src/types/sync.js";

describe("syncMerge", () => {
  it("mergePrayerLogs keeps the higher updatedAt per cell", () => {
    const stored = { "2026-06-19": { fajr: { value: "prayed" as const, updatedAt: 10 } } };
    const incoming = {
      "2026-06-19": {
        fajr: { value: "late" as const, updatedAt: 20 },
        dhuhr: { value: "prayed" as const, updatedAt: 5 },
      },
    };
    expect(mergePrayerLogs(stored, incoming)).toEqual({
      "2026-06-19": {
        fajr: { value: "late", updatedAt: 20 },
        dhuhr: { value: "prayed", updatedAt: 5 },
      },
    });
  });

  it("mergePrayerLogs on equal updatedAt keeps the first arg (stored)", () => {
    const stored = { "2026-06-19": { fajr: { value: "prayed" as const, updatedAt: 10 } } };
    const incoming = { "2026-06-19": { fajr: { value: "late" as const, updatedAt: 10 } } };
    expect(mergePrayerLogs(stored, incoming)["2026-06-19"].fajr).toEqual({
      value: "prayed",
      updatedAt: 10,
    });
  });

  it("mergeHabitLogs keeps the higher updatedAt per cell", () => {
    const stored = { "2026-06-19": { h1: { value: true, updatedAt: 30 } } };
    const incoming = { "2026-06-19": { h1: { value: false, updatedAt: 10 } } };
    expect(mergeHabitLogs(stored, incoming)).toEqual({
      "2026-06-19": { h1: { value: true, updatedAt: 30 } },
    });
  });

  it("mergeHabits keeps higher updatedAt and retains tombstones", () => {
    const base: Habit = {
      id: "h1", name: "A", icon: "i", frequency: { type: "daily" },
      order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 10,
    };
    const merged = mergeHabits([base], [{ ...base, name: "A2", updatedAt: 20, deletedAt: 20 }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("A2");
    expect(merged[0].deletedAt).toBe(20);
  });

  it("mergeHabits retains a stored-only habit", () => {
    const stored: Habit = {
      id: "h1", name: "Stored Only", icon: "leaf", frequency: { type: "daily" },
      order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 5,
    };
    const merged = mergeHabits([stored], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("h1");
  });

  it("mergeSettings keeps the higher updatedAt per key and unions keys", () => {
    const stored = { theme: { value: "dark", updatedAt: 10 } };
    const incoming = {
      theme: { value: "light", updatedAt: 20 },
      prayerSettings: { value: { method: 2 }, updatedAt: 7 },
    };
    expect(mergeSettings(stored, incoming)).toEqual({
      theme: { value: "light", updatedAt: 20 },
      prayerSettings: { value: { method: 2 }, updatedAt: 7 },
    });
  });

  it("mergeSettings on equal updatedAt keeps the first arg (stored)", () => {
    const stored = { theme: { value: "dark", updatedAt: 10 } };
    const incoming = { theme: { value: "light", updatedAt: 10 } };
    expect(mergeSettings(stored, incoming).theme).toEqual({ value: "dark", updatedAt: 10 });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- syncMerge`
Expected: FAIL — cannot find module `../src/utils/syncMerge.js`.

- [ ] **Step 4: Write the merge functions**

Create `backend/src/utils/syncMerge.ts`:
```ts
import type {
  Cell,
  Habit,
  HabitLog,
  PrayerLog,
  SettingsEnvelope,
} from "../types/sync.js";

// Last-write-wins by updatedAt. On an exact tie, the FIRST argument (`a`) is
// kept. Server calls these as merge(stored, incoming), so stored wins ties —
// an equal-stamped incoming never overwrites it. Ported from
// frontend/services/tracking/merge.ts; keep in sync via the shared test vector.
function pickCell<T>(a: Cell<T> | undefined, b: Cell<T> | undefined): Cell<T> | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

export function mergePrayerLogs(local: PrayerLog, remote: PrayerLog): PrayerLog {
  const out: PrayerLog = {};
  const dateKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const dateKey of dateKeys) {
    const l = local[dateKey] ?? {};
    const r = remote[dateKey] ?? {};
    const prayers = new Set([...Object.keys(l), ...Object.keys(r)]) as Set<keyof typeof l>;
    const day: (typeof out)[string] = {};
    for (const p of prayers) {
      const cell = pickCell(l[p], r[p]);
      if (cell) day[p] = cell;
    }
    out[dateKey] = day;
  }
  return out;
}

export function mergeHabitLogs(local: HabitLog, remote: HabitLog): HabitLog {
  const out: HabitLog = {};
  const dateKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const dateKey of dateKeys) {
    const l = local[dateKey] ?? {};
    const r = remote[dateKey] ?? {};
    const ids = new Set([...Object.keys(l), ...Object.keys(r)]);
    const day: Record<string, Cell<boolean>> = {};
    for (const id of ids) {
      const cell = pickCell(l[id], r[id]);
      if (cell) day[id] = cell;
    }
    out[dateKey] = day;
  }
  return out;
}

export function mergeHabits(local: Habit[], remote: Habit[]): Habit[] {
  const byId = new Map<string, Habit>();
  for (const h of local) byId.set(h.id, h);
  for (const h of remote) {
    const existing = byId.get(h.id);
    if (!existing || h.updatedAt > existing.updatedAt) byId.set(h.id, h);
  }
  return [...byId.values()];
}

export function mergeSettings(local: SettingsEnvelope, remote: SettingsEnvelope): SettingsEnvelope {
  const out: SettingsEnvelope = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    const cell = pickCell(local[k], remote[k]);
    if (cell) out[k] = cell;
  }
  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- syncMerge`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/sync.ts src/utils/syncMerge.ts __tests__/syncMerge.test.ts
git commit -m "feat(backend): add sync domain types and ported LWW merge functions"
```

---

### Task 3: Clerk auth middleware (`requireAuth`)

**Files:**
- Create: `backend/src/middleware/requireAuth.ts`
- Test: `backend/__tests__/requireAuth.test.ts`

**Interfaces:**
- Consumes: `getAuth` from `@clerk/express` (returns `{ isAuthenticated: boolean; userId: string | null }`).
- Produces: `requireAuth(req, res, next)` Express middleware from `src/middleware/requireAuth.js`. On success sets `(req as AuthedRequest).userId = userId` and calls `next()`; otherwise responds `401 { error: "Authentication required" }`.
- Produces: `interface AuthedRequest extends Request { userId?: string }` from the same module.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/requireAuth.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetAuth: jest.Mock = jest.fn();

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("requireAuth", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetAuth.mockReset();
    jest.unstable_mockModule("@clerk/express", () => ({
      getAuth: mockGetAuth,
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      clerkClient: { users: { deleteUser: jest.fn() } },
    }));
  });

  afterEach(() => jest.clearAllMocks());

  it("sets req.userId and calls next when authenticated", async () => {
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    const { requireAuth } = await import("../src/middleware/requireAuth.js");

    const req: any = {};
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.userId).toBe("user_abc");
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 401 when not authenticated", async () => {
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: false, userId: null });
    const { requireAuth } = await import("../src/middleware/requireAuth.js");

    const req: any = {};
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- requireAuth`
Expected: FAIL — cannot find module `../src/middleware/requireAuth.js`.

- [ ] **Step 3: Write the middleware**

Create `backend/src/middleware/requireAuth.ts`:
```ts
import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";

export interface AuthedRequest extends Request {
  userId?: string;
}

/**
 * Verifies the Clerk session attached by `clerkMiddleware()` and stashes the
 * authenticated Clerk user id on the request. Responds 401 when absent.
 * Must run AFTER `clerkMiddleware()` on the same router.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { isAuthenticated, userId } = getAuth(req);
  if (!isAuthenticated || !userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- requireAuth`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/middleware/requireAuth.ts __tests__/requireAuth.test.ts
git commit -m "feat(backend): add Clerk requireAuth middleware"
```

---

### Task 4: Sync service — `ensureUser` + transactional `syncDomains`

**Files:**
- Create: `backend/src/services/userService.ts`
- Create: `backend/src/services/syncService.ts`
- Test: `backend/__tests__/syncService.test.ts`

**Interfaces:**
- Consumes: `pool` from `src/db/pool.js`; merge functions from `src/utils/syncMerge.js`; `SYNC_DOMAINS`, `SyncPayload`, `SyncResponse`, `SyncDomain` from `src/types/sync.js`.
- Produces: `ensureUser(client: PoolClient, userId: string): Promise<void>` from `src/services/userService.js` — upserts the `users` row (`id` only; `email`/`name` left null in Phase 1).
- Produces: `syncDomains(userId: string, payload: SyncPayload): Promise<SyncResponse>` from `src/services/syncService.js` — opens a pooled client, `BEGIN`, ensures the user, for each domain reads its doc `FOR UPDATE`, merges incoming (defaulting to an empty doc) as `merge(stored, incoming)`, writes it back, `COMMIT`, and returns all merged docs plus an ISO `syncedAt`. Rolls back on any error.

- [ ] **Step 1: Write `ensureUser`**

Create `backend/src/services/userService.ts`:
```ts
import type { PoolClient } from "pg";

// Phase 1 upserts the Clerk user id only. email/name columns stay null until a
// later feature needs them.
export async function ensureUser(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [userId],
  );
}
```

- [ ] **Step 2: Write the failing test for `syncDomains`**

Create `backend/__tests__/syncService.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockConnect: jest.Mock = jest.fn();

describe("syncService.syncDomains", () => {
  beforeEach(() => {
    jest.resetModules();
    mockConnect.mockReset();
    jest.unstable_mockModule("../src/db/pool.js", () => ({
      pool: { connect: mockConnect },
    }));
  });

  afterEach(() => jest.clearAllMocks());

  // Builds a fake pooled client. `stored` maps domain -> doc returned by the
  // FOR UPDATE select (absent => empty default).
  function fakeClient(stored: Record<string, unknown>) {
    const writes: { domain: string; doc: unknown }[] = [];
    const log: string[] = [];
    const client = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        log.push(text.trim().split("\n")[0]);
        if (text.includes("SELECT doc FROM sync_documents")) {
          const domain = params![1] as string;
          return domain in stored ? { rows: [{ doc: stored[domain] }] } : { rows: [] };
        }
        if (text.includes("INSERT INTO sync_documents")) {
          writes.push({ domain: params![1] as string, doc: JSON.parse(params![2] as string) });
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    return { client, writes, log };
  }

  it("merges incoming into stored per domain and returns merged docs", async () => {
    const { client, writes } = fakeClient({
      prayer_log: { "2026-06-19": { fajr: { value: "missed", updatedAt: 5 } } },
    });
    (mockConnect as any).mockResolvedValue(client);
    const { syncDomains } = await import("../src/services/syncService.js");

    const result = await syncDomains("user_abc", {
      prayer_log: { "2026-06-19": { fajr: { value: "prayed", updatedAt: 9 } } },
    });

    expect(result.prayer_log["2026-06-19"].fajr).toEqual({ value: "prayed", updatedAt: 9 });
    expect(result.habits).toEqual([]);
    expect(typeof result.syncedAt).toBe("string");
    // prayer_log was written with the merged value
    const prayerWrite = writes.find((w) => w.domain === "prayer_log");
    expect((prayerWrite!.doc as any)["2026-06-19"].fajr.updatedAt).toBe(9);
  });

  it("opens a transaction, ensures the user, commits, and releases", async () => {
    const { client, log } = fakeClient({});
    (mockConnect as any).mockResolvedValue(client);
    const { syncDomains } = await import("../src/services/syncService.js");

    await syncDomains("user_abc", {});

    expect(log).toContain("BEGIN");
    expect(log.some((l) => l.includes("INSERT INTO users"))).toBe(true);
    expect(log).toContain("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back and releases when a query throws", async () => {
    const client = {
      query: jest.fn(async (text: string) => {
        if (text.includes("SELECT doc FROM sync_documents")) throw new Error("db down");
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    (mockConnect as any).mockResolvedValue(client);
    const { syncDomains } = await import("../src/services/syncService.js");

    await expect(syncDomains("user_abc", {})).rejects.toThrow("db down");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- syncService`
Expected: FAIL — cannot find module `../src/services/syncService.js`.

- [ ] **Step 4: Write the sync service**

Create `backend/src/services/syncService.ts`:
```ts
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { ensureUser } from "./userService.js";
import {
  mergeHabitLogs,
  mergeHabits,
  mergePrayerLogs,
  mergeSettings,
} from "../utils/syncMerge.js";
import { SYNC_DOMAINS } from "../types/sync.js";
import type { SyncDomain, SyncPayload, SyncResponse } from "../types/sync.js";

function emptyDoc(domain: SyncDomain): unknown {
  return domain === "habits" ? [] : {};
}

function mergeDomain(domain: SyncDomain, stored: any, incoming: any): unknown {
  switch (domain) {
    case "prayer_log":
      return mergePrayerLogs(stored, incoming);
    case "habit_log":
      return mergeHabitLogs(stored, incoming);
    case "habits":
      return mergeHabits(stored, incoming);
    case "settings":
      return mergeSettings(stored, incoming);
  }
}

async function readDoc(client: PoolClient, userId: string, domain: SyncDomain): Promise<unknown> {
  const { rows } = await client.query(
    `SELECT doc FROM sync_documents WHERE user_id = $1 AND domain = $2 FOR UPDATE`,
    [userId, domain],
  );
  return rows.length ? rows[0].doc : emptyDoc(domain);
}

async function writeDoc(
  client: PoolClient,
  userId: string,
  domain: SyncDomain,
  doc: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO sync_documents (user_id, domain, doc, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, domain)
     DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
    [userId, domain, JSON.stringify(doc)],
  );
}

export async function syncDomains(userId: string, payload: SyncPayload): Promise<SyncResponse> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureUser(client, userId);

    const merged: Record<string, unknown> = {};
    const incomingByDomain = payload as Record<string, unknown>;
    for (const domain of SYNC_DOMAINS) {
      const incoming = incomingByDomain[domain] ?? emptyDoc(domain);
      const stored = await readDoc(client, userId, domain);
      const result = mergeDomain(domain, stored, incoming);
      await writeDoc(client, userId, domain, result);
      merged[domain] = result;
    }

    await client.query("COMMIT");
    return { ...(merged as Omit<SyncResponse, "syncedAt">), syncedAt: new Date().toISOString() };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- syncService`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/services/userService.ts src/services/syncService.ts __tests__/syncService.test.ts
git commit -m "feat(backend): add transactional sync service with per-domain LWW merge"
```

---

### Task 5: `POST /api/sync` — controller, route, and app wiring

**Files:**
- Create: `backend/src/controllers/syncController.ts`
- Create: `backend/src/routes/sync.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/__tests__/syncRoutes.test.ts`

**Interfaces:**
- Consumes: `syncDomains` from `src/services/syncService.js`; `requireAuth` + `AuthedRequest` from `src/middleware/requireAuth.js`; `clerkMiddleware` from `@clerk/express`.
- Produces: `postSync(req, res)` from `src/controllers/syncController.js` — validates the body shape (object; `prayer_log`/`habit_log`/`settings` objects, `habits` array when present), returns `400 { error }` on bad shape, else calls `syncDomains(req.userId, body)` and returns the merged JSON; `500 { error: "Sync failed" }` on service error.
- Produces: default-exported `Router` from `src/routes/sync.js` mounting `express.json({ limit: "1mb" })`, `clerkMiddleware()`, and `POST /` behind a 120/15min limiter + `requireAuth`.
- Modifies app wiring: the global `express.json({ limit: "16kb" })` is replaced by a wrapper that bypasses parsing for `/api/sync` (so the route's own 1MB parser applies); mounts `/api/sync`.

- [ ] **Step 1: Write the controller**

Create `backend/src/controllers/syncController.ts`:
```ts
import type { Request, Response } from "express";
import { syncDomains } from "../services/syncService.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import type { SyncPayload } from "../types/sync.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validate(body: unknown): SyncPayload | { error: string } {
  if (!isPlainObject(body)) return { error: "Request body must be a JSON object" };
  if ("prayer_log" in body && !isPlainObject(body.prayer_log)) {
    return { error: "prayer_log must be an object" };
  }
  if ("habit_log" in body && !isPlainObject(body.habit_log)) {
    return { error: "habit_log must be an object" };
  }
  if ("settings" in body && !isPlainObject(body.settings)) {
    return { error: "settings must be an object" };
  }
  if ("habits" in body && !Array.isArray(body.habits)) {
    return { error: "habits must be an array" };
  }
  return body as SyncPayload;
}

export async function postSync(req: Request, res: Response) {
  const validated = validate(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }
  try {
    const userId = (req as AuthedRequest).userId as string;
    const merged = await syncDomains(userId, validated);
    return res.json(merged);
  } catch (err) {
    console.error("sync_failed", err);
    return res.status(500).json({ error: "Sync failed" });
  }
}
```

- [ ] **Step 2: Write the route**

Create `backend/src/routes/sync.ts`:
```ts
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import { postSync } from "../controllers/syncController.js";

const router = Router();

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});

// Sync payloads carry full logs; allow more than the global 16KB limit.
router.use(express.json({ limit: "1mb" }));
router.use(clerkMiddleware());

/**
 * POST /api/sync
 * Body: { prayer_log?, habits?, habit_log?, settings? }
 * Returns the merged authoritative docs + syncedAt.
 */
router.post("/", syncLimiter, requireAuth, postSync);

export default router;
```

- [ ] **Step 3: Wire into `index.ts`**

In `backend/src/index.ts`:

(a) Add the import alongside the other route imports:
```ts
import syncRoutes from "./routes/sync.js";
```

(b) Replace the global JSON parser line:
```ts
app.use(express.json({ limit: "16kb" }));
```
with a wrapper that bypasses `/api/sync` (which has its own 1MB parser):
```ts
const defaultJsonParser = express.json({ limit: "16kb" });
app.use((req, res, next) => {
  if (req.path.startsWith("/api/sync")) return next();
  return defaultJsonParser(req, res, next);
});
```

(c) Mount the route alongside the others (after `app.use("/api/holidays", holidayRoutes);`):
```ts
app.use("/api/sync", syncRoutes);
```

- [ ] **Step 4: Write the failing integration test**

Create `backend/__tests__/syncRoutes.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const mockGetAuth: jest.Mock = jest.fn();
const mockSyncDomains: jest.Mock = jest.fn();

describe("Sync Routes Integration", () => {
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockGetAuth.mockReset();
    mockSyncDomains.mockReset();
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    (mockSyncDomains as any).mockResolvedValue({
      prayer_log: {}, habits: [], habit_log: {}, settings: {},
      syncedAt: "2026-06-20T00:00:00.000Z",
    });

    jest.unstable_mockModule("@clerk/express", () => ({
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      getAuth: mockGetAuth,
      clerkClient: { users: { deleteUser: jest.fn() } },
    }));
    jest.unstable_mockModule("../src/services/syncService.js", () => ({
      syncDomains: mockSyncDomains,
    }));

    const syncRoutes = (await import("../src/routes/sync.js")).default;
    app = express();
    app.use("/api/sync", syncRoutes);
    app.use(errorHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it("returns merged docs for an authenticated request", async () => {
    const res = await request(app)
      .post("/api/sync")
      .send({ prayer_log: { "2026-06-19": { fajr: { value: "prayed", updatedAt: 9 } } } })
      .expect("Content-Type", /json/)
      .expect(200);

    expect(res.body).toMatchObject({
      prayer_log: {}, habits: [], habit_log: {}, settings: {},
      syncedAt: expect.any(String),
    });
    expect(mockSyncDomains).toHaveBeenCalledTimes(1);
    expect(mockSyncDomains).toHaveBeenCalledWith("user_abc", {
      prayer_log: { "2026-06-19": { fajr: { value: "prayed", updatedAt: 9 } } },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: false, userId: null });

    const res = await request(app).post("/api/sync").send({}).expect(401);

    expect(res.body).toEqual({ error: "Authentication required" });
    expect(mockSyncDomains).not.toHaveBeenCalled();
  });

  it("returns 400 when habits is not an array", async () => {
    const res = await request(app).post("/api/sync").send({ habits: {} }).expect(400);

    expect(res.body.error).toContain("habits must be an array");
    expect(mockSyncDomains).not.toHaveBeenCalled();
  });

  it("returns 500 when the sync service throws", async () => {
    (mockSyncDomains as any).mockRejectedValue(new Error("db down"));

    const res = await request(app).post("/api/sync").send({}).expect(500);

    expect(res.body).toEqual({ error: "Sync failed" });
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- syncRoutes`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full backend suite + typecheck**

Run: `npm test`
Expected: all suites pass (existing + new).
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/controllers/syncController.ts src/routes/sync.ts src/index.ts __tests__/syncRoutes.test.ts
git commit -m "feat(backend): add POST /api/sync endpoint with 1MB body bypass"
```

---

### Task 6: `DELETE /api/account` — service, controller, route, wiring

**Files:**
- Create: `backend/src/services/accountService.ts`
- Create: `backend/src/controllers/accountController.ts`
- Create: `backend/src/routes/account.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/__tests__/accountRoutes.test.ts`

**Interfaces:**
- Consumes: `pool` from `src/db/pool.js`; `clerkClient` from `@clerk/express`; `requireAuth` + `AuthedRequest` from `src/middleware/requireAuth.js`; `clerkMiddleware` from `@clerk/express`.
- Produces: `deleteAccount(userId: string): Promise<void>` from `src/services/accountService.js` — deletes the `users` row (cascades `sync_documents`), then `clerkClient.users.deleteUser(userId)`, tolerating a Clerk 404 (already deleted).
- Produces: `deleteAccountHandler(req, res)` from `src/controllers/accountController.js` — calls `deleteAccount(req.userId)`, returns `200 { deleted: true }` or `500 { error: "Account deletion failed" }`.
- Produces: default-exported `Router` from `src/routes/account.js` mounting `clerkMiddleware()` + `DELETE /` behind `requireAuth`.
- Modifies app wiring: mounts `/api/account`.

- [ ] **Step 1: Write the account service**

Create `backend/src/services/accountService.ts`:
```ts
import { pool } from "../db/pool.js";
import { clerkClient } from "@clerk/express";

/**
 * Deletes all of a user's synced data (users row cascades to sync_documents)
 * then removes the Clerk identity. A Clerk 404 means the identity was already
 * gone — treated as success so the call is idempotent.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  try {
    await clerkClient.users.deleteUser(userId);
  } catch (err: unknown) {
    if ((err as { status?: number })?.status === 404) return;
    throw err;
  }
}
```

- [ ] **Step 2: Write the controller**

Create `backend/src/controllers/accountController.ts`:
```ts
import type { Request, Response } from "express";
import { deleteAccount } from "../services/accountService.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

export async function deleteAccountHandler(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).userId as string;
    await deleteAccount(userId);
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error("account_delete_failed", err);
    return res.status(500).json({ error: "Account deletion failed" });
  }
}
```

- [ ] **Step 3: Write the route**

Create `backend/src/routes/account.ts`:
```ts
import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import { deleteAccountHandler } from "../controllers/accountController.js";

const router = Router();

router.use(clerkMiddleware());

/**
 * DELETE /api/account
 * Deletes the authenticated user's data and Clerk identity.
 */
router.delete("/", requireAuth, deleteAccountHandler);

export default router;
```

- [ ] **Step 4: Wire into `index.ts`**

In `backend/src/index.ts`, add the import:
```ts
import accountRoutes from "./routes/account.js";
```
and mount it after the sync route:
```ts
app.use("/api/account", accountRoutes);
```

- [ ] **Step 5: Write the failing integration test**

Create `backend/__tests__/accountRoutes.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const mockGetAuth: jest.Mock = jest.fn();
const mockDeleteUser: jest.Mock = jest.fn();
const mockQuery: jest.Mock = jest.fn();

describe("Account Routes Integration", () => {
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockGetAuth.mockReset();
    mockDeleteUser.mockReset();
    mockQuery.mockReset();
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    (mockDeleteUser as any).mockResolvedValue({});
    (mockQuery as any).mockResolvedValue({ rows: [] });

    jest.unstable_mockModule("@clerk/express", () => ({
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      getAuth: mockGetAuth,
      clerkClient: { users: { deleteUser: mockDeleteUser } },
    }));
    jest.unstable_mockModule("../src/db/pool.js", () => ({
      pool: { query: mockQuery },
    }));

    const accountRoutes = (await import("../src/routes/account.js")).default;
    app = express();
    app.use("/api/account", accountRoutes);
    app.use(errorHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it("deletes DB rows and the Clerk user, returns 200", async () => {
    const res = await request(app).delete("/api/account").expect(200);

    expect(res.body).toEqual({ deleted: true });
    expect(mockQuery).toHaveBeenCalledWith(`DELETE FROM users WHERE id = $1`, ["user_abc"]);
    expect(mockDeleteUser).toHaveBeenCalledWith("user_abc");
  });

  it("tolerates a Clerk 404 (already deleted) and still returns 200", async () => {
    (mockDeleteUser as any).mockRejectedValue({ status: 404 });

    const res = await request(app).delete("/api/account").expect(200);

    expect(res.body).toEqual({ deleted: true });
  });

  it("returns 401 when unauthenticated", async () => {
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: false, userId: null });

    await request(app).delete("/api/account").expect(401);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("returns 500 when a non-404 Clerk error occurs", async () => {
    (mockDeleteUser as any).mockRejectedValue({ status: 500 });

    const res = await request(app).delete("/api/account").expect(500);

    expect(res.body).toEqual({ error: "Account deletion failed" });
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- accountRoutes`
Expected: PASS (4 tests).

- [ ] **Step 7: Run the full suite + typecheck + lint**

Run: `npm test`
Expected: all suites pass.
Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/services/accountService.ts src/controllers/accountController.ts src/routes/account.ts src/index.ts __tests__/accountRoutes.test.ts
git commit -m "feat(backend): add DELETE /api/account for account + identity deletion"
```

---

## Deployment notes (Railway — not a code task)

After Phase 1 merges:
1. Add the **Postgres** plugin to the Railway project; Railway injects `DATABASE_URL`.
2. Set env vars on the backend service: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `NODE_ENV=production`.
3. Run migrations once on deploy. Either run `npm run migrate` as a Railway deploy/release command, or add it to the start sequence (e.g. `npm run migrate && npm start`). The runner is idempotent.
4. The backend deploys independently of the app — no App Store submission for Phase 1.

## Self-Review

**Spec coverage:**
- Postgres `users` + `sync_documents` schema (JSONB-per-domain) → Task 1. ✓
- Clerk JWT verification middleware → Task 3. ✓
- Server-side transactional LWW merge (approach C), `FOR UPDATE`, strictly-greater tie-break → Task 4 + ported merge in Task 2. ✓
- `POST /api/sync` batched endpoint returning merged docs + `syncedAt`, fresh-device hydration via empty-doc defaults → Tasks 4–5. ✓
- 16KB-vs-1MB body-limit gotcha (bypass for `/api/sync`) → Task 5. ✓
- Sync rate limiter (120/15min) → Task 5. ✓
- `DELETE /api/account` removes DB rows + Clerk identity → Task 6. ✓
- `ensureUser` before inserting `sync_documents` (FK) → Task 4. ✓
- Shared merge test vector (ported from frontend `merge.test.ts`) → Task 2. (Frontend re-uses the same vector in Phase 3; kept manually in sync — noted in `syncMerge.ts`.) ✓
- Production error stripping, ESM `.js` imports, per-route rate limiting conventions → Global Constraints, applied throughout. ✓

Out of Phase 1 scope (correctly deferred): Clerk frontend SDK / sign-in UI, the sync engine + adapters + settings stamping (Phases 2–3), populating `users.email`/`name` (columns exist, left null per the agreed call).

**Placeholder scan:** No TBD/TODO/"add error handling" placeholders; every code and test step contains complete code.

**Type consistency:** `syncDomains(userId, payload)`, `ensureUser(client, userId)`, `requireAuth`/`AuthedRequest.userId`, `runMigrations(db, migrations?)`, `Queryable`, `Migration`, `SYNC_DOMAINS`/`SyncDomain`, `SyncPayload`/`SyncResponse`, and the merge function names are used identically across the tasks that define and consume them. Merge functions are always invoked as `merge(stored, incoming)` to honor the stored-wins-ties rule.
