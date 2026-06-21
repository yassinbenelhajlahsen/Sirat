# Cloud Sync — Phase 3 (Sync Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn on cross-device cloud sync for signed-in users — push/pull the tracker (prayer log, habits, habit log) and user settings (theme, prayer settings, Quran bookmarks/progress/display modes, Ramadan tracker) through the live `POST /api/sync` endpoint, with LWW merge, and capture the user's name/email on the backend user row.

**Architecture:** A frontend sync engine (`frontend/services/sync/`) builds a payload from per-domain **adapters**, POSTs it to the already-live `POST /api/sync`, and applies the server's merged response back to local storage. Tracker domains already carry `Cell`/`updatedAt` stamps + change events. The **settings** domain gets a new stamping mechanism: a `sync:settings_meta_v1` sidecar records a per-key `updatedAt`, bumped when the setting's change event fires; settings without an event today get a minimal `DeviceEventEmitter` emit added to their write path. The engine is single-flight, guarded on signed-in + online, and triggered by sign-in, foreground, and debounced change events. The backend `ensureUser` is extended to populate `name`/`email` from Clerk.

**Tech Stack:** React Native 0.81 / Expo 54, TypeScript, `@react-native-async-storage/async-storage`, `expo-network`, `@clerk/expo` (frontend) / `@clerk/express` (backend), `DeviceEventEmitter`, Babel-based Jest (frontend) / ts-jest ESM (backend), Express 4 + raw `pg` (backend).

## Global Constraints

- **Frontend imports:** use the `@/` path alias (maps to `frontend/`). Run frontend commands from `frontend/`, backend from `backend/`.
- **Backend `/api/sync` contract is FIXED and live — do not change it.** Request body: `{ prayer_log?, habits?, habit_log?, settings? }`. Response: `{ prayer_log, habits, habit_log, settings, syncedAt }`. Auth: Clerk Bearer token (attached automatically by `apiFetch`). Body limit 1 MB (sync route only), rate limit 120 / 15 min.
- **Merge rule (must match backend `backend/src/utils/syncMerge.ts`):** LWW by `updatedAt`; on an exact tie the **first argument wins**. Frontend convention: first arg is `local`, so **local wins ties** (offline-first source of truth). This mirrors the existing `frontend/services/tracking/merge.ts`.
- **`Cell<T>` is `{ value: T; updatedAt: number }`** (epoch-ms), defined in `frontend/services/tracking/types.ts`. Settings envelope reuses it: `Record<string, Cell<unknown>>`.
- **New AsyncStorage keys:** `sync:settings_meta_v1` (per-key stamps), `sync:last_synced_v1` (last successful sync epoch-ms). Versioned — never rename without migration.
- **Sync scope — never sync device-specific state:** notification scheduling/runtime keys (`notif_*`), OS permissions, mosque/prayer-times caches. Quran *reading mode* does not exist on this branch — out of scope.
- **Tie-break / asymmetry is intentional** (see spec `devDocs/superpowers/specs/2026-06-19-user-accounts-cloud-sync-design.md`). Do not "fix" it.
- **Tests:** frontend uses Babel-Jest — **no dynamic `import()`**; use static imports + top-level `jest.mock()` + (for cached modules) `jest.resetModules()` + `require()` inside a loader. Single frontend test: `cd frontend && npm test -- --runTestsByPath <path>`. Single backend test: `cd backend && npm test -- --runTestsByPath <path>`. When adding/removing suites, update `frontend/__tests__/README.md`.
- **Secrets/logging:** never log tokens, emails, or PII. Backend Clerk calls are best-effort — never throw out of the sync path because profile capture failed.

---

## File Structure

**Backend (modify):**
- `backend/src/services/userService.ts` — extend `ensureUser` to populate `name`/`email` from Clerk.

**Frontend — modify existing:**
- `frontend/services/tracking/types.ts` — add `SettingsEnvelope`.
- `frontend/services/tracking/merge.ts` — add `mergeSettings`.
- `frontend/services/tracking/prayerLog.ts` — add `replacePrayerLog`.
- `frontend/services/tracking/habits.ts` — add `replaceAllHabits`.
- `frontend/services/tracking/habitLog.ts` — add `replaceHabitLog`.
- `frontend/services/quranBookmarks.ts` — add `QURAN_BOOKMARKS_UPDATED` event + `replaceBookmarks`.
- `frontend/services/quranProgress.ts` — add `QURAN_PROGRESS_UPDATED` event + `getQuranProgress`/`replaceQuranProgress`.
- `frontend/services/ramadanTracker.ts` — add `RAMADAN_TRACKER_UPDATED` event + `replaceMissedFastDays`.
- `frontend/services/notifications/storage.ts` — add `writePrayerSettings`.
- `frontend/context/ThemeContext.tsx` + `frontend/constants/theme.ts` — emit `THEME_CHANGED`, subscribe to reload, export event const.
- `frontend/app/_layout.tsx` — mount `useSyncEngine()`.
- `frontend/components/settings/AccountSection.tsx` — sync-status indicator.

**Frontend — create:**
- `frontend/services/sync/types.ts` — `SyncPayload`, `SyncResponse`, `DomainAdapter`, `SettingEntry`.
- `frontend/services/sync/settingsMeta.ts` — stamp sidecar.
- `frontend/services/sync/settingsRegistry.ts` — registry of synced settings.
- `frontend/services/sync/adapters/prayerLogAdapter.ts`, `habitsAdapter.ts`, `habitLogAdapter.ts`, `settingsAdapter.ts`.
- `frontend/services/sync/syncEngine.ts` — engine core.
- `frontend/hooks/useSyncEngine.ts` — triggers + stamp subscriptions.
- `frontend/hooks/useSyncStatus.ts` — status hook for UI.

**Docs (modify):** `CLAUDE.md`, `frontend/__tests__/README.md`, `backend/__tests__/syncMerge.test.ts`, the design spec, and `MEMORY.md`.

---

## Task 1: Backend — capture name/email on the user row from Clerk

**Files:**
- Modify: `backend/src/services/userService.ts`
- Test: `backend/__tests__/userService.test.ts` (create)

**Interfaces:**
- Consumes: `pool` from `src/db/pool.ts`; `clerkClient` from `@clerk/express` (same import `src/services/accountService.ts` uses — verify the exact specifier there and match it).
- Produces: `ensureUser(userId: string): Promise<void>` — unchanged signature; now also fills `name`/`email` when missing.

- [ ] **Step 1: Read the current code and the Clerk import**

Run: `cd backend && sed -n '1,40p' src/services/userService.ts && grep -n "clerkClient" src/services/accountService.ts`
Note the exact `clerkClient` import specifier and the existing `ensureUser` body.

- [ ] **Step 2: Write the failing test**

Create `backend/__tests__/userService.test.ts`:

```typescript
import { describe, expect, it, jest, beforeEach } from "@jest/globals";

const mockQuery = jest.fn();
const mockGetUser = jest.fn();

jest.mock("../src/db/pool.js", () => ({ pool: { query: (...a: unknown[]) => mockQuery(...a) } }));
jest.mock("@clerk/express", () => ({ clerkClient: { users: { getUser: (...a: unknown[]) => mockGetUser(...a) } } }));

const loadService = async () => await import("../src/services/userService.js");

describe("ensureUser", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockGetUser.mockReset();
  });

  it("inserts the row and fills name/email from Clerk on a new user", async () => {
    // INSERT ... RETURNING returns a row => brand new
    mockQuery.mockResolvedValueOnce({ rows: [{ email: null, name: null }] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // the UPDATE
    mockGetUser.mockResolvedValue({
      primaryEmailAddressId: "e1",
      emailAddresses: [{ id: "e1", emailAddress: "a@b.com" }],
      firstName: "Sara",
      lastName: "Khan",
    });

    const { ensureUser } = await loadService();
    await ensureUser("user_123");

    expect(mockGetUser).toHaveBeenCalledWith("user_123");
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE users/i);
    expect(updateCall[1]).toEqual(["user_123", "a@b.com", "Sara Khan"]);
  });

  it("does not call Clerk when the existing row already has name and email", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT conflict -> no row
    mockQuery.mockResolvedValueOnce({ rows: [{ email: "a@b.com", name: "Sara Khan" }] }); // SELECT
    const { ensureUser } = await loadService();
    await ensureUser("user_123");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("swallows Clerk errors and leaves the row as-is", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ email: null, name: null }] });
    mockGetUser.mockRejectedValue(new Error("clerk down"));
    const { ensureUser } = await loadService();
    await expect(ensureUser("user_123")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npm test -- --runTestsByPath __tests__/userService.test.ts`
