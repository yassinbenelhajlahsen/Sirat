# Prayer & Habit Tracking — Foundation (Data + Services) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local data layer for prayer logging and habit tracking — types, storage services, pure stats/merge logic — fully unit-tested, with no UI yet.

**Architecture:** Follow the existing service convention (`services/quranDisplayModes.ts`): module-level sync cache + async load promise + `AsyncStorage` persistence + `DeviceEventEmitter` events. Every synced value is wrapped in a `Cell<T>` (`{ value, updatedAt }`) so a future cloud-sync layer can resolve conflicts with last-write-wins. Pure logic (`stats.ts`, `merge.ts`) is IO-free and tested in isolation.

**Tech Stack:** TypeScript, React Native 0.81 / Expo 54, `@react-native-async-storage/async-storage`, Jest (Babel-based, jest-expo). Path alias `@/` → `frontend/`.

**Plan series:** This is **Plan 1 of 4**. Later plans (not in this doc): (2) prayer-logging UI + Home/Calendar integration, (3) Tracker stats screen + habit management UI, (4) reminder notification service + display font polish. This plan ships a complete, testable data layer on its own.

**Source spec:** `docs/superpowers/specs/2026-06-19-prayer-habit-tracking-design.md`

## Global Constraints

- All commands run from `frontend/`. Path alias `@/` maps to `frontend/`.
- Frontend Jest is **Babel-based** — no dynamic `await import()`. Use static imports + top-level `jest.mock()`; for module-cache reset use the `loadService()` + `jest.resetModules()` + `require()` pattern (see `__tests__/services/quranDisplayModes.test.ts`).
- Versioned AsyncStorage keys — never rename without migration: `tracking:prayer_log_v1`, `tracking:habits_v1`, `tracking:habit_log_v1`.
- New `DeviceEventEmitter` events: `PRAYER_LOG_UPDATED` (`{ dateKey }`), `HABITS_UPDATED` (no payload), `HABIT_LOG_UPDATED` (`{ dateKey }`).
- Local date keys use the existing `dateKeyFromDate()` from `@/services/holidayService` (format `YYYY-MM-DD`, local time).
- Values persist as `Cell<T>`; reads unwrap to plain values and filter tombstoned (`deletedAt`) habits. Habit IDs are globally unique (uuid-style), never sequential.
- `Date.now()` is allowed at runtime; tests that assert timestamps mock it via `jest.spyOn(Date, "now")`.
- Verify with `npm run verify` (lint + typecheck + test) before the final commit.

---

### Task 1: Types and primitives

**Files:**
- Create: `frontend/services/tracking/types.ts`
- Create: `frontend/services/tracking/util.ts`
- Test: `frontend/__tests__/services/tracking/util.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha"`
  - `const PRAYER_NAMES: readonly PrayerName[]`
  - `type PrayerStatus = "prayed" | "late" | "missed"`
  - `type Cell<T> = { value: T; updatedAt: number }`
  - `type PrayerLog = Record<string, Partial<Record<PrayerName, Cell<PrayerStatus>>>>`
  - `type HabitFrequency = { type: "daily" } | { type: "weekly"; timesPerWeek: number }`
  - `type HabitReminder = { enabled: boolean; time?: string }`
  - `type Habit = { id: string; name: string; icon: string; frequency: HabitFrequency; reminder?: HabitReminder; order: number; archived: boolean; createdAtKey: string; updatedAt: number; deletedAt?: number }`
  - `type HabitLog = Record<string, Record<string, Cell<boolean>>>`
  - `newId(): string` and `nowMs(): number` from `util.ts`

- [ ] **Step 1: Write the types file**

```ts
// frontend/services/tracking/types.ts

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_NAMES: readonly PrayerName[] = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

export type PrayerStatus = "prayed" | "late" | "missed";

/** A synced value plus a last-modified stamp (epoch-ms) for LWW conflict resolution. */
export type Cell<T> = { value: T; updatedAt: number };

/** dateKey ("YYYY-MM-DD") -> prayer -> status cell. */
export type PrayerLog = Record<
  string,
  Partial<Record<PrayerName, Cell<PrayerStatus>>>
>;

export type HabitFrequency =
  | { type: "daily" }
  | { type: "weekly"; timesPerWeek: number };

export type HabitReminder = { enabled: boolean; time?: string };

export type Habit = {
  id: string;
  name: string;
  icon: string; // Ionicons glyph name
  frequency: HabitFrequency;
  reminder?: HabitReminder;
  order: number;
  archived: boolean;
  createdAtKey: string;
  updatedAt: number;
  deletedAt?: number; // tombstone for hard delete
};

/** dateKey -> habitId -> done cell. */
export type HabitLog = Record<string, Record<string, Cell<boolean>>>;
```

- [ ] **Step 2: Write the failing test for util**

```ts
// frontend/__tests__/services/tracking/util.test.ts
import { newId, nowMs } from "@/services/tracking/util";

describe("tracking/util", () => {
  it("newId returns a unique non-empty string each call", () => {
    const a = newId();
    const b = newId();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("nowMs returns the current epoch ms", () => {
    const spy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    expect(nowMs()).toBe(1700000000000);
    spy.mockRestore();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/util.test.ts`
Expected: FAIL — cannot find module `@/services/tracking/util`.

- [ ] **Step 4: Write the util implementation**

```ts
// frontend/services/tracking/util.ts

/** Epoch-ms wrapper so timestamps are mockable in tests. */
export function nowMs(): number {
  return Date.now();
}

/** RFC4122-ish v4 id. Not cryptographically strong; just collision-safe enough
 *  to keep two offline devices from minting the same habit id before sync. */
export function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/util.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/services/tracking/types.ts frontend/services/tracking/util.ts frontend/__tests__/services/tracking/util.test.ts
git commit -m "feat(tracking): add data types and id/time primitives"
```

---

### Task 2: Prayer log service

**Files:**
- Create: `frontend/services/tracking/prayerLog.ts`
- Test: `frontend/__tests__/services/tracking/prayerLog.test.ts`

**Interfaces:**
- Consumes: `PrayerLog`, `PrayerName`, `PrayerStatus`, `Cell` from `./types`; `nowMs` from `./util`.
- Produces:
  - `const PRAYER_LOG_STORAGE_KEY = "tracking:prayer_log_v1"`
  - `const PRAYER_LOG_UPDATED_EVENT = "PRAYER_LOG_UPDATED"`
  - `getPrayerLog(): Promise<PrayerLog>` (full raw map, cells intact)
  - `getDayStatuses(dateKey: string): Promise<Partial<Record<PrayerName, PrayerStatus>>>` (unwrapped)
  - `setPrayerStatus(dateKey: string, prayer: PrayerName, status: PrayerStatus): Promise<void>`
  - `clearPrayerStatus(dateKey: string, prayer: PrayerName): Promise<void>`
  - `getCachedPrayerLog(): PrayerLog`
  - `preloadPrayerLog(): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/services/tracking/prayerLog.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type Mod = typeof import("@/services/tracking/prayerLog");

function loadService(): Mod {
  jest.resetModules();
  return require("@/services/tracking/prayerLog") as Mod;
}

describe("tracking/prayerLog", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
  });

  it("returns empty statuses for an unlogged day", async () => {
    const svc = loadService();
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
  });

  it("sets a status, persists a cell, unwraps on read, and emits", async () => {
    const svc = loadService();
    const emit = jest.spyOn(DeviceEventEmitter, "emit");

    await svc.setPrayerStatus("2026-06-19", "fajr", "prayed");

    expect(await svc.getDayStatuses("2026-06-19")).toEqual({ fajr: "prayed" });
    const raw = JSON.parse(
      (await AsyncStorage.getItem("tracking:prayer_log_v1")) as string,
    );
    expect(raw["2026-06-19"].fajr).toEqual({ value: "prayed", updatedAt: 1700000000000 });
    expect(emit).toHaveBeenCalledWith("PRAYER_LOG_UPDATED", { dateKey: "2026-06-19" });
  });

  it("clears a status", async () => {
    const svc = loadService();
    await svc.setPrayerStatus("2026-06-19", "asr", "late");
    await svc.clearPrayerStatus("2026-06-19", "asr");
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
  });

  it("ignores malformed stored JSON and starts empty", async () => {
    await AsyncStorage.setItem("tracking:prayer_log_v1", "not-json");
    const svc = loadService();
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/prayerLog.test.ts`
Expected: FAIL — cannot find module `@/services/tracking/prayerLog`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/services/tracking/prayerLog.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import type { Cell, PrayerLog, PrayerName, PrayerStatus } from "./types";
import { nowMs } from "./util";

export const PRAYER_LOG_STORAGE_KEY = "tracking:prayer_log_v1";
export const PRAYER_LOG_UPDATED_EVENT = "PRAYER_LOG_UPDATED";

let cache: PrayerLog | null = null;
let loadPromise: Promise<PrayerLog> | null = null;

function emit(dateKey: string): void {
  try {
    DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey });
  } catch {
    // best-effort
  }
}

export async function getPrayerLog(): Promise<PrayerLog> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(PRAYER_LOG_STORAGE_KEY);
        cache = raw ? (JSON.parse(raw) as PrayerLog) : {};
      } catch {
        cache = {};
      } finally {
        loadPromise = null;
      }
      return cache as PrayerLog;
    })();
  }
  return loadPromise;
}

export function getCachedPrayerLog(): PrayerLog {
  return cache ?? {};
}

export async function preloadPrayerLog(): Promise<void> {
  await getPrayerLog();
}

export async function getDayStatuses(
  dateKey: string,
): Promise<Partial<Record<PrayerName, PrayerStatus>>> {
  const log = await getPrayerLog();
  const day = log[dateKey];
  if (!day) return {};
  const out: Partial<Record<PrayerName, PrayerStatus>> = {};
  for (const prayer of Object.keys(day) as PrayerName[]) {
    const cell = day[prayer];
    if (cell) out[prayer] = cell.value;
  }
  return out;
}