Expected: FAIL (current `ensureUser` only inserts id; no Clerk call, no UPDATE).

- [ ] **Step 4: Implement**

Replace the body of `ensureUser` in `backend/src/services/userService.ts` (keep the file's existing imports; add `clerkClient` matching `accountService.ts`):

```typescript
import { pool } from "../db/pool.js";
import { clerkClient } from "@clerk/express";

export async function ensureUser(userId: string): Promise<void> {
  const inserted = await pool.query<{ email: string | null; name: string | null }>(
    `INSERT INTO users (id) VALUES ($1)
     ON CONFLICT (id) DO NOTHING
     RETURNING email, name`,
    [userId],
  );

  let needsProfile: boolean;
  if (inserted.rows.length > 0) {
    needsProfile = true; // brand-new row, name/email are null
  } else {
    const existing = await pool.query<{ email: string | null; name: string | null }>(
      `SELECT email, name FROM users WHERE id = $1`,
      [userId],
    );
    const row = existing.rows[0];
    needsProfile = !row || !row.email || !row.name;
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
    // COALESCE so we never overwrite an existing value with null.
    await pool.query(
      `UPDATE users SET email = COALESCE($2, email), name = COALESCE($3, name) WHERE id = $1`,
      [userId, email, name],
    );
  } catch {
    // Best-effort: leave nulls; retried on the next sync. Never break the sync path.
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npm test -- --runTestsByPath __tests__/userService.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + lint**

Run: `cd backend && npm run build && npm run lint`
Expected: no errors. (If the Clerk backend `User` type lacks `primaryEmailAddressId`/`emailAddresses` as typed, adjust to the actual `@clerk/express` types — check `node_modules/@clerk/backend` types — but keep the same logic.)

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/userService.ts backend/__tests__/userService.test.ts
git commit -m "feat(backend): populate user name/email from Clerk on first sync upsert"
```

---

## Task 2: Frontend — `SettingsEnvelope` type

**Files:**
- Modify: `frontend/services/tracking/types.ts`

**Interfaces:**
- Consumes: existing `Cell<T>` in the same file.
- Produces: `SettingsEnvelope = Record<string, Cell<unknown>>`.

- [ ] **Step 1: Add the type**

Append to `frontend/services/tracking/types.ts`:

```typescript
/** settingKey -> stamped value. Mirrors backend SettingsEnvelope. */
export type SettingsEnvelope = Record<string, Cell<unknown>>;
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/services/tracking/types.ts
git commit -m "feat(sync): add SettingsEnvelope type"
```

---

## Task 3: Frontend — `mergeSettings`

**Files:**
- Modify: `frontend/services/tracking/merge.ts`
- Test: `frontend/__tests__/services/tracking/merge.test.ts` (extend)

**Interfaces:**
- Consumes: the file-private `pickCell<T>` already in `merge.ts`; `SettingsEnvelope` from `./types`.
- Produces: `mergeSettings(local: SettingsEnvelope, remote: SettingsEnvelope): SettingsEnvelope`.

- [ ] **Step 1: Write the failing tests** (mirror `backend/__tests__/syncMerge.test.ts`)

Add to `frontend/__tests__/services/tracking/merge.test.ts`:

```typescript
import { mergeSettings } from "@/services/tracking/merge";

describe("mergeSettings", () => {
  it("keeps the higher updatedAt per key", () => {
    const local = { theme: { value: "dark", updatedAt: 10 } };
    const remote = { theme: { value: "light", updatedAt: 20 } };
    expect(mergeSettings(local, remote)).toEqual({ theme: { value: "light", updatedAt: 20 } });
  });

  it("keeps local on an exact tie", () => {
    const local = { theme: { value: "dark", updatedAt: 10 } };
    const remote = { theme: { value: "light", updatedAt: 10 } };
    expect(mergeSettings(local, remote).theme).toEqual({ value: "dark", updatedAt: 10 });
  });

  it("unions keys present on only one side", () => {
    const local = { theme: { value: "dark", updatedAt: 10 } };
    const remote = { prayerSettings: { value: { method: 2 }, updatedAt: 5 } };
    expect(mergeSettings(local, remote)).toEqual({
      theme: { value: "dark", updatedAt: 10 },
      prayerSettings: { value: { method: 2 }, updatedAt: 5 },
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/tracking/merge.test.ts`
Expected: FAIL ("mergeSettings is not a function").

- [ ] **Step 3: Implement**

Add to `frontend/services/tracking/merge.ts` (import `SettingsEnvelope` from `./types`):

```typescript
export function mergeSettings(
  local: SettingsEnvelope,
  remote: SettingsEnvelope,
): SettingsEnvelope {
  const out: SettingsEnvelope = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    const cell = pickCell(local[k], remote[k]);
    if (cell) out[k] = cell;
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/tracking/merge.test.ts`
Expected: PASS.

- [ ] **Step 5: Mirror the cases on the backend (drift guard)**

Add equivalent `mergeSettings` cases to `backend/__tests__/syncMerge.test.ts` (it already imports `mergeSettings`):

```typescript
  it("mergeSettings keeps higher updatedAt and keeps stored on tie", () => {
    const stored = { theme: { value: "dark", updatedAt: 10 } };
    const incoming = { theme: { value: "light", updatedAt: 10 }, prayerSettings: { value: { method: 2 }, updatedAt: 5 } };
    expect(mergeSettings(stored, incoming)).toEqual({
      theme: { value: "dark", updatedAt: 10 },
      prayerSettings: { value: { method: 2 }, updatedAt: 5 },
    });
  });
```

Run: `cd backend && npm test -- --runTestsByPath __tests__/syncMerge.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/services/tracking/merge.ts frontend/__tests__/services/tracking/merge.test.ts backend/__tests__/syncMerge.test.ts
git commit -m "feat(sync): add frontend mergeSettings mirroring backend, extend shared merge vector"
```

---

## Task 4: Frontend — "replace whole" setters for tracker services

**Files:**
- Modify: `frontend/services/tracking/prayerLog.ts`, `frontend/services/tracking/habits.ts`, `frontend/services/tracking/habitLog.ts`
- Test: `frontend/__tests__/services/tracking/replaceSetters.test.ts` (create)

**Interfaces:**
- Produces:
  - `replacePrayerLog(log: PrayerLog): Promise<void>` — persists, updates cache, emits `PRAYER_LOG_UPDATED` with `{ dateKey: null }`.
  - `replaceAllHabits(habits: Habit[]): Promise<void>` — persists, emits `HABITS_UPDATED` (no payload).
  - `replaceHabitLog(log: HabitLog): Promise<void>` — persists, updates cache, emits `HABIT_LOG_UPDATED` with `{ dateKey: null }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/tracking/replaceSetters.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import {
  replacePrayerLog, getCachedPrayerLog, PRAYER_LOG_STORAGE_KEY, PRAYER_LOG_UPDATED_EVENT,
} from "@/services/tracking/prayerLog";
import { replaceAllHabits, HABITS_STORAGE_KEY, HABITS_UPDATED_EVENT } from "@/services/tracking/habits";
import {
  replaceHabitLog, getCachedHabitLog, HABIT_LOG_STORAGE_KEY, HABIT_LOG_UPDATED_EVENT,
} from "@/services/tracking/habitLog";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it("replacePrayerLog persists, updates cache, and emits", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const log = { "2026-06-20": { fajr: { value: "prayed" as const, updatedAt: 1 } } };
  await replacePrayerLog(log);
  expect(JSON.parse((await AsyncStorage.getItem(PRAYER_LOG_STORAGE_KEY))!)).toEqual(log);
  expect(getCachedPrayerLog()).toEqual(log);
  expect(emit).toHaveBeenCalledWith(PRAYER_LOG_UPDATED_EVENT, { dateKey: null });
});

it("replaceAllHabits persists and emits", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const habits = [{ id: "h1", name: "A", icon: "i", frequency: { type: "daily" as const }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 }];
  await replaceAllHabits(habits);
  expect(JSON.parse((await AsyncStorage.getItem(HABITS_STORAGE_KEY))!)).toEqual(habits);
  expect(emit).toHaveBeenCalledWith(HABITS_UPDATED_EVENT);
});

it("replaceHabitLog persists, updates cache, and emits", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const log = { "2026-06-20": { h1: { value: true, updatedAt: 1 } } };
  await replaceHabitLog(log);
  expect(JSON.parse((await AsyncStorage.getItem(HABIT_LOG_STORAGE_KEY))!)).toEqual(log);
  expect(getCachedHabitLog()).toEqual(log);
  expect(emit).toHaveBeenCalledWith(HABIT_LOG_UPDATED_EVENT, { dateKey: null });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/tracking/replaceSetters.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement in `prayerLog.ts`**

These services keep a module-level cache variable (e.g. `cache`) that `getCachedPrayerLog` returns and `persist`/`emit` helpers exist. Add, matching the file's existing cache variable name and `persist`/`emit` helpers:

```typescript
export async function replacePrayerLog(log: PrayerLog): Promise<void> {
  cache = log;
  await AsyncStorage.setItem(PRAYER_LOG_STORAGE_KEY, JSON.stringify(log));
  DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey: null });
}
```

(Open the file first to confirm the cache variable name and whether a `persist(log)` helper already wraps `setItem`; reuse it if present, e.g. `await persist(log)`.)

- [ ] **Step 4: Implement in `habits.ts`**

```typescript
export async function replaceAllHabits(habits: Habit[]): Promise<void> {
  cache = habits;
  await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
  DeviceEventEmitter.emit(HABITS_UPDATED_EVENT);
}
```

(`habits.ts` has a `persist()` that both writes and emits — if so, set the cache then call the existing `persist`. Confirm by reading the file; match its pattern.)

- [ ] **Step 5: Implement in `habitLog.ts`**

```typescript
export async function replaceHabitLog(log: HabitLog): Promise<void> {
  cache = log;
  await AsyncStorage.setItem(HABIT_LOG_STORAGE_KEY, JSON.stringify(log));
  DeviceEventEmitter.emit(HABIT_LOG_UPDATED_EVENT, { dateKey: null });
}
```

- [ ] **Step 6: Confirm existing listeners tolerate `dateKey: null`**

Run: `cd frontend && grep -rn "PRAYER_LOG_UPDATED_EVENT\|HABIT_LOG_UPDATED_EVENT" hooks app components`
The listeners in `hooks/usePrayerLog.ts` / `hooks/useHabitLog.ts` filter `if (payload?.dateKey === dateKey) reload()`. With `dateKey: null` they would NOT reload. Fix each listener to also reload on a null/absent dateKey:

```typescript
(payload: { dateKey?: string | null }) => {
  if (payload?.dateKey == null || payload.dateKey === dateKey) reload();
}
```

Apply to `hooks/usePrayerLog.ts` and `hooks/useHabitLog.ts` (and any other listener the grep surfaces).

- [ ] **Step 7: Run tests + typecheck**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/tracking/replaceSetters.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/services/tracking/prayerLog.ts frontend/services/tracking/habits.ts frontend/services/tracking/habitLog.ts frontend/hooks/usePrayerLog.ts frontend/hooks/useHabitLog.ts frontend/__tests__/services/tracking/replaceSetters.test.ts
git commit -m "feat(sync): add replace-whole setters to tracker services for applyMerged"
```