async function persist(log: PrayerLog): Promise<void> {
  try {
    await AsyncStorage.setItem(PRAYER_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // keep in-memory state even if persistence fails
  }
}

export async function setPrayerStatus(
  dateKey: string,
  prayer: PrayerName,
  status: PrayerStatus,
): Promise<void> {
  const log = await getPrayerLog();
  const day = log[dateKey] ?? {};
  const cell: Cell<PrayerStatus> = { value: status, updatedAt: nowMs() };
  log[dateKey] = { ...day, [prayer]: cell };
  cache = log;
  await persist(log);
  emit(dateKey);
}

export async function clearPrayerStatus(
  dateKey: string,
  prayer: PrayerName,
): Promise<void> {
  const log = await getPrayerLog();
  const day = log[dateKey];
  if (!day || !day[prayer]) return;
  const next = { ...day };
  delete next[prayer];
  if (Object.keys(next).length === 0) {
    delete log[dateKey];
  } else {
    log[dateKey] = next;
  }
  cache = log;
  await persist(log);
  emit(dateKey);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/prayerLog.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/tracking/prayerLog.ts frontend/__tests__/services/tracking/prayerLog.test.ts
git commit -m "feat(tracking): add prayer log service"
```

---

### Task 3: Habits service

**Files:**
- Create: `frontend/services/tracking/habits.ts`
- Test: `frontend/__tests__/services/tracking/habits.test.ts`

**Interfaces:**
- Consumes: `Habit`, `HabitFrequency`, `HabitReminder` from `./types`; `newId`, `nowMs` from `./util`.
- Produces:
  - `const HABITS_STORAGE_KEY = "tracking:habits_v1"`
  - `const HABITS_UPDATED_EVENT = "HABITS_UPDATED"`
  - `getAllHabits(): Promise<Habit[]>` (raw, includes archived + tombstoned)
  - `getActiveHabits(): Promise<Habit[]>` (not archived, not deleted, sorted by `order`)
  - `createHabit(input: { name: string; icon: string; frequency: HabitFrequency; reminder?: HabitReminder }): Promise<Habit>`
  - `updateHabit(id: string, patch: Partial<Pick<Habit, "name" | "icon" | "frequency" | "reminder" | "archived" | "order">>): Promise<void>`
  - `reorderHabits(orderedIds: string[]): Promise<void>`
  - `deleteHabit(id: string): Promise<void>` (sets `deletedAt` tombstone)

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/services/tracking/habits.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type Mod = typeof import("@/services/tracking/habits");

function loadService(): Mod {
  jest.resetModules();
  return require("@/services/tracking/habits") as Mod;
}

describe("tracking/habits", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
  });

  it("creates a habit with an id, stamps, and emits", async () => {
    const svc = loadService();
    const emit = jest.spyOn(DeviceEventEmitter, "emit");

    const h = await svc.createHabit({
      name: "Read Quran",
      icon: "book-outline",
      frequency: { type: "daily" },
    });

    expect(h.id).toBeTruthy();
    expect(h.archived).toBe(false);
    expect(h.order).toBe(0);
    expect(h.updatedAt).toBe(1700000000000);
    expect(emit).toHaveBeenCalledWith("HABITS_UPDATED");
    expect(await svc.getActiveHabits()).toHaveLength(1);
  });

  it("getActiveHabits excludes archived and tombstoned, sorted by order", async () => {
    const svc = loadService();
    const a = await svc.createHabit({ name: "A", icon: "i", frequency: { type: "daily" } });
    const b = await svc.createHabit({ name: "B", icon: "i", frequency: { type: "daily" } });
    const c = await svc.createHabit({ name: "C", icon: "i", frequency: { type: "daily" } });

    await svc.updateHabit(a.id, { archived: true });
    await svc.deleteHabit(b.id);

    const active = await svc.getActiveHabits();
    expect(active.map((h) => h.name)).toEqual(["C"]);
    expect((await svc.getAllHabits()).find((h) => h.id === b.id)?.deletedAt).toBe(1700000000000);
    void c;
  });

  it("reorderHabits rewrites order by id position", async () => {
    const svc = loadService();
    const a = await svc.createHabit({ name: "A", icon: "i", frequency: { type: "daily" } });
    const b = await svc.createHabit({ name: "B", icon: "i", frequency: { type: "daily" } });

    await svc.reorderHabits([b.id, a.id]);
    const active = await svc.getActiveHabits();
    expect(active.map((h) => h.name)).toEqual(["B", "A"]);
  });

  it("updateHabit patches fields and bumps updatedAt", async () => {
    const svc = loadService();
    const h = await svc.createHabit({ name: "A", icon: "i", frequency: { type: "daily" } });
    jest.spyOn(Date, "now").mockReturnValue(1700000050000);

    await svc.updateHabit(h.id, { name: "A2", frequency: { type: "weekly", timesPerWeek: 3 } });
    const updated = (await svc.getActiveHabits())[0];
    expect(updated.name).toBe("A2");
    expect(updated.frequency).toEqual({ type: "weekly", timesPerWeek: 3 });
    expect(updated.updatedAt).toBe(1700000050000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/habits.test.ts`
Expected: FAIL — cannot find module `@/services/tracking/habits`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/services/tracking/habits.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import type { Habit, HabitFrequency, HabitReminder } from "./types";
import { newId, nowMs } from "./util";

export const HABITS_STORAGE_KEY = "tracking:habits_v1";
export const HABITS_UPDATED_EVENT = "HABITS_UPDATED";

let cache: Habit[] | null = null;
let loadPromise: Promise<Habit[]> | null = null;

function emit(): void {
  try {
    DeviceEventEmitter.emit(HABITS_UPDATED_EVENT);
  } catch {
    // best-effort
  }
}

export async function getAllHabits(): Promise<Habit[]> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        cache = Array.isArray(parsed) ? (parsed as Habit[]) : [];
      } catch {
        cache = [];
      } finally {
        loadPromise = null;
      }
      return cache as Habit[];
    })();
  }
  return loadPromise;
}

export async function getActiveHabits(): Promise<Habit[]> {
  const all = await getAllHabits();
  return all
    .filter((h) => !h.archived && h.deletedAt == null)
    .sort((a, b) => a.order - b.order);
}

async function persist(habits: Habit[]): Promise<void> {
  cache = habits;
  try {
    await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
  } catch {
    // keep in-memory state even if persistence fails
  }
  emit();
}

function dateKeyNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export async function createHabit(input: {
  name: string;
  icon: string;
  frequency: HabitFrequency;
  reminder?: HabitReminder;
}): Promise<Habit> {
  const all = await getAllHabits();
  const maxOrder = all.reduce((m, h) => Math.max(m, h.order), -1);
  const ts = nowMs();
  const habit: Habit = {
    id: newId(),
    name: input.name,
    icon: input.icon,
    frequency: input.frequency,
    reminder: input.reminder,
    order: maxOrder + 1,
    archived: false,
    createdAtKey: dateKeyNow(),
    updatedAt: ts,
  };
  await persist([...all, habit]);
  return habit;
}

export async function updateHabit(
  id: string,
  patch: Partial<
    Pick<Habit, "name" | "icon" | "frequency" | "reminder" | "archived" | "order">
  >,
): Promise<void> {
  const all = await getAllHabits();
  const next = all.map((h) =>
    h.id === id ? { ...h, ...patch, updatedAt: nowMs() } : h,
  );
  await persist(next);
}

export async function reorderHabits(orderedIds: string[]): Promise<void> {
  const all = await getAllHabits();
  const ts = nowMs();
  const next = all.map((h) => {
    const idx = orderedIds.indexOf(h.id);
    return idx === -1 ? h : { ...h, order: idx, updatedAt: ts };
  });
  await persist(next);
}