---

## Task 5: Frontend — sync domain types

**Files:**
- Create: `frontend/services/sync/types.ts`

**Interfaces:**
- Consumes: `PrayerLog`, `Habit`, `HabitLog`, `SettingsEnvelope` from `@/services/tracking/types`.
- Produces: `SyncPayload`, `SyncResponse`, `DomainAdapter<T>`, `SettingEntry`.

- [ ] **Step 1: Create the file**

```typescript
import type { PrayerLog, Habit, HabitLog, SettingsEnvelope } from "@/services/tracking/types";

export type SyncPayload = {
  prayer_log: PrayerLog;
  habits: Habit[];
  habit_log: HabitLog;
  settings: SettingsEnvelope;
};

export type SyncResponse = SyncPayload & { syncedAt: string };

/** A domain adapter reads the local doc and applies the server-merged doc back. */
export type DomainAdapter<T> = {
  read(): Promise<T>;
  applyMerged(serverDoc: T): Promise<void>;
};

/** One synced setting: how to read/write its value and what event signals a change. */
export type SettingEntry = {
  /** Stable key inside the settings envelope. Never rename without a migration. */
  key: string;
  /** DeviceEventEmitter event fired when this setting changes (user or programmatic). */
  changeEvent: string;
  read(): Promise<unknown>;
  /** Persist the value AND emit `changeEvent` so consumers refresh. */
  applyValue(value: unknown): Promise<void>;
};
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/services/sync/types.ts
git commit -m "feat(sync): add sync domain + adapter types"
```

---

## Task 6: Frontend — settings stamp sidecar (`settingsMeta`)

**Files:**
- Create: `frontend/services/sync/settingsMeta.ts`
- Test: `frontend/__tests__/services/sync/settingsMeta.test.ts` (create)

**Interfaces:**
- Produces:
  - `SETTINGS_META_KEY = "sync:settings_meta_v1"`
  - `getSettingsMeta(): Promise<Record<string, number>>`
  - `bumpStamp(key: string, at?: number): Promise<void>` — sets `meta[key] = at ?? Date.now()` (used for **user** changes).
  - `setStamp(key: string, at: number): Promise<void>` — sets `meta[key] = at` (used when applying a merged remote stamp).

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/sync/settingsMeta.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SETTINGS_META_KEY, getSettingsMeta, bumpStamp, setStamp } from "@/services/sync/settingsMeta";

beforeEach(async () => { await AsyncStorage.clear(); });

it("returns {} when nothing stored", async () => {
  expect(await getSettingsMeta()).toEqual({});
});

it("bumpStamp writes the provided time", async () => {
  await bumpStamp("theme", 123);
  expect(await getSettingsMeta()).toEqual({ theme: 123 });
  expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_META_KEY))!)).toEqual({ theme: 123 });
});

it("setStamp overwrites a key without touching others", async () => {
  await bumpStamp("theme", 100);
  await bumpStamp("prayerSettings", 200);
  await setStamp("theme", 999);
  expect(await getSettingsMeta()).toEqual({ theme: 999, prayerSettings: 200 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/settingsMeta.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `frontend/services/sync/settingsMeta.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SETTINGS_META_KEY = "sync:settings_meta_v1";

export async function getSettingsMeta(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

async function write(meta: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_META_KEY, JSON.stringify(meta));
}

export async function bumpStamp(key: string, at: number = Date.now()): Promise<void> {
  const meta = await getSettingsMeta();
  meta[key] = at;
  await write(meta);
}

export async function setStamp(key: string, at: number): Promise<void> {
  const meta = await getSettingsMeta();
  meta[key] = at;
  await write(meta);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/settingsMeta.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/sync/settingsMeta.ts frontend/__tests__/services/sync/settingsMeta.test.ts
git commit -m "feat(sync): add settings stamp sidecar (sync:settings_meta_v1)"
```

---

## Task 7: Frontend — add change events + read/replace to event-less settings

Each sub-task adds a `DeviceEventEmitter` emit to a setting's write path, a "replace" writer where missing, and (for theme) a reload subscription so a synced value updates live. The event names become the `changeEvent` in the registry (Task 8).

### 7a — Theme (`THEME_CHANGED`, live reload)

**Files:**
- Modify: `frontend/constants/theme.ts` (export event const), `frontend/context/ThemeContext.tsx`
- Test: `frontend/__tests__/context/themeSync.test.tsx` (create)

**Interfaces:**
- Produces: `THEME_CHANGED_EVENT = "THEME_CHANGED"` (in `constants/theme.ts`, next to `APP_THEME_STORAGE_KEY`). `setTheme` emits it; the provider re-reads storage when it fires from elsewhere.

- [ ] **Step 1: Add the event constant**

In `frontend/constants/theme.ts`, next to `APP_THEME_STORAGE_KEY`:

```typescript
export const THEME_CHANGED_EVENT = "THEME_CHANGED";
```

- [ ] **Step 2: Write the failing test**

Create `frontend/__tests__/context/themeSync.test.tsx`:

```typescript
import { render, act, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { APP_THEME_STORAGE_KEY, THEME_CHANGED_EVENT } from "@/constants/theme";

function Probe() {
  const { themeName } = useTheme();
  return <Text testID="t">{themeName}</Text>;
}

beforeEach(async () => { await AsyncStorage.clear(); });

it("reloads theme from storage when THEME_CHANGED fires (sync apply path)", async () => {
  const { getByTestId } = render(
    <ThemeProvider><Probe /></ThemeProvider>,
  );
  await act(async () => {
    await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "dark");
    DeviceEventEmitter.emit(THEME_CHANGED_EVENT);
  });
  await waitFor(() => expect(getByTestId("t").props.children).toBe("dark"));
});
```

(Confirm the provider export name — `ThemeProvider` — and that `useTheme()` returns `{ themeName }`. Match the real exports.)

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/context/themeSync.test.tsx`
Expected: FAIL (no reload listener yet).

- [ ] **Step 4: Implement in `ThemeContext.tsx`**

In `setTheme`, after the successful `AsyncStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme)`, emit:

```typescript
DeviceEventEmitter.emit(THEME_CHANGED_EVENT);
```

Add an effect in the provider that re-reads storage on the event:

```typescript
useEffect(() => {
  const sub = DeviceEventEmitter.addListener(THEME_CHANGED_EVENT, async () => {
    const stored = await AsyncStorage.getItem(APP_THEME_STORAGE_KEY);
    if (isThemeName(stored)) setThemeName(stored);
  });
  return () => sub.remove();
}, []);
```

(Import `DeviceEventEmitter` from `react-native`, `THEME_CHANGED_EVENT` from `@/constants/theme`. `setThemeName` from the existing `useState`; `isThemeName` already exists in the file. Because the listener calls `setThemeName` — not `setTheme` — applying a synced theme does not re-emit, so no loop.)

- [ ] **Step 5: Run to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/context/themeSync.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/constants/theme.ts frontend/context/ThemeContext.tsx frontend/__tests__/context/themeSync.test.tsx
git commit -m "feat(sync): emit THEME_CHANGED and live-reload theme on apply"
```

### 7b — Quran bookmarks (`QURAN_BOOKMARKS_UPDATED` + `replaceBookmarks`)

**Files:**
- Modify: `frontend/services/quranBookmarks.ts`
- Test: `frontend/__tests__/services/quranBookmarks.test.ts` (create or extend)

**Interfaces:**
- Produces: `QURAN_BOOKMARKS_UPDATED_EVENT = "QURAN_BOOKMARKS_UPDATED"`; `replaceBookmarks(list: QuranBookmark[]): Promise<QuranBookmark[]>`. `upsertBookmark`/`deleteBookmark`/`replaceBookmarks` all emit the event.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/quranBookmarks.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { getBookmarks, replaceBookmarks, QURAN_BOOKMARKS_UPDATED_EVENT } from "@/services/quranBookmarks";

beforeEach(async () => { await AsyncStorage.clear(); });

it("replaceBookmarks overwrites storage and emits", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const list = [{ id: "b1", surahNumber: 2, ayahNumber: 255, ayahGlobalIndex: 262, title: "Ayatul Kursi", createdAt: 1, updatedAt: 1 }];
  const result = await replaceBookmarks(list);
  expect(result).toEqual(list);
  expect(await getBookmarks()).toEqual(list);
  expect(emit).toHaveBeenCalledWith(QURAN_BOOKMARKS_UPDATED_EVENT);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/quranBookmarks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `frontend/services/quranBookmarks.ts`: add `export const QURAN_BOOKMARKS_UPDATED_EVENT = "QURAN_BOOKMARKS_UPDATED";`, import `DeviceEventEmitter` from `react-native`, add an `emit()` helper, call it at the end of `upsertBookmark` and `deleteBookmark`, and add:

```typescript
export async function replaceBookmarks(list: QuranBookmark[]): Promise<QuranBookmark[]> {
  await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  DeviceEventEmitter.emit(QURAN_BOOKMARKS_UPDATED_EVENT);
  return list;
}
```

(Use the file's actual storage-key constant for `quran:bookmarks` — confirm its name.)

- [ ] **Step 4: Run + commit**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/quranBookmarks.test.ts`
Expected: PASS.

```bash
git add frontend/services/quranBookmarks.ts frontend/__tests__/services/quranBookmarks.test.ts
git commit -m "feat(sync): add QURAN_BOOKMARKS_UPDATED event + replaceBookmarks"
```

### 7c — Quran progress (`QURAN_PROGRESS_UPDATED` + bundle read/replace)

**Files:**
- Modify: `frontend/services/quranProgress.ts`
- Test: `frontend/__tests__/services/quranProgress.test.ts` (create)

**Interfaces:**
- Produces:
  - `QURAN_PROGRESS_UPDATED_EVENT = "QURAN_PROGRESS_UPDATED"` (emitted by `saveLastReadAyahIndex`, `saveLastReadSurahAndAyah`, and `replaceQuranProgress`).
  - `type QuranProgress = { index: number | null; position: { surahNumber: number; ayahNumber: number } | null }`.
  - `getQuranProgress(): Promise<QuranProgress>`.
  - `replaceQuranProgress(p: QuranProgress): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/quranProgress.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { getQuranProgress, replaceQuranProgress, QURAN_PROGRESS_UPDATED_EVENT } from "@/services/quranProgress";

beforeEach(async () => { await AsyncStorage.clear(); });

it("round-trips progress and emits on replace", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const p = { index: 262, position: { surahNumber: 2, ayahNumber: 255 } };
  await replaceQuranProgress(p);
  expect(await getQuranProgress()).toEqual(p);
  expect(emit).toHaveBeenCalledWith(QURAN_PROGRESS_UPDATED_EVENT);
});

it("getQuranProgress returns nulls when empty", async () => {
  expect(await getQuranProgress()).toEqual({ index: null, position: null });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/quranProgress.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `frontend/services/quranProgress.ts`: import `DeviceEventEmitter`; add the event const; emit it at the end of `saveLastReadAyahIndex` and `saveLastReadSurahAndAyah`; add:

```typescript
export type QuranProgress = {
  index: number | null;
  position: { surahNumber: number; ayahNumber: number } | null;
};

export async function getQuranProgress(): Promise<QuranProgress> {
  return {
    index: await getLastReadAyahIndex(),
    position: await getLastReadSurahAndAyah(),
  };
}

export async function replaceQuranProgress(p: QuranProgress): Promise<void> {
  if (typeof p.index === "number") await saveLastReadAyahIndex(p.index);
  if (p.position) await saveLastReadSurahAndAyah(p.position.surahNumber, p.position.ayahNumber);
  DeviceEventEmitter.emit(QURAN_PROGRESS_UPDATED_EVENT);
}
```

(The existing savers already guard invalid input. To avoid double-emitting inside `replaceQuranProgress`, either emit only once at the end as shown — acceptable — or factor the emit into the public savers only; keep it simple with the single emit shown.)

- [ ] **Step 4: Run + commit**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/quranProgress.test.ts`
Expected: PASS.

```bash
git add frontend/services/quranProgress.ts frontend/__tests__/services/quranProgress.test.ts
git commit -m "feat(sync): add QURAN_PROGRESS_UPDATED event + progress bundle read/replace"
```

### 7d — Ramadan tracker (`RAMADAN_TRACKER_UPDATED` + `replaceMissedFastDays`)

**Files:**
- Modify: `frontend/services/ramadanTracker.ts`
- Test: `frontend/__tests__/services/ramadanTracker.test.ts` (create or extend)

**Interfaces:**
- Produces: `RAMADAN_TRACKER_UPDATED_EVENT = "RAMADAN_TRACKER_UPDATED"`; `replaceMissedFastDays(map: Record<string, boolean>): Promise<void>`. `markFastAsMissed`/`clearMissedFast`/`replaceMissedFastDays` emit the event.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/ramadanTracker.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { getMissedFastDays, replaceMissedFastDays, RAMADAN_TRACKER_UPDATED_EVENT } from "@/services/ramadanTracker";

beforeEach(async () => { await AsyncStorage.clear(); });

it("replaceMissedFastDays overwrites and emits", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const map = { "2026-03-15": true };
  await replaceMissedFastDays(map);
  expect(await getMissedFastDays()).toEqual(map);
  expect(emit).toHaveBeenCalledWith(RAMADAN_TRACKER_UPDATED_EVENT);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/ramadanTracker.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `frontend/services/ramadanTracker.ts`: import `DeviceEventEmitter`; add the event const; emit it at the end of `markFastAsMissed` and `clearMissedFast`; add:

```typescript
export async function replaceMissedFastDays(map: Record<string, boolean>): Promise<void> {
  await AsyncStorage.setItem(RAMADAN_TRACKER_KEY, JSON.stringify(map));
  DeviceEventEmitter.emit(RAMADAN_TRACKER_UPDATED_EVENT);
}
```

(Use the file's actual key constant for `ramadan_tracker_v1`.)

- [ ] **Step 4: Run + commit**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/ramadanTracker.test.ts`
Expected: PASS.

```bash
git add frontend/services/ramadanTracker.ts frontend/__tests__/services/ramadanTracker.test.ts
git commit -m "feat(sync): add RAMADAN_TRACKER_UPDATED event + replaceMissedFastDays"
```

### 7e — Prayer settings writer (reuses `settingsChanged`)

**Files:**
- Modify: `frontend/services/notifications/storage.ts`
- Test: `frontend/__tests__/services/notifications/writePrayerSettings.test.ts` (create)

**Interfaces:**
- Produces: `writePrayerSettings(value: unknown): Promise<void>` — writes the raw object to the `prayerSettings` key and emits `settingsChanged`. Used by the settings adapter's `applyValue`. (Reads continue via existing `readPrayerSettings`/raw `getItem`.)

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/notifications/writePrayerSettings.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { writePrayerSettings } from "@/services/notifications/storage";

beforeEach(async () => { await AsyncStorage.clear(); });

it("writes prayerSettings verbatim and emits settingsChanged", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const value = { useLocation: false, method: 2, city: { name: "Cairo", lat: 30, lng: 31 } };
  await writePrayerSettings(value);
  expect(JSON.parse((await AsyncStorage.getItem("prayerSettings"))!)).toEqual(value);
  expect(emit).toHaveBeenCalledWith("settingsChanged", expect.anything());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/notifications/writePrayerSettings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `frontend/services/notifications/storage.ts` (import `DeviceEventEmitter` from `react-native`):

```typescript
export async function writePrayerSettings(value: unknown): Promise<void> {
  await AsyncStorage.setItem("prayerSettings", JSON.stringify(value));
  DeviceEventEmitter.emit("settingsChanged", value);
}
```

- [ ] **Step 4: Run + commit**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/notifications/writePrayerSettings.test.ts`
Expected: PASS.

```bash
git add frontend/services/notifications/storage.ts frontend/__tests__/services/notifications/writePrayerSettings.test.ts
git commit -m "feat(sync): add writePrayerSettings emitting settingsChanged"
```

---

## Task 8: Frontend — settings registry

**Files:**
- Create: `frontend/services/sync/settingsRegistry.ts`
- Test: `frontend/__tests__/services/sync/settingsRegistry.test.ts` (create)

**Interfaces:**
- Consumes: the read/write functions + event consts from Task 7 services, `getQuranDisplayModes`/`saveQuranDisplayModes` + `QURAN_DISPLAY_MODES_UPDATED_EVENT` (already exist).
- Produces: `SETTINGS_REGISTRY: SettingEntry[]` covering keys `theme`, `prayerSettings`, `quranDisplayModes`, `quranBookmarks`, `quranProgress`, `ramadanTracker`.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/sync/settingsRegistry.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SETTINGS_REGISTRY } from "@/services/sync/settingsRegistry";

beforeEach(async () => { await AsyncStorage.clear(); });

it("covers exactly the synced setting keys", () => {
  expect(SETTINGS_REGISTRY.map((e) => e.key).sort()).toEqual(
    ["prayerSettings", "quranBookmarks", "quranDisplayModes", "quranProgress", "ramadanTracker", "theme"],
  );
});

it("theme entry round-trips value via read/applyValue", async () => {
  const theme = SETTINGS_REGISTRY.find((e) => e.key === "theme")!;
  await theme.applyValue("dark");
  expect(await theme.read()).toBe("dark");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/settingsRegistry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `frontend/services/sync/settingsRegistry.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SettingEntry } from "./types";
import { APP_THEME_STORAGE_KEY, THEME_CHANGED_EVENT } from "@/constants/theme";
import { writePrayerSettings } from "@/services/notifications/storage";
import {
  getQuranDisplayModes, saveQuranDisplayModes, QURAN_DISPLAY_MODES_UPDATED_EVENT,
} from "@/services/quranDisplayModes";
import {
  getBookmarks, replaceBookmarks, QURAN_BOOKMARKS_UPDATED_EVENT,
} from "@/services/quranBookmarks";
import {
  getQuranProgress, replaceQuranProgress, QURAN_PROGRESS_UPDATED_EVENT,
} from "@/services/quranProgress";
import {
  getMissedFastDays, replaceMissedFastDays, RAMADAN_TRACKER_UPDATED_EVENT,
} from "@/services/ramadanTracker";

async function readJson(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export const SETTINGS_REGISTRY: SettingEntry[] = [
  {
    key: "theme",
    changeEvent: THEME_CHANGED_EVENT,
    read: async () => (await AsyncStorage.getItem(APP_THEME_STORAGE_KEY)) ?? null,
    applyValue: async (v) => {
      if (typeof v === "string") {
        await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, v);
        // emitting via the service path keeps consumers in sync:
        const { DeviceEventEmitter } = await import("react-native");
        DeviceEventEmitter.emit(THEME_CHANGED_EVENT);
      }
    },
  },
  {
    key: "prayerSettings",
    changeEvent: "settingsChanged",
    read: () => readJson("prayerSettings"),
    applyValue: (v) => writePrayerSettings(v),
  },
  {
    key: "quranDisplayModes",
    changeEvent: QURAN_DISPLAY_MODES_UPDATED_EVENT,
    read: () => getQuranDisplayModes(),
    applyValue: async (v) => { if (Array.isArray(v)) await saveQuranDisplayModes(v); },
  },
  {
    key: "quranBookmarks",
    changeEvent: QURAN_BOOKMARKS_UPDATED_EVENT,
    read: () => getBookmarks(),
    applyValue: async (v) => { if (Array.isArray(v)) await replaceBookmarks(v); },
  },
  {
    key: "quranProgress",
    changeEvent: QURAN_PROGRESS_UPDATED_EVENT,
    read: () => getQuranProgress(),
    applyValue: async (v) => {
      if (v && typeof v === "object") await replaceQuranProgress(v as never);
    },
  },
  {
    key: "ramadanTracker",
    changeEvent: RAMADAN_TRACKER_UPDATED_EVENT,
    read: () => getMissedFastDays(),
    applyValue: async (v) => {
      if (v && typeof v === "object") await replaceMissedFastDays(v as Record<string, boolean>);
    },
  },
];
```

(Replace the dynamic `import("react-native")` with a top-level `import { DeviceEventEmitter } from "react-native"` — shown inline only to highlight intent. Use the static import.)

- [ ] **Step 4: Run + typecheck + commit**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/settingsRegistry.test.ts && npm run typecheck`
Expected: PASS.

```bash
git add frontend/services/sync/settingsRegistry.ts frontend/__tests__/services/sync/settingsRegistry.test.ts
git commit -m "feat(sync): add settings registry"
```

---

## Task 9: Frontend — settings adapter

**Files:**
- Create: `frontend/services/sync/adapters/settingsAdapter.ts`
- Test: `frontend/__tests__/services/sync/settingsAdapter.test.ts` (create)

**Interfaces:**
- Consumes: `SETTINGS_REGISTRY`, `getSettingsMeta`/`setStamp`, `mergeSettings`, `isApplyingRemote`/`setApplyingRemote` (defined in Task 11's `syncEngine` — but to avoid a cycle, put the flag in `settingsMeta.ts` is wrong; instead the adapter owns no flag and the engine wraps applies). **Resolution:** the adapter exposes `applyMerged` and the **engine** sets the apply guard around all adapters (Task 11). The adapter just writes values + stamps.
- Produces: `settingsAdapter: DomainAdapter<SettingsEnvelope>`:
  - `read()` → envelope `{ key: { value: read(), updatedAt: meta[key] ?? 0 } }` for every registry entry.
  - `applyMerged(server)` → `merged = mergeSettings(localEnvelope, server)`; for each key where `merged[key].updatedAt > (localMeta[key] ?? 0)`, call `entry.applyValue(value)` then `setStamp(key, merged[key].updatedAt)`.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/sync/settingsAdapter.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { settingsAdapter } from "@/services/sync/adapters/settingsAdapter";
import { bumpStamp, getSettingsMeta } from "@/services/sync/settingsMeta";
import { APP_THEME_STORAGE_KEY } from "@/constants/theme";

beforeEach(async () => { await AsyncStorage.clear(); });

it("read() builds an envelope with stamps from meta (0 when unstamped)", async () => {
  await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "dark");
  await bumpStamp("theme", 500);
  const env = await settingsAdapter.read();
  expect(env.theme).toEqual({ value: "dark", updatedAt: 500 });
  expect(env.prayerSettings.updatedAt).toBe(0);
});

it("applyMerged writes a newer remote value and records its stamp", async () => {
  await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "light");
  await bumpStamp("theme", 100);
  await settingsAdapter.applyMerged({ theme: { value: "dark", updatedAt: 999 } });
  expect(await AsyncStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("dark");
  expect((await getSettingsMeta()).theme).toBe(999);
});

it("applyMerged ignores a remote value that is not newer than local", async () => {
  await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "light");
  await bumpStamp("theme", 100);
  await settingsAdapter.applyMerged({ theme: { value: "dark", updatedAt: 100 } });
  expect(await AsyncStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("light");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/settingsAdapter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `frontend/services/sync/adapters/settingsAdapter.ts`:

```typescript
import type { DomainAdapter } from "../types";
import type { SettingsEnvelope } from "@/services/tracking/types";
import { SETTINGS_REGISTRY } from "../settingsRegistry";
import { getSettingsMeta, setStamp } from "../settingsMeta";
import { mergeSettings } from "@/services/tracking/merge";

async function readEnvelope(): Promise<SettingsEnvelope> {
  const meta = await getSettingsMeta();
  const env: SettingsEnvelope = {};
  for (const entry of SETTINGS_REGISTRY) {
    env[entry.key] = { value: await entry.read(), updatedAt: meta[entry.key] ?? 0 };
  }
  return env;
}

export const settingsAdapter: DomainAdapter<SettingsEnvelope> = {
  read: readEnvelope,
  async applyMerged(server) {
    const local = await readEnvelope();
    const merged = mergeSettings(local, server);
    const meta = await getSettingsMeta();
    for (const entry of SETTINGS_REGISTRY) {
      const cell = merged[entry.key];
      if (!cell) continue;
      if (cell.updatedAt > (meta[entry.key] ?? 0)) {
        await entry.applyValue(cell.value);
        await setStamp(entry.key, cell.updatedAt);
      }
    }
  },
};
```

- [ ] **Step 4: Run + commit**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/settingsAdapter.test.ts`
Expected: PASS.

```bash
git add frontend/services/sync/adapters/settingsAdapter.ts frontend/__tests__/services/sync/settingsAdapter.test.ts
git commit -m "feat(sync): add settings adapter (envelope read + LWW applyMerged)"
```

---

## Task 10: Frontend — tracker adapters

**Files:**
- Create: `frontend/services/sync/adapters/prayerLogAdapter.ts`, `habitsAdapter.ts`, `habitLogAdapter.ts`
- Test: `frontend/__tests__/services/sync/trackerAdapters.test.ts` (create)

**Interfaces:**
- Consumes: `getPrayerLog`/`replacePrayerLog`/`mergePrayerLogs`, `getAllHabits`/`replaceAllHabits`/`mergeHabits`, `getHabitLog`/`replaceHabitLog`/`mergeHabitLogs`.
- Produces: `prayerLogAdapter: DomainAdapter<PrayerLog>`, `habitsAdapter: DomainAdapter<Habit[]>`, `habitLogAdapter: DomainAdapter<HabitLog>`. Each `applyMerged(server)` re-merges with **current** local (protecting edits made during the request) then replaces.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/sync/trackerAdapters.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { prayerLogAdapter } from "@/services/sync/adapters/prayerLogAdapter";
import { getCachedPrayerLog } from "@/services/tracking/prayerLog";

beforeEach(async () => { await AsyncStorage.clear(); });

it("prayerLogAdapter.applyMerged keeps the newer cell per LWW", async () => {
  // local has a newer fajr edit; server has an older fajr + a maghrib.
  await prayerLogAdapter.applyMerged({}); // seed empty
  await (await import("@/services/tracking/prayerLog")).setPrayerStatus("2026-06-20", "fajr", "prayed");
  const localFajr = getCachedPrayerLog()["2026-06-20"].fajr!;
  await prayerLogAdapter.applyMerged({
    "2026-06-20": {
      fajr: { value: "missed", updatedAt: localFajr.updatedAt - 1 }, // older -> loses
      maghrib: { value: "prayed", updatedAt: 999 },
    },
  });
  const merged = getCachedPrayerLog()["2026-06-20"];
  expect(merged.fajr!.value).toBe("prayed"); // local newer wins
  expect(merged.maghrib!.value).toBe("prayed"); // server-only key applied
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/trackerAdapters.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the three adapters**

`frontend/services/sync/adapters/prayerLogAdapter.ts`:

```typescript
import type { DomainAdapter } from "../types";
import type { PrayerLog } from "@/services/tracking/types";
import { getPrayerLog, replacePrayerLog } from "@/services/tracking/prayerLog";
import { mergePrayerLogs } from "@/services/tracking/merge";

export const prayerLogAdapter: DomainAdapter<PrayerLog> = {
  read: () => getPrayerLog(),
  async applyMerged(server) {
    const local = await getPrayerLog();
    await replacePrayerLog(mergePrayerLogs(local, server));
  },
};
```

`frontend/services/sync/adapters/habitsAdapter.ts`:

```typescript
import type { DomainAdapter } from "../types";
import type { Habit } from "@/services/tracking/types";
import { getAllHabits, replaceAllHabits } from "@/services/tracking/habits";
import { mergeHabits } from "@/services/tracking/merge";

export const habitsAdapter: DomainAdapter<Habit[]> = {
  read: () => getAllHabits(),
  async applyMerged(server) {
    const local = await getAllHabits();
    await replaceAllHabits(mergeHabits(local, server));
  },
};
```

`frontend/services/sync/adapters/habitLogAdapter.ts`:

```typescript
import type { DomainAdapter } from "../types";
import type { HabitLog } from "@/services/tracking/types";
import { getHabitLog, replaceHabitLog } from "@/services/tracking/habitLog";
import { mergeHabitLogs } from "@/services/tracking/merge";

export const habitLogAdapter: DomainAdapter<HabitLog> = {
  read: () => getHabitLog(),
  async applyMerged(server) {
    const local = await getHabitLog();
    await replaceHabitLog(mergeHabitLogs(local, server));
  },
};
```

(Note: `getAllHabits` includes tombstoned/archived habits — correct for sync. Do not use `getActiveHabits`.)

- [ ] **Step 4: Run + commit**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/trackerAdapters.test.ts`
Expected: PASS.

```bash
git add frontend/services/sync/adapters/prayerLogAdapter.ts frontend/services/sync/adapters/habitsAdapter.ts frontend/services/sync/adapters/habitLogAdapter.ts frontend/__tests__/services/sync/trackerAdapters.test.ts
git commit -m "feat(sync): add tracker domain adapters"
```

---

## Task 11: Frontend — sync engine core

**Files:**
- Create: `frontend/services/sync/syncEngine.ts`
- Test: `frontend/__tests__/services/sync/syncEngine.test.ts` (create)

**Interfaces:**
- Consumes: `apiPost` from `@/services/apiClient`; `getAuthToken` from `@/services/auth/authToken`; `expo-network`; the four adapters; `SyncPayload`/`SyncResponse`.
- Produces:
  - `LAST_SYNCED_KEY = "sync:last_synced_v1"`, `SYNC_STATUS_EVENT = "SYNC_STATUS_UPDATED"`.
  - `type SyncStatus = "idle" | "syncing" | "success" | "error"`.
  - `syncNow(reason?: string): Promise<void>` — single-flight; guards on signed-in + online; builds payload, POSTs, applies merged, persists last-synced, emits status. Coalesces concurrent calls (one re-run).
  - `isApplyingRemote(): boolean` — true while `applyMerged` runs (consumed by Task 12 to suppress trigger feedback loops).
  - `getLastSyncedAt(): Promise<number | null>`.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/sync/syncEngine.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const mockGetToken = jest.fn();
const mockApiPost = jest.fn();
const mockNetwork = jest.fn();

jest.mock("@/services/auth/authToken", () => ({ getAuthToken: () => mockGetToken() }));
jest.mock("@/services/apiClient", () => ({ apiPost: (...a: unknown[]) => mockApiPost(...a) }));
jest.mock("expo-network", () => ({ getNetworkStateAsync: () => mockNetwork() }));

import { syncNow, LAST_SYNCED_KEY } from "@/services/sync/syncEngine";

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGetToken.mockReset();
  mockApiPost.mockReset();
  mockNetwork.mockReset();
  mockNetwork.mockResolvedValue({ isConnected: true });
});

it("does nothing when signed out", async () => {
  mockGetToken.mockResolvedValue(null);
  await syncNow();
  expect(mockApiPost).not.toHaveBeenCalled();
});

it("does nothing when offline", async () => {
  mockGetToken.mockResolvedValue("jwt");
  mockNetwork.mockResolvedValue({ isConnected: false });
  await syncNow();
  expect(mockApiPost).not.toHaveBeenCalled();
});

it("posts payload and records last-synced on success", async () => {
  mockGetToken.mockResolvedValue("jwt");
  mockApiPost.mockResolvedValue({
    prayer_log: {}, habits: [], habit_log: {}, settings: {},
    syncedAt: "2026-06-20T00:00:00.000Z",
  });
  await syncNow();
  expect(mockApiPost).toHaveBeenCalledWith("/api/sync", expect.objectContaining({
    prayer_log: expect.any(Object), habits: expect.any(Array),
    habit_log: expect.any(Object), settings: expect.any(Object),
  }));
  expect(await AsyncStorage.getItem(LAST_SYNCED_KEY)).toBe(String(Date.parse("2026-06-20T00:00:00.000Z")));
});

it("coalesces concurrent calls into a single in-flight sync plus one rerun", async () => {
  mockGetToken.mockResolvedValue("jwt");
  let resolve!: (v: unknown) => void;
  mockApiPost.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const a = syncNow();
  const b = syncNow(); // should not start a second POST yet
  expect(mockApiPost).toHaveBeenCalledTimes(1);
  resolve({ prayer_log: {}, habits: [], habit_log: {}, settings: {}, syncedAt: "2026-06-20T00:00:00.000Z" });
  await a; await b;
  // one rerun fired because b arrived mid-flight
  expect(mockApiPost).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/syncEngine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `frontend/services/sync/syncEngine.ts`:

```typescript
import { DeviceEventEmitter } from "react-native";
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost } from "@/services/apiClient";
import { getAuthToken } from "@/services/auth/authToken";
import type { SyncPayload, SyncResponse } from "./types";
import { prayerLogAdapter } from "./adapters/prayerLogAdapter";
import { habitsAdapter } from "./adapters/habitsAdapter";
import { habitLogAdapter } from "./adapters/habitLogAdapter";
import { settingsAdapter } from "./adapters/settingsAdapter";

export const LAST_SYNCED_KEY = "sync:last_synced_v1";
export const SYNC_STATUS_EVENT = "SYNC_STATUS_UPDATED";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

let running = false;
let pendingRerun = false;
let applyingRemote = false;

export function isApplyingRemote(): boolean {
  return applyingRemote;
}

export async function getLastSyncedAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNCED_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function emitStatus(status: SyncStatus, lastSyncedAt?: number | null): void {
  DeviceEventEmitter.emit(SYNC_STATUS_EVENT, { status, lastSyncedAt });
}

async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected !== false;
  } catch {
    return true; // fail-open; the request itself will error and be retried
  }
}

export async function syncNow(_reason?: string): Promise<void> {
  const token = await getAuthToken();
  if (!token) return;
  if (!(await isOnline())) return;
  if (running) {
    pendingRerun = true;
    return;
  }
  running = true;
  emitStatus("syncing");
  try {
    const payload: SyncPayload = {
      prayer_log: await prayerLogAdapter.read(),
      habits: await habitsAdapter.read(),
      habit_log: await habitLogAdapter.read(),
      settings: await settingsAdapter.read(),
    };
    const res = await apiPost<SyncResponse>("/api/sync", payload);

    applyingRemote = true;
    try {
      await prayerLogAdapter.applyMerged(res.prayer_log);
      await habitsAdapter.applyMerged(res.habits);
      await habitLogAdapter.applyMerged(res.habit_log);
      await settingsAdapter.applyMerged(res.settings);
    } finally {
      applyingRemote = false;
    }

    const at = Date.parse(res.syncedAt);
    const stamp = Number.isFinite(at) ? at : Date.now();
    await AsyncStorage.setItem(LAST_SYNCED_KEY, String(stamp));
    emitStatus("success", stamp);
  } catch {
    emitStatus("error");
  } finally {
    running = false;
    if (pendingRerun) {
      pendingRerun = false;
      void syncNow("rerun");
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/services/sync/syncEngine.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/sync/syncEngine.ts frontend/__tests__/services/sync/syncEngine.test.ts
git commit -m "feat(sync): add single-flight sync engine core"
```

---

## Task 12: Frontend — triggers + stamp subscriptions (`useSyncEngine`)

**Files:**
- Create: `frontend/hooks/useSyncEngine.ts`
- Modify: `frontend/app/_layout.tsx`
- Test: `frontend/__tests__/hooks/useSyncEngine.test.tsx` (create)

**Interfaces:**
- Consumes: `useAuthState`, `syncNow`/`isApplyingRemote` from the engine, `SETTINGS_REGISTRY`, `bumpStamp`, the tracker change-event consts, `AppState`, `DeviceEventEmitter`.
- Produces: `useSyncEngine(): void` — mount-once hook that:
  1. On `isSignedIn` false→true, calls `syncNow("signin")`.
  2. On `AppState` → `"active"` (and `isSignedIn`), calls `syncNow("foreground")`.
  3. Subscribes to every trigger event (3 tracker events + each registry `changeEvent`); on fire, if not `isApplyingRemote()`, (a) for registry events, `bumpStamp(key)`; (b) schedule a **4s-debounced** `syncNow("change")`.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/hooks/useSyncEngine.test.tsx`:

```typescript
import { render, act } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";

const mockSyncNow = jest.fn();
const mockIsApplying = jest.fn(() => false);
const mockBump = jest.fn();
let authState = { isLoaded: true, isSignedIn: false, userId: null as string | null, email: null as string | null };

jest.mock("@/services/sync/syncEngine", () => ({
  syncNow: (...a: unknown[]) => mockSyncNow(...a),
  isApplyingRemote: () => mockIsApplying(),
}));
jest.mock("@/services/sync/settingsMeta", () => ({ bumpStamp: (...a: unknown[]) => mockBump(...a) }));
jest.mock("@/hooks/useAuthState", () => ({ useAuthState: () => authState }));

import { useSyncEngine } from "@/hooks/useSyncEngine";
import { PRAYER_LOG_UPDATED_EVENT } from "@/services/tracking/prayerLog";

function Host() { useSyncEngine(); return null; }

beforeEach(() => {
  jest.useFakeTimers();
  mockSyncNow.mockReset();
  mockBump.mockReset();
  mockIsApplying.mockReturnValue(false);
  authState = { isLoaded: true, isSignedIn: false, userId: null, email: null };
});
afterEach(() => { jest.useRealTimers(); });

it("syncs on sign-in transition", () => {
  const { rerender } = render(<Host />);
  expect(mockSyncNow).not.toHaveBeenCalled();
  authState = { ...authState, isSignedIn: true, userId: "u1" };
  rerender(<Host />);
  expect(mockSyncNow).toHaveBeenCalledWith("signin");
});

it("debounces change events into one sync after 4s", () => {
  authState = { ...authState, isSignedIn: true, userId: "u1" };
  render(<Host />);
  mockSyncNow.mockClear();
  act(() => { DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey: "x" }); });
  act(() => { DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey: "y" }); });
  expect(mockSyncNow).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(4000); });
  expect(mockSyncNow).toHaveBeenCalledTimes(1);
});

it("ignores change events while applying remote (no feedback loop)", () => {
  authState = { ...authState, isSignedIn: true, userId: "u1" };
  mockIsApplying.mockReturnValue(true);
  render(<Host />);
  mockSyncNow.mockClear();
  act(() => { DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey: "x" }); });
  act(() => { jest.advanceTimersByTime(4000); });
  expect(mockSyncNow).not.toHaveBeenCalled();
  expect(mockBump).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/hooks/useSyncEngine.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `frontend/hooks/useSyncEngine.ts`:

```typescript
import { useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter, type EmitterSubscription } from "react-native";
import { useAuthState } from "@/hooks/useAuthState";
import { syncNow, isApplyingRemote } from "@/services/sync/syncEngine";
import { SETTINGS_REGISTRY } from "@/services/sync/settingsRegistry";
import { bumpStamp } from "@/services/sync/settingsMeta";
import { PRAYER_LOG_UPDATED_EVENT } from "@/services/tracking/prayerLog";
import { HABIT_LOG_UPDATED_EVENT } from "@/services/tracking/habitLog";
import { HABITS_UPDATED_EVENT } from "@/services/tracking/habits";

const DEBOUNCE_MS = 4000;
const TRACKER_EVENTS = [PRAYER_LOG_UPDATED_EVENT, HABIT_LOG_UPDATED_EVENT, HABITS_UPDATED_EVENT];

export function useSyncEngine(): void {
  const { isSignedIn } = useAuthState();
  const wasSignedIn = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedInRef = useRef(isSignedIn);
  signedInRef.current = isSignedIn;

  // Sign-in transition.
  useEffect(() => {
    if (isSignedIn && !wasSignedIn.current) void syncNow("signin");
    wasSignedIn.current = isSignedIn;
  }, [isSignedIn]);

  // Foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && signedInRef.current) void syncNow("foreground");
    });
    return () => sub.remove();
  }, []);

  // Change events: stamp settings + debounced sync.
  useEffect(() => {
    const scheduleSync = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        debounce.current = null;
        if (signedInRef.current) void syncNow("change");
      }, DEBOUNCE_MS);
    };

    const subs: EmitterSubscription[] = [];

    for (const evt of TRACKER_EVENTS) {
      subs.push(DeviceEventEmitter.addListener(evt, () => {
        if (isApplyingRemote()) return;
        scheduleSync();
      }));
    }
    for (const entry of SETTINGS_REGISTRY) {
      subs.push(DeviceEventEmitter.addListener(entry.changeEvent, () => {
        if (isApplyingRemote()) return;
        void bumpStamp(entry.key);
        scheduleSync();
      }));
    }

    return () => {
      subs.forEach((s) => s.remove());
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);
}
```

(Note: `prayerSettings` and `quranDisplayModes` map to the same events used elsewhere — multiple registry entries never share an event here, so no double-bump. If two entries ever shared an event, both would bump, which is still correct.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/hooks/useSyncEngine.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount it in the root layout**

In `frontend/app/_layout.tsx`, inside the component that renders **inside** `<ClerkProvider>` (so `useAuthState` works), call `useSyncEngine()`. Find the existing inner component (the app already calls `AppState.addEventListener` there). Add:

```typescript
import { useSyncEngine } from "@/hooks/useSyncEngine";
// ...inside the inner component body, with the other hooks:
useSyncEngine();
```

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS. (If the screen-contract test in `__tests__/screens/screen-contracts.test.tsx` renders `_layout`, ensure its mocks cover `@/hooks/useSyncEngine` — add `jest.mock("@/hooks/useSyncEngine", () => ({ useSyncEngine: () => {} }))` if it fails.)

- [ ] **Step 7: Commit**

```bash
git add frontend/hooks/useSyncEngine.ts frontend/app/_layout.tsx frontend/__tests__/hooks/useSyncEngine.test.tsx
git commit -m "feat(sync): wire sync triggers (sign-in, foreground, debounced changes)"
```

---

## Task 13: Frontend — sync-status indicator

**Files:**
- Create: `frontend/hooks/useSyncStatus.ts`
- Modify: `frontend/components/settings/AccountSection.tsx`
- Test: `frontend/__tests__/hooks/useSyncStatus.test.tsx` (create)

**Interfaces:**
- Consumes: `SYNC_STATUS_EVENT`, `SyncStatus`, `getLastSyncedAt` from the engine.
- Produces: `useSyncStatus(): { status: SyncStatus; lastSyncedAt: number | null }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/hooks/useSyncStatus.test.tsx`:

```typescript
import { renderHook, act } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { SYNC_STATUS_EVENT } from "@/services/sync/syncEngine";

it("updates when a status event fires", () => {
  const { result } = renderHook(() => useSyncStatus());
  expect(result.current.status).toBe("idle");
  act(() => { DeviceEventEmitter.emit(SYNC_STATUS_EVENT, { status: "syncing" }); });
  expect(result.current.status).toBe("syncing");
  act(() => { DeviceEventEmitter.emit(SYNC_STATUS_EVENT, { status: "success", lastSyncedAt: 123 }); });
  expect(result.current.status).toBe("success");
  expect(result.current.lastSyncedAt).toBe(123);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/hooks/useSyncStatus.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the hook**

Create `frontend/hooks/useSyncStatus.ts`:

```typescript
import { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { SYNC_STATUS_EVENT, type SyncStatus, getLastSyncedAt } from "@/services/sync/syncEngine";

export function useSyncStatus(): { status: SyncStatus; lastSyncedAt: number | null } {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    void getLastSyncedAt().then((v) => { if (mounted) setLastSyncedAt(v); });
    const sub = DeviceEventEmitter.addListener(
      SYNC_STATUS_EVENT,
      (p: { status: SyncStatus; lastSyncedAt?: number | null }) => {
        setStatus(p.status);
        if (p.lastSyncedAt != null) setLastSyncedAt(p.lastSyncedAt);
      },
    );
    return () => { mounted = false; sub.remove(); };
  }, []);

  return { status, lastSyncedAt };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath __tests__/hooks/useSyncStatus.test.tsx`
Expected: PASS.

- [ ] **Step 5: Surface it in `AccountSection.tsx`**

Read `frontend/components/settings/AccountSection.tsx` first to match its theming (`useTheme()` + `createStyles`). When `useAuthState().isSignedIn`, render a subtle line below the account row using `useSyncStatus()`:

```typescript
const { status, lastSyncedAt } = useSyncStatus();
// label:
const syncLabel =
  status === "syncing" ? "Syncing…" :
  status === "error" ? "Sync failed — will retry" :
  lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` :
  "Not synced yet";
```

Render `syncLabel` in a small, muted `<Text>` (use the section's existing muted text style). Keep it subtle per the spec.

- [ ] **Step 6: Typecheck + commit**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

```bash
git add frontend/hooks/useSyncStatus.ts frontend/components/settings/AccountSection.tsx frontend/__tests__/hooks/useSyncStatus.test.tsx
git commit -m "feat(sync): add sync-status indicator in account settings"
```

---

## Task 14: Docs + full verification

**Files:**
- Modify: `CLAUDE.md`, `frontend/__tests__/README.md`, the design spec, `MEMORY.md` index.

- [ ] **Step 1: CLAUDE.md — new AsyncStorage keys + sync note**

In `CLAUDE.md` under the AsyncStorage Keys section, add a **Sync** group:

```markdown
**Sync:** `sync:settings_meta_v1` (per-setting LWW stamps `Record<settingKey, updatedAt>`), `sync:last_synced_v1` (last successful sync epoch-ms)
```

Add to the Auth bullet / a new Sync bullet under Key Conventions: the sync engine lives in `frontend/services/sync/`, runs only when signed-in + online, pushes the 4 domains (`prayer_log`, `habits`, `habit_log`, `settings`) to `POST /api/sync`, and applies the merged response. Device-specific `notif_*`/cache keys never sync.

- [ ] **Step 2: `frontend/__tests__/README.md`** — add the new suites (merge `mergeSettings`, replace setters, settingsMeta, settingsRegistry, settingsAdapter, trackerAdapters, syncEngine, useSyncEngine, useSyncStatus, theme/bookmarks/progress/ramadan/writePrayerSettings tests).

- [ ] **Step 3: Update the design spec status**

In `devDocs/superpowers/specs/2026-06-19-user-accounts-cloud-sync-design.md`, change the status line and Phase 3 entry to "shipped/in progress" as appropriate, and update the "Implementation status" note: name/email now populated by `ensureUser` from Clerk; Quran reading mode is not in scope (no service on this branch); settings stamping uses added change events on theme/bookmarks/progress/ramadan.

- [ ] **Step 4: MEMORY.md** — add a one-line pointer under the project memory index noting the sync engine location and the two new sync keys (no content, just the pointer line per memory rules).

- [ ] **Step 5: Full verification — frontend**

Run: `cd frontend && npm run verify`
Expected: lint + typecheck + all tests PASS. Fix any failures (likely: screen-contract mocks needing `useSyncEngine`; listener payload types).

- [ ] **Step 6: Full verification — backend**

Run: `cd backend && npm run lint && npm run build && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md frontend/__tests__/README.md devDocs/superpowers/specs/2026-06-19-user-accounts-cloud-sync-design.md "/Users/yassin/.claude/projects/-Users-yassin-work-Sirat/memory/MEMORY.md"
git commit -m "docs(sync): document Phase 3 sync engine, keys, and status"
```

---

## Self-Review notes (carry into execution)

- **Spec coverage:** auth (live), sync engine + adapters + triggers (Tasks 5–12), settings stamping (Tasks 6–9), single-flight/guards (Task 11), sign-in/foreground/debounce triggers (Task 12), edge cases (sign-in merges local up = first sync; sign-out keeps data = engine simply stops since `getAuthToken` returns null; account delete already handled), status indicator (Task 13), shared merge vector for `mergeSettings` (Task 3), name/email capture (Task 1, added requirement). Body limit / rate limit are backend, already live.
- **Out of scope (confirmed):** Quran reading mode (no service on `feat/auth`), notification preferences (spec defers them), `selectedCity` (covered by the `prayerSettings` blob).
- **Known acceptable behavior:** settings changed before the stamping mechanism existed carry stamp `0`, so a stamped cloud value wins on a returning user's new device. Documented; conservative and correct for multi-device.
- **Feedback-loop guard:** `isApplyingRemote()` gates both stamp-bumps and debounced re-syncs during `applyMerged`, preventing an apply→event→sync→apply ping-pong. Verified by the Task 12 test.
- **Before implementing, open each modified service** to confirm the actual cache-variable name, `persist`/`emit` helper names, and storage-key constant names — several code blocks above assume `cache`/`persist`/`emit`/`*_KEY` and must match the real file.