export async function deleteHabit(id: string): Promise<void> {
  const all = await getAllHabits();
  const next = all.map((h) =>
    h.id === id ? { ...h, deletedAt: nowMs(), updatedAt: nowMs() } : h,
  );
  await persist(next);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/habits.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/tracking/habits.ts frontend/__tests__/services/tracking/habits.test.ts
git commit -m "feat(tracking): add habits service with tombstones"
```

---

### Task 4: Habit log service

**Files:**
- Create: `frontend/services/tracking/habitLog.ts`
- Test: `frontend/__tests__/services/tracking/habitLog.test.ts`

**Interfaces:**
- Consumes: `HabitLog`, `Cell` from `./types`; `nowMs` from `./util`.
- Produces:
  - `const HABIT_LOG_STORAGE_KEY = "tracking:habit_log_v1"`
  - `const HABIT_LOG_UPDATED_EVENT = "HABIT_LOG_UPDATED"`
  - `getHabitLog(): Promise<HabitLog>` (raw)
  - `getDayHabitDone(dateKey: string): Promise<Record<string, boolean>>` (unwrapped)
  - `setHabitDone(dateKey: string, habitId: string, done: boolean): Promise<void>`
  - `getCachedHabitLog(): HabitLog`
  - `preloadHabitLog(): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/services/tracking/habitLog.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type Mod = typeof import("@/services/tracking/habitLog");

function loadService(): Mod {
  jest.resetModules();
  return require("@/services/tracking/habitLog") as Mod;
}

describe("tracking/habitLog", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
  });

  it("returns empty for an unlogged day", async () => {
    const svc = loadService();
    expect(await svc.getDayHabitDone("2026-06-19")).toEqual({});
  });

  it("sets done, stores a cell, unwraps, and emits", async () => {
    const svc = loadService();
    const emit = jest.spyOn(DeviceEventEmitter, "emit");

    await svc.setHabitDone("2026-06-19", "h1", true);

    expect(await svc.getDayHabitDone("2026-06-19")).toEqual({ h1: true });
    const raw = JSON.parse(
      (await AsyncStorage.getItem("tracking:habit_log_v1")) as string,
    );
    expect(raw["2026-06-19"].h1).toEqual({ value: true, updatedAt: 1700000000000 });
    expect(emit).toHaveBeenCalledWith("HABIT_LOG_UPDATED", { dateKey: "2026-06-19" });
  });

  it("setting done=false keeps an explicit cell (so it syncs as a deliberate undo)", async () => {
    const svc = loadService();
    await svc.setHabitDone("2026-06-19", "h1", true);
    await svc.setHabitDone("2026-06-19", "h1", false);
    expect(await svc.getDayHabitDone("2026-06-19")).toEqual({ h1: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/habitLog.test.ts`
Expected: FAIL — cannot find module `@/services/tracking/habitLog`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/services/tracking/habitLog.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import type { Cell, HabitLog } from "./types";
import { nowMs } from "./util";

export const HABIT_LOG_STORAGE_KEY = "tracking:habit_log_v1";
export const HABIT_LOG_UPDATED_EVENT = "HABIT_LOG_UPDATED";

let cache: HabitLog | null = null;
let loadPromise: Promise<HabitLog> | null = null;

function emit(dateKey: string): void {
  try {
    DeviceEventEmitter.emit(HABIT_LOG_UPDATED_EVENT, { dateKey });
  } catch {
    // best-effort
  }
}

export async function getHabitLog(): Promise<HabitLog> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(HABIT_LOG_STORAGE_KEY);
        cache = raw ? (JSON.parse(raw) as HabitLog) : {};
      } catch {
        cache = {};
      } finally {
        loadPromise = null;
      }
      return cache as HabitLog;
    })();
  }
  return loadPromise;
}

export function getCachedHabitLog(): HabitLog {
  return cache ?? {};
}

export async function preloadHabitLog(): Promise<void> {
  await getHabitLog();
}

export async function getDayHabitDone(
  dateKey: string,
): Promise<Record<string, boolean>> {
  const log = await getHabitLog();
  const day = log[dateKey];
  if (!day) return {};
  const out: Record<string, boolean> = {};
  for (const habitId of Object.keys(day)) {
    out[habitId] = day[habitId].value;
  }
  return out;
}

export async function setHabitDone(
  dateKey: string,
  habitId: string,
  done: boolean,
): Promise<void> {
  const log = await getHabitLog();
  const day = log[dateKey] ?? {};
  const cell: Cell<boolean> = { value: done, updatedAt: nowMs() };
  log[dateKey] = { ...day, [habitId]: cell };
  cache = log;
  try {
    await AsyncStorage.setItem(HABIT_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // keep in-memory state even if persistence fails
  }
  emit(dateKey);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/habitLog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/tracking/habitLog.ts frontend/__tests__/services/tracking/habitLog.test.ts
git commit -m "feat(tracking): add habit log service"
```

---

### Task 5: Stats — prayer streak, monthly completion, qada

**Files:**
- Create: `frontend/services/tracking/stats.ts`
- Test: `frontend/__tests__/services/tracking/stats.prayer.test.ts`

**Interfaces:**
- Consumes: `PrayerLog`, `PrayerName`, `PrayerStatus`, `PRAYER_NAMES` from `./types`.
- Produces (pure functions; `todayKey` passed in so tests are deterministic):
  - `addDaysKey(dateKey: string, delta: number): string`
  - `isDayComplete(day: Partial<Record<PrayerName, PrayerStatus>> | undefined): boolean` — all 5 prayers present and not `"missed"`.
  - `prayerStreak(statusesByDay: Record<string, Partial<Record<PrayerName, PrayerStatus>>>, todayKey: string): number` — consecutive complete days counting back from today; today not counted against you if incomplete.
  - `monthlyCompletion(statusesByDay, year: number, monthIndex0: number): { overall: number; byPrayer: Record<PrayerName, number> }` — fraction 0..1 of (prayed|late) over elapsed prayer-slots in that month.
  - `qadaCount(statusesByDay): number` — total `"missed"` across all days.

  Note: `statusesByDay` here is the **unwrapped** shape (`Cell` already stripped). A helper `unwrapPrayerLog(log: PrayerLog)` is also exported for callers/facades.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/services/tracking/stats.prayer.test.ts
import {
  addDaysKey,
  isDayComplete,
  prayerStreak,
  monthlyCompletion,
  qadaCount,
  unwrapPrayerLog,
} from "@/services/tracking/stats";
import type { PrayerName, PrayerStatus } from "@/services/tracking/types";

const full = (s: PrayerStatus): Partial<Record<PrayerName, PrayerStatus>> => ({
  fajr: s, dhuhr: s, asr: s, maghrib: s, isha: s,
});

describe("tracking/stats prayer", () => {
  it("addDaysKey shifts a local date key", () => {
    expect(addDaysKey("2026-06-19", -1)).toBe("2026-06-18");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("isDayComplete requires all five non-missed", () => {
    expect(isDayComplete(full("prayed"))).toBe(true);
    expect(isDayComplete({ ...full("prayed"), isha: "missed" })).toBe(false);
    expect(isDayComplete({ fajr: "prayed" })).toBe(false);
    expect(isDayComplete(undefined)).toBe(false);
  });

  it("prayerStreak counts back, late still counts, missed breaks", () => {
    const days = {
      "2026-06-19": full("prayed"),
      "2026-06-18": full("late"),
      "2026-06-17": full("prayed"),
      "2026-06-16": { ...full("prayed"), asr: "missed" as PrayerStatus },
      "2026-06-15": full("prayed"),
    };
    expect(prayerStreak(days, "2026-06-19")).toBe(3);
  });

  it("prayerStreak does not penalize an incomplete today", () => {
    const days = {
      "2026-06-18": full("prayed"),
      "2026-06-17": full("prayed"),
      "2026-06-19": { fajr: "prayed" as PrayerStatus },
    };
    expect(prayerStreak(days, "2026-06-19")).toBe(2);
  });

  it("monthlyCompletion is fraction of non-missed logged slots", () => {
    const days = {
      "2026-06-01": full("prayed"),
      "2026-06-02": { ...full("prayed"), isha: "missed" as PrayerStatus },
    };
    const r = monthlyCompletion(days, 2026, 5);
    expect(r.overall).toBeCloseTo(9 / 10, 5);
    expect(r.byPrayer.isha).toBeCloseTo(1 / 2, 5);
    expect(r.byPrayer.fajr).toBeCloseTo(2 / 2, 5);
  });

  it("qadaCount totals missed prayers", () => {
    const days = {
      "2026-06-01": { ...full("prayed"), isha: "missed" as PrayerStatus },
      "2026-06-02": { fajr: "missed" as PrayerStatus, dhuhr: "missed" as PrayerStatus },
    };
    expect(qadaCount(days)).toBe(3);
  });

  it("unwrapPrayerLog strips cells", () => {
    expect(
      unwrapPrayerLog({ "2026-06-01": { fajr: { value: "prayed", updatedAt: 1 } } }),
    ).toEqual({ "2026-06-01": { fajr: "prayed" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/stats.prayer.test.ts`
Expected: FAIL — cannot find module `@/services/tracking/stats`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/services/tracking/stats.ts
import { PRAYER_NAMES } from "./types";
import type { PrayerLog, PrayerName, PrayerStatus } from "./types";

type DayStatuses = Partial<Record<PrayerName, PrayerStatus>>;
type StatusesByDay = Record<string, DayStatuses>;

/** Shift a "YYYY-MM-DD" local key by whole days. */
export function addDaysKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function isDayComplete(day: DayStatuses | undefined): boolean {
  if (!day) return false;
  return PRAYER_NAMES.every((p) => day[p] != null && day[p] !== "missed");
}

export function prayerStreak(
  statusesByDay: StatusesByDay,
  todayKey: string,
): number {
  let streak = 0;
  // If today is incomplete, start counting from yesterday (don't break the run).
  let cursor = isDayComplete(statusesByDay[todayKey])
    ? todayKey
    : addDaysKey(todayKey, -1);
  while (isDayComplete(statusesByDay[cursor])) {
    streak += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

export function monthlyCompletion(
  statusesByDay: StatusesByDay,
  year: number,
  monthIndex0: number,
): { overall: number; byPrayer: Record<PrayerName, number> } {
  const prefix = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-`;
  const loggedTotals = { count: 0, ok: 0 };
  const byPrayerCount = {} as Record<PrayerName, number>;
  const byPrayerOk = {} as Record<PrayerName, number>;
  for (const p of PRAYER_NAMES) {
    byPrayerCount[p] = 0;
    byPrayerOk[p] = 0;
  }
  for (const [dateKey, day] of Object.entries(statusesByDay)) {
    if (!dateKey.startsWith(prefix)) continue;
    for (const p of PRAYER_NAMES) {
      const status = day[p];
      if (status == null) continue;
      loggedTotals.count += 1;
      byPrayerCount[p] += 1;
      if (status !== "missed") {
        loggedTotals.ok += 1;
        byPrayerOk[p] += 1;
      }
    }
  }
  const byPrayer = {} as Record<PrayerName, number>;
  for (const p of PRAYER_NAMES) {
    byPrayer[p] = byPrayerCount[p] === 0 ? 0 : byPrayerOk[p] / byPrayerCount[p];
  }
  return {
    overall: loggedTotals.count === 0 ? 0 : loggedTotals.ok / loggedTotals.count,
    byPrayer,
  };
}

export function qadaCount(statusesByDay: StatusesByDay): number {
  let n = 0;
  for (const day of Object.values(statusesByDay)) {
    for (const p of PRAYER_NAMES) {
      if (day[p] === "missed") n += 1;
    }
  }
  return n;
}

export function unwrapPrayerLog(log: PrayerLog): StatusesByDay {
  const out: StatusesByDay = {};
  for (const [dateKey, day] of Object.entries(log)) {
    const unwrapped: DayStatuses = {};
    for (const p of Object.keys(day) as PrayerName[]) {
      const cell = day[p];
      if (cell) unwrapped[p] = cell.value;
    }
    out[dateKey] = unwrapped;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/stats.prayer.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/tracking/stats.ts frontend/__tests__/services/tracking/stats.prayer.test.ts
git commit -m "feat(tracking): add prayer streak/completion/qada stats"
```

---

### Task 6: Stats — habit streaks (daily + weekly)

**Files:**
- Modify: `frontend/services/tracking/stats.ts` (append functions)
- Test: `frontend/__tests__/services/tracking/stats.habit.test.ts`

**Interfaces:**
- Consumes: `addDaysKey` (from Task 5), `Habit`, `HabitFrequency` from `./types`.
- Produces:
  - `weekKey(dateKey: string): string` — ISO-ish year+week label; weeks start Sunday to match `WEEKDAYS` in Calendar.
  - `habitStreak(habit: Pick<Habit, "frequency">, doneByDay: Record<string, Record<string, boolean>>, habitId: string, todayKey: string): number` — daily: consecutive done days (today not penalized if not yet done); weekly: consecutive weeks meeting `timesPerWeek`, current week not penalized if target not yet met.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/services/tracking/stats.habit.test.ts
import { habitStreak, weekKey } from "@/services/tracking/stats";

describe("tracking/stats habit", () => {
  it("weekKey groups consecutive days into the same Sunday-started week", () => {
    // 2026-06-14 is a Sunday; 2026-06-20 is the following Saturday.
    expect(weekKey("2026-06-14")).toBe(weekKey("2026-06-20"));
    expect(weekKey("2026-06-14")).not.toBe(weekKey("2026-06-21"));
  });

  it("daily streak counts consecutive done days, today not penalized", () => {
    const done = {
      "2026-06-18": { h1: true },
      "2026-06-17": { h1: true },
      "2026-06-16": { h1: false },
    };
    expect(habitStreak({ frequency: { type: "daily" } }, done, "h1", "2026-06-19")).toBe(2);
  });

  it("daily streak counts today when done", () => {
    const done = { "2026-06-19": { h1: true }, "2026-06-18": { h1: true } };
    expect(habitStreak({ frequency: { type: "daily" } }, done, "h1", "2026-06-19")).toBe(2);
  });

  it("weekly streak counts weeks meeting the target", () => {
    // target 3x/week. Two full prior weeks meet it; current week has 1 so far (not penalized).
    const done = {
      // week of Jun 14-20 (current, today=Jun19): 1 done
      "2026-06-15": { h1: true },
      // week of Jun 7-13: 3 done
      "2026-06-08": { h1: true }, "2026-06-09": { h1: true }, "2026-06-10": { h1: true },
      // week of May 31-Jun 6: 3 done
      "2026-06-01": { h1: true }, "2026-06-02": { h1: true }, "2026-06-03": { h1: true },
    };
    expect(
      habitStreak({ frequency: { type: "weekly", timesPerWeek: 3 } }, done, "h1", "2026-06-19"),
    ).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/stats.habit.test.ts`
Expected: FAIL — `habitStreak`/`weekKey` not exported.

- [ ] **Step 3: Append the implementation to `stats.ts`**

```ts
// --- append to frontend/services/tracking/stats.ts ---
import type { Habit } from "./types";

/** Sunday-started week label "YYYY-Www" derived from the week's Sunday date key. */
export function weekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay()); // back up to Sunday
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(
    sunday.getDate(),
  ).padStart(2, "0")}`;
}

export function habitStreak(
  habit: Pick<Habit, "frequency">,
  doneByDay: Record<string, Record<string, boolean>>,
  habitId: string,
  todayKey: string,
): number {
  const isDone = (dateKey: string): boolean =>
    doneByDay[dateKey]?.[habitId] === true;

  if (habit.frequency.type === "daily") {
    let streak = 0;
    let cursor = isDone(todayKey) ? todayKey : addDaysKey(todayKey, -1);
    while (isDone(cursor)) {
      streak += 1;
      cursor = addDaysKey(cursor, -1);
    }
    return streak;
  }

  // weekly: count done-days per week, walk back over consecutive weeks meeting target.
  const target = habit.frequency.timesPerWeek;
  const perWeek = new Map<string, number>();
  for (const [dateKey, habits] of Object.entries(doneByDay)) {
    if (habits[habitId] === true) {
      const wk = weekKey(dateKey);
      perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1);
    }
  }
  const currentWeek = weekKey(todayKey);
  let streak = 0;
  // If current week hasn't hit target yet, don't penalize — start from last week.
  let cursorSunday =
    (perWeek.get(currentWeek) ?? 0) >= target
      ? currentWeek
      : addDaysKey(currentWeek, -7);
  while ((perWeek.get(cursorSunday) ?? 0) >= target) {
    streak += 1;
    cursorSunday = addDaysKey(cursorSunday, -7);
  }
  return streak;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/stats.habit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/tracking/stats.ts frontend/__tests__/services/tracking/stats.habit.test.ts
git commit -m "feat(tracking): add daily and weekly habit streaks"
```

---

### Task 7: Sync merge (last-write-wins)

**Files:**
- Create: `frontend/services/tracking/merge.ts`
- Test: `frontend/__tests__/services/tracking/merge.test.ts`

**Interfaces:**
- Consumes: `Cell`, `PrayerLog`, `HabitLog`, `Habit` from `./types`.
- Produces (pure):
  - `mergePrayerLogs(local: PrayerLog, remote: PrayerLog): PrayerLog` — per `(dateKey, prayer)` keep higher `updatedAt`.
  - `mergeHabitLogs(local: HabitLog, remote: HabitLog): HabitLog` — per `(dateKey, habitId)` keep higher `updatedAt`.
  - `mergeHabits(local: Habit[], remote: Habit[]): Habit[]` — by `id`, keep higher `updatedAt`; tombstoned entries retained so deletes propagate.

  This task exists for sync-readiness (Plan-series note); it is pure and unit-tested now, wired into a sync layer in a future plan.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/services/tracking/merge.test.ts
import { mergePrayerLogs, mergeHabitLogs, mergeHabits } from "@/services/tracking/merge";
import type { Habit } from "@/services/tracking/types";

describe("tracking/merge", () => {
  it("mergePrayerLogs keeps the higher updatedAt per cell", () => {
    const local = { "2026-06-19": { fajr: { value: "prayed" as const, updatedAt: 10 } } };
    const remote = {
      "2026-06-19": {
        fajr: { value: "late" as const, updatedAt: 20 },
        dhuhr: { value: "prayed" as const, updatedAt: 5 },
      },
    };
    expect(mergePrayerLogs(local, remote)).toEqual({
      "2026-06-19": {
        fajr: { value: "late", updatedAt: 20 },
        dhuhr: { value: "prayed", updatedAt: 5 },
      },
    });
  });

  it("mergeHabitLogs keeps the higher updatedAt per cell", () => {
    const local = { "2026-06-19": { h1: { value: true, updatedAt: 30 } } };
    const remote = { "2026-06-19": { h1: { value: false, updatedAt: 10 } } };
    expect(mergeHabitLogs(local, remote)).toEqual({
      "2026-06-19": { h1: { value: true, updatedAt: 30 } },
    });
  });

  it("mergeHabits keeps higher updatedAt and retains tombstones", () => {
    const base: Habit = {
      id: "h1", name: "A", icon: "i", frequency: { type: "daily" },
      order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 10,
    };
    const local = [base];
    const remote = [{ ...base, name: "A2", updatedAt: 20, deletedAt: 20 }];
    const merged = mergeHabits(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("A2");
    expect(merged[0].deletedAt).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/merge.test.ts`
Expected: FAIL — cannot find module `@/services/tracking/merge`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/services/tracking/merge.ts
import type { Cell, Habit, HabitLog, PrayerLog } from "./types";

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
    const prayers = new Set([...Object.keys(l), ...Object.keys(r)]) as Set<
      keyof typeof l
    >;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/merge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/tracking/merge.ts frontend/__tests__/services/tracking/merge.test.ts
git commit -m "feat(tracking): add last-write-wins sync merge helpers"
```

---

### Task 8: Facades, preload wiring, and docs

**Files:**
- Create: `frontend/services/prayerTracker.ts`
- Create: `frontend/services/habitTracker.ts`
- Modify: `frontend/app/_layout.tsx` (add preloads alongside existing preload calls)
- Modify: `CLAUDE.md` (AsyncStorage keys + events sections)
- Modify: `frontend/__tests__/README.md` (list new suites)

**Interfaces:**
- Consumes: everything from `services/tracking/*`.
- Produces: barrel facades `@/services/prayerTracker` and `@/services/habitTracker` re-exporting the service + stats surface; `preloadTracking()` called at app start.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/services/tracking/facades.test.ts
import * as prayerTracker from "@/services/prayerTracker";
import * as habitTracker from "@/services/habitTracker";

describe("tracking facades", () => {
  it("prayerTracker re-exports the prayer surface", () => {
    expect(typeof prayerTracker.setPrayerStatus).toBe("function");
    expect(typeof prayerTracker.getDayStatuses).toBe("function");
    expect(typeof prayerTracker.prayerStreak).toBe("function");
    expect(typeof prayerTracker.qadaCount).toBe("function");
    expect(typeof prayerTracker.preloadPrayerLog).toBe("function");
  });

  it("habitTracker re-exports the habit surface", () => {
    expect(typeof habitTracker.createHabit).toBe("function");
    expect(typeof habitTracker.getActiveHabits).toBe("function");
    expect(typeof habitTracker.setHabitDone).toBe("function");
    expect(typeof habitTracker.habitStreak).toBe("function");
    expect(typeof habitTracker.preloadHabitLog).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/facades.test.ts`
Expected: FAIL — cannot find module `@/services/prayerTracker`.

- [ ] **Step 3: Write the facades**

```ts
// frontend/services/prayerTracker.ts
export * from "./tracking/prayerLog";
export {
  addDaysKey,
  isDayComplete,
  prayerStreak,
  monthlyCompletion,
  qadaCount,
  unwrapPrayerLog,
} from "./tracking/stats";
export type { PrayerName, PrayerStatus, PrayerLog, Cell } from "./tracking/types";
export { PRAYER_NAMES } from "./tracking/types";
```

```ts
// frontend/services/habitTracker.ts
export * from "./tracking/habits";
export * from "./tracking/habitLog";
export { habitStreak, weekKey } from "./tracking/stats";
export type { Habit, HabitFrequency, HabitReminder, HabitLog } from "./tracking/types";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/facades.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire preloads into the root layout**

In `frontend/app/_layout.tsx`, locate the existing startup preload calls (e.g. `preloadQuranDisplayModes`, quran data preload). Add imports and call the two tracking preloads in the same place:

```ts
import { preloadPrayerLog } from "@/services/prayerTracker";
import { preloadHabitLog } from "@/services/habitTracker";
```

Add, alongside the other preloads (fire-and-forget, matching the existing style):

```ts
preloadPrayerLog();
preloadHabitLog();
```

(If existing preloads are `await`ed inside an async bootstrap effect, `await` these too; otherwise match the surrounding fire-and-forget pattern.)

- [ ] **Step 6: Update `CLAUDE.md`**

Under **AsyncStorage Keys**, add a new group:

```markdown
**Tracking:** `tracking:prayer_log_v1` (prayer status cells), `tracking:habits_v1` (habit definitions), `tracking:habit_log_v1` (habit completion cells). Values stored as `Cell<T>` = `{ value, updatedAt }` for sync LWW; habits carry `updatedAt` + optional `deletedAt` tombstone.
```

In the **DeviceEventEmitter** conventions line, add the new event names: `PRAYER_LOG_UPDATED`, `HABITS_UPDATED`, `HABIT_LOG_UPDATED`.

- [ ] **Step 7: Update `frontend/__tests__/README.md`**

Add a "tracking" section listing the new suites: `util`, `prayerLog`, `habits`, `habitLog`, `stats.prayer`, `stats.habit`, `merge`, `facades`.

- [ ] **Step 8: Run the full verify suite**

Run: `npm run verify`
Expected: lint clean, typecheck clean, all tests (including the 8 new tracking suites) pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/services/prayerTracker.ts frontend/services/habitTracker.ts frontend/app/_layout.tsx frontend/__tests__/services/tracking/facades.test.ts CLAUDE.md frontend/__tests__/README.md
git commit -m "feat(tracking): add facades, startup preload, and docs"
```

---

## Self-Review

**Spec coverage (this plan = data layer only):**
- Data model (`Cell<T>`, `PrayerLog`, `Habit`, `HabitLog`, frequency) → Task 1. ✓
- Prayer logging CRUD + events → Task 2. ✓
- Habit definitions (custom, flexible frequency, reorder, archive, tombstone) → Task 3. ✓
- Habit completion CRUD + events → Task 4. ✓
- Stats: prayer streak, monthly completion, qada → Task 5. ✓
- Stats: daily + weekly habit streaks → Task 6. ✓
- Sync-readiness merge (LWW, tombstones) → Task 7. ✓
- Facades + preload + storage/event docs → Task 8. ✓
- **Deferred to later plans (intentional, noted in header):** PrayerArc logging UI + Home/Calendar (Plan 2); Tracker screen + habit management UI + display font (Plan 3); reminder notification service (Plan 4). The reminder prefs key `tracking:reminder_prefs_v1` and `qada_resolved_v1` are introduced in their owning plans.

**Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output. ✓

**Type consistency:** `Cell<T>`, `PrayerName`, `PrayerStatus`, `Habit`, `HabitFrequency`, `HabitLog` defined in Task 1 and used unchanged in Tasks 2–8. `addDaysKey` defined in Task 5, reused in Task 6. `unwrapPrayerLog` (Task 5) feeds the unwrapped shape that `prayerStreak`/`monthlyCompletion`/`qadaCount` consume and that the facade re-exports. Facade re-exports match exported names. ✓
