# Prayer Window Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "window reminder" notification that fires a fixed number of minutes before the next prayer begins, only when the user has not logged the current prayer in the tracker.

**Architecture:** Extend the existing notification stack rather than build a parallel one. New device-local preferences (per-prayer on/off + one global "minutes before"), a scheduler that emits both at-prayer-time alerts and window reminders into a single candidate list sorted by fire time and capped under the iOS 64-notification limit, and a new subsection in the existing Notifications settings card. Suppression reads the prayer tracker at schedule time; logging a prayer already triggers a reschedule, which cancels its reminder.

**Tech Stack:** Expo 54, React Native 0.81, `expo-notifications`, AsyncStorage, Jest + `@testing-library/react-native`.

## Global Constraints

- **No native modules added** — `expo-notifications` is already installed, so this ships OTA (no new EAS build).
- **User-facing copy: simple text, no em dashes.** Applies to notification title/body and all UI strings.
- **Imports use the `@/` alias** (maps to `frontend/` root).
- **Run all commands from `frontend/`.** Verify command: `npm run verify` (lint + typecheck + test).
- **Eligible window prayers are exactly `Fajr`, `Dhuhr`, `Asr`, `Maghrib`.** Isha and Sunrise are never eligible.
- **Suppress a reminder if the prayer has any logged status** (`prayed`, `late`, or `missed`).
- **iOS pending-notification cap is 64; budget at 60** across both notification types combined.
- **Default state:** all four window toggles off, offset 15 min.

---

### Task 1: Window-reminder constants, types, and storage helpers

**Files:**
- Modify: `frontend/utils/notifications/constants.ts`
- Modify: `frontend/services/notifications/constants.ts`
- Modify: `frontend/services/notifications/storage.ts`
- Create: `frontend/__tests__/services/notifications/windowStorage.test.ts`

**Interfaces:**
- Produces: `WindowPrayerKey = "Fajr" | "Dhuhr" | "Asr" | "Maghrib"`; `WINDOW_PRAYERS: WindowPrayerKey[]`; `WindowPrefMap = Record<WindowPrayerKey, boolean>`; `DEFAULT_WINDOW_PREFS: WindowPrefMap` (all false); `WINDOW_OFFSET_OPTIONS = [5, 15, 20, 30]`; `DEFAULT_WINDOW_OFFSET = 15`; `STORAGE_WINDOW_MAP = "notif_window_map_v1"`; `STORAGE_WINDOW_OFFSET = "notif_window_offset_v1"`; `MAX_PENDING_NOTIFICATIONS = 60`; `readWindowMap(): Promise<WindowPrefMap>`; `readWindowOffset(): Promise<number>`.

- [ ] **Step 1: Add the constants and types**

In `frontend/utils/notifications/constants.ts`, append at the end of the file:

```ts
export type WindowPrayerKey = "Fajr" | "Dhuhr" | "Asr" | "Maghrib";

export const WINDOW_PRAYERS: WindowPrayerKey[] = [
  "Fajr",
  "Dhuhr",
  "Asr",
  "Maghrib",
];

export const WINDOW_OFFSET_OPTIONS = [5, 15, 20, 30] as const;

export const DEFAULT_WINDOW_OFFSET = 15;

export const STORAGE_WINDOW_MAP = "notif_window_map_v1";
export const STORAGE_WINDOW_OFFSET = "notif_window_offset_v1";

export type WindowPrefMap = Record<WindowPrayerKey, boolean>;

export const DEFAULT_WINDOW_PREFS: WindowPrefMap = WINDOW_PRAYERS.reduce(
  (acc, key) => {
    acc[key] = false;
    return acc;
  },
  {} as WindowPrefMap,
);
```

In `frontend/services/notifications/constants.ts`, append after the `HORIZON_DAYS` export:

```ts
// iOS keeps only the soonest-firing 64 pending local notifications per app and
// discards the rest; we budget at 60 (shared across at-prayer alerts and window
// reminders) to stay safely under the cap. See devDocs window-reminders spec.
export const MAX_PENDING_NOTIFICATIONS = 60;
```

- [ ] **Step 2: Add storage read helpers**

In `frontend/services/notifications/storage.ts`, add these imports to the existing block from `"../../utils/notifications/constants"`:

```ts
import {
  DEFAULT_WINDOW_OFFSET,
  DEFAULT_WINDOW_PREFS,
  STORAGE_ENABLED,
  STORAGE_MAP,
  STORAGE_SOUND_MODE,
  STORAGE_WINDOW_MAP,
  STORAGE_WINDOW_OFFSET,
  WINDOW_OFFSET_OPTIONS,
  WINDOW_PRAYERS,
  type WindowPrefMap,
} from "../../utils/notifications/constants";
```

Then append these functions to the file:

```ts
export async function readWindowMap(): Promise<WindowPrefMap> {
  const raw = await AsyncStorage.getItem(STORAGE_WINDOW_MAP);
  if (!raw) return { ...DEFAULT_WINDOW_PREFS };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: WindowPrefMap = { ...DEFAULT_WINDOW_PREFS };
    for (const key of WINDOW_PRAYERS) {
      if (typeof parsed[key] === "boolean") next[key] = parsed[key] as boolean;
    }
    return next;
  } catch {
    return { ...DEFAULT_WINDOW_PREFS };
  }
}

export async function readWindowOffset(): Promise<number> {
  const raw = await AsyncStorage.getItem(STORAGE_WINDOW_OFFSET);
  const value = raw ? parseInt(raw, 10) : NaN;
  return (WINDOW_OFFSET_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_WINDOW_OFFSET;
}
```

- [ ] **Step 3: Write the failing test**

Create `frontend/__tests__/services/notifications/windowStorage.test.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  readWindowMap,
  readWindowOffset,
} from "@/services/notifications/storage";
import {
  DEFAULT_WINDOW_OFFSET,
  DEFAULT_WINDOW_PREFS,
  STORAGE_WINDOW_MAP,
  STORAGE_WINDOW_OFFSET,
} from "@/utils/notifications/constants";

describe("notifications/storage window helpers", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns all-false defaults when no window map is stored", async () => {
    await expect(readWindowMap()).resolves.toEqual(DEFAULT_WINDOW_PREFS);
  });

  it("merges stored window prefs over defaults and ignores junk keys", async () => {
    await AsyncStorage.setItem(
      STORAGE_WINDOW_MAP,
      JSON.stringify({ Dhuhr: true, Sunrise: true, Asr: "bad" }),
    );
    await expect(readWindowMap()).resolves.toEqual({
      ...DEFAULT_WINDOW_PREFS,
      Dhuhr: true,
    });
  });

  it("returns the default offset when nothing is stored", async () => {
    await expect(readWindowOffset()).resolves.toBe(DEFAULT_WINDOW_OFFSET);
  });

  it("reads a valid stored offset and rejects out-of-set values", async () => {
    await AsyncStorage.setItem(STORAGE_WINDOW_OFFSET, "20");
    await expect(readWindowOffset()).resolves.toBe(20);

    await AsyncStorage.setItem(STORAGE_WINDOW_OFFSET, "13");
    await expect(readWindowOffset()).resolves.toBe(DEFAULT_WINDOW_OFFSET);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/notifications/windowStorage.test.ts`
Expected: PASS, 4 tests. (The implementation from Steps 1-2 is already in place, so this confirms it.)

- [ ] **Step 5: Update the test suite index**

In `frontend/__tests__/README.md`, add a line listing the new `services/notifications/windowStorage.test.ts` suite alongside the other notification test entries (match the existing format in that file).

- [ ] **Step 6: Commit**

```bash
git add frontend/utils/notifications/constants.ts frontend/services/notifications/constants.ts frontend/services/notifications/storage.ts frontend/__tests__/services/notifications/windowStorage.test.ts frontend/__tests__/README.md
git commit -m "feat(notifications): add window-reminder constants and storage helpers"
```

---

### Task 2: Scheduler — window-reminder candidates and global cap

**Files:**
- Modify: `frontend/services/notifications/scheduler.ts`
- Modify: `frontend/__tests__/services/notifications/scheduler.test.ts`

**Interfaces:**
- Consumes: `readWindowMap`/`readWindowOffset` are NOT used here; window prefs/offset arrive as params. `getDayStatuses(dateKey): Promise<Partial<Record<PrayerName, PrayerStatus>>>` from `@/services/tracking/prayerLog`. `MAX_PENDING_NOTIFICATIONS`, `WINDOW_PRAYERS`, `WindowPrayerKey`, `WindowPrefMap` from Task 1.
- Produces: `scheduleForHorizon` gains two required params: `windowPrefs: WindowPrefMap`, `windowOffset: number`.

- [ ] **Step 1: Write the failing tests**

Replace the contents of `frontend/__tests__/services/notifications/scheduler.test.ts` with the following (this updates existing calls to pass the new params and adds window-reminder coverage):

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  cancelPreviouslyScheduled,
  msUntilNextLocalMidnightPlus,
  scheduleForHorizon,
  yyyymmdd,
} from "@/services/notifications/scheduler";
import {
  STORAGE_SCHEDULE_IDS,
  STORAGE_SEEN_KEYS,
} from "@/services/notifications/constants";

jest.mock("@/services/prayerTimes", () => ({
  getPrayerTimesForDate: jest.fn(),
}));

jest.mock("@/services/tracking/prayerLog", () => ({
  getDayStatuses: jest.fn(async () => ({})),
}));

import { getPrayerTimesForDate } from "@/services/prayerTimes";
import { getDayStatuses } from "@/services/tracking/prayerLog";

const mockGetPrayerTimesForDate = getPrayerTimesForDate as jest.MockedFunction<
  typeof getPrayerTimesForDate
>;
const mockGetDayStatuses = getDayStatuses as jest.MockedFunction<
  typeof getDayStatuses
>;

function makePrefs(enabled = true) {
  return {
    Fajr: enabled,
    Sunrise: enabled,
    Dhuhr: enabled,
    Asr: enabled,
    Maghrib: enabled,
    Isha: enabled,
  };
}

const NO_WINDOW = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false };

const FULL_DAY = [
  { label: "Fajr", time: "05:00 AM" },
  { label: "Sunrise", time: "06:30 AM" },
  { label: "Dhuhr", time: "01:00 PM" },
  { label: "Asr", time: "05:30 PM" },
  { label: "Maghrib", time: "08:30 PM" },
  { label: "Isha", time: "10:00 PM" },
];

describe("notifications/scheduler", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockGetDayStatuses.mockResolvedValue({});
  });

  it("formats yyyymmdd deterministically", () => {
    expect(yyyymmdd(new Date(2026, 1, 3, 10, 11, 12))).toBe("2026-02-03");
  });

  it("computes ms until next local midnight plus offset", () => {
    freezeTestTime(new Date(2026, 0, 1, 23, 59, 0));
    const ms = msUntilNextLocalMidnightPlus(5);
    expect(ms).toBeGreaterThanOrEqual(1000);
    expect(ms).toBeLessThanOrEqual(6 * 60 * 1000);
    resetTestTime();
  });

  it("cancels all existing schedules and clears tracking storage", async () => {
    const cancelAll = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;
    const cancelOne = Notifications.cancelScheduledNotificationAsync as jest.Mock;

    await AsyncStorage.setItem(STORAGE_SCHEDULE_IDS, JSON.stringify(["id-a", "id-b"]));
    await AsyncStorage.setItem(STORAGE_SEEN_KEYS, JSON.stringify(["Fajr_2026-01-01T05:00"]));

    await cancelPreviouslyScheduled();

    expect(cancelAll).toHaveBeenCalledTimes(1);
    expect(cancelOne).toHaveBeenCalledTimes(2);
    await expect(AsyncStorage.getItem(STORAGE_SCHEDULE_IDS)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(STORAGE_SEEN_KEYS)).resolves.toBeNull();
  });

  it("prevents duplicate notifications across repeated schedule passes", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue([
      { label: "Fajr", time: "05:00 AM" },
    ] as any);

    const params = {
      days: 1,
      prefs: makePrefs(true),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default" as const,
      windowPrefs: NO_WINDOW,
      windowOffset: 15,
    };

    await scheduleForHorizon(params);
    await scheduleForHorizon(params);

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    resetTestTime();
  });

  it("skips past prayer times", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 6, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue([
      { label: "Fajr", time: "05:00 AM" },
    ] as any);

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(true),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: NO_WINDOW,
      windowOffset: 15,
    });

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    resetTestTime();
  });

  it("schedules a window reminder offset before the next prayer for an unlogged prayer", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
      windowOffset: 15,
    });

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.content.title).toBe("Dhuhr ending soon");
    expect(arg.content.body).toBe("Asr begins at 05:30 PM, in 15 min.");
    expect(arg.content.data.type).toBe("window_reminder");
    // Asr 5:30 PM minus 15 min = 5:15 PM.
    expect(new Date(arg.trigger.date).getHours()).toBe(17);
    expect(new Date(arg.trigger.date).getMinutes()).toBe(15);
    resetTestTime();
  });

  it("does not schedule a window reminder when the prayer is already logged", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);
    mockGetDayStatuses.mockResolvedValue({ dhuhr: "missed" });

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
      windowOffset: 15,
    });

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    resetTestTime();
  });

  it("uses Sunrise as Fajr's boundary with 'is at' phrasing", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: { Fajr: true, Dhuhr: false, Asr: false, Maghrib: false },
      windowOffset: 15,
    });

    const arg = scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.content.title).toBe("Fajr ending soon");
    expect(arg.content.body).toBe("Sunrise is at 06:30 AM, in 15 min.");
    resetTestTime();
  });

  it("never schedules a window reminder for Isha", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: { Fajr: false, Dhuhr: false, Asr: false, Maghrib: true },
      windowOffset: 15,
    });

    // Maghrib reminder (before Isha) is allowed; assert no reminder titled "Isha ending soon".
    const titles = scheduleNotificationAsync.mock.calls.map(
      (c) => c[0].content.title,
    );
    expect(titles).toContain("Maghrib ending soon");
    expect(titles).not.toContain("Isha ending soon");
    resetTestTime();
  });

  it("sorts candidates by fire time and caps the total at the pending budget", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 0, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 15, // 15 days x 6 prayers = 90 at-prayer candidates, over the 60 budget
      prefs: makePrefs(true),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: NO_WINDOW,
      windowOffset: 15,
    });

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(60);
    // First scheduled is the soonest (today's Fajr, 05:00 today).
    const firstDate = new Date(
      scheduleNotificationAsync.mock.calls[0][0].trigger.date,
    );
    const lastDate = new Date(
      scheduleNotificationAsync.mock.calls[59][0].trigger.date,
    );
    expect(firstDate.getTime()).toBeLessThan(lastDate.getTime());
    expect(firstDate.getHours()).toBe(5);
    resetTestTime();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --runTestsByPath __tests__/services/notifications/scheduler.test.ts`
Expected: FAIL — `scheduleForHorizon` does not yet accept `windowPrefs`/`windowOffset` and emits no window reminders.

- [ ] **Step 3: Rewrite the scheduler**

Replace the contents of `frontend/services/notifications/scheduler.ts` with:

```ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { PrayerSettings, PrayerTime } from "../prayerTimes";
import { getPrayerTimesForDate } from "../prayerTimes";
import { getDayStatuses } from "../tracking/prayerLog";
import type { PrayerName } from "../tracking/types";
import { MAX_PENDING_NOTIFICATIONS } from "./constants";
import {
  clearScheduleStorage,
  readScheduledIds,
  readSeenKeys,
  writeScheduledIds,
  writeSeenKeys,
} from "./storage";
import {
  IOS_SOUND_MAP,
  PRAYER_EMOJI,
  type PrefMap,
  type PrayerKey,
  type SoundMode,
} from "./types";
import {
  WINDOW_PRAYERS,
  type WindowPrayerKey,
  type WindowPrefMap,
} from "../../utils/notifications/constants";

type Candidate = {
  fireDate: Date;
  seenKey: string;
  content: Notifications.NotificationContentInput;
};

function parse12hToDate(base: Date, timeStr: string): Date {
  const [hm, ampm] = timeStr.split(" ");
  const [hStr, mStr] = hm.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

function makeSeenKey(label: PrayerKey, fireDate: Date): string {
  const key = fireDate.toISOString().slice(0, 16);
  return `${label}_${key}`;
}

function makeWindowSeenKey(label: PrayerKey, fireDate: Date): string {
  const key = fireDate.toISOString().slice(0, 16);
  return `window_${label}_${key}`;
}

function addDays(d: Date, offset: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 0, 0, 0, 0);
}

export function yyyymmdd(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function msUntilNextLocalMidnightPlus(minutes: number): number {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    minutes,
    0,
    0,
  );
  return Math.max(1000, next.getTime() - now.getTime());
}

export async function cancelPreviouslyScheduled() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // no-op
  }

  const ids = await readScheduledIds();
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {
        // no-op
      }),
    ),
  );

  await clearScheduleStorage();
}

export async function scheduleForHorizon(params: {
  days: number;
  prefs: PrefMap;
  cityDisplay: string;
  effective: PrayerSettings;
  soundMode: SoundMode;
  windowPrefs: WindowPrefMap;
  windowOffset: number;
}) {
  const {
    days,
    prefs,
    cityDisplay,
    effective,
    soundMode,
    windowPrefs,
    windowOffset,
  } = params;
  const now = Date.now();

  const seen = new Set<string>(await readSeenKeys());
  const idsToPersist: string[] = [...(await readScheduledIds())];

  const iosSound = IOS_SOUND_MAP[soundMode] ?? "default";
  const triggerSound = Platform.OS === "ios" ? iosSound : "default";

  const anyWindowEnabled = WINDOW_PRAYERS.some((key) => windowPrefs[key]);

  const candidates: Candidate[] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const day = addDays(new Date(), dayOffset);
    const dayKey = yyyymmdd(day);
    const times: PrayerTime[] = await getPrayerTimesForDate(effective, day);

    // At-prayer-time alerts.
    for (const prayer of times) {
      const label = prayer.label as PrayerKey;
      if (!prefs[label]) continue;
      const fireDate = parse12hToDate(day, prayer.time);
      if (fireDate.getTime() <= now) continue;
      candidates.push({
        fireDate,
        seenKey: makeSeenKey(label, fireDate),
        content: {
          title: `${PRAYER_EMOJI[label] || "🕌"} ${label} time`,
          body: `${prayer.time} in ${cityDisplay}`,
          sound: triggerSound,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: "prayer",
            label,
            timeLocal: prayer.time,
            city: cityDisplay,
            dayKey,
          },
        },
      });
    }

    // Window reminders.
    if (anyWindowEnabled) {
      const dayStatuses = await getDayStatuses(dayKey);
      for (let i = 0; i < times.length; i++) {
        const label = times[i].label as PrayerKey;
        if (!WINDOW_PRAYERS.includes(label as WindowPrayerKey)) continue;
        if (!windowPrefs[label as WindowPrayerKey]) continue;
        const next = times[i + 1];
        if (!next) continue;
        if (dayStatuses[label.toLowerCase() as PrayerName]) continue;
        const fireDate = new Date(
          parse12hToDate(day, next.time).getTime() - windowOffset * 60_000,
        );
        if (fireDate.getTime() <= now) continue;
        const verb = next.label === "Sunrise" ? "is" : "begins";
        candidates.push({
          fireDate,
          seenKey: makeWindowSeenKey(label, fireDate),
          content: {
            title: `${label} ending soon`,
            body: `${next.label} ${verb} at ${next.time}, in ${windowOffset} min.`,
            sound: triggerSound,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              type: "window_reminder",
              label,
              nextLabel: next.label,
              nextTimeLocal: next.time,
              offset: windowOffset,
              dayKey,
            },
          },
        });
      }
    }
  }

  candidates.sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime());

  let remaining = MAX_PENDING_NOTIFICATIONS - idsToPersist.length;

  for (const candidate of candidates) {
    if (remaining <= 0) break;
    if (seen.has(candidate.seenKey)) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: candidate.content,
      trigger: { type: "date", date: candidate.fireDate } as any,
    });
    seen.add(candidate.seenKey);
    idsToPersist.push(id);
    remaining--;
  }

  await writeScheduledIds(idsToPersist);
  await writeSeenKeys(Array.from(seen));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/services/notifications/scheduler.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/notifications/scheduler.ts frontend/__tests__/services/notifications/scheduler.test.ts
git commit -m "feat(notifications): emit window reminders and cap pending notifications"
```

---

### Task 3: Orchestrator wiring in rescheduleAll

**Files:**
- Modify: `frontend/services/notificationService.ts`
- Modify: `frontend/__tests__/services/notificationService.test.ts`

**Interfaces:**
- Consumes: `readWindowMap`/`readWindowOffset` (Task 1); `scheduleForHorizon` with `windowPrefs`/`windowOffset` (Task 2).
- Produces: no new exports; `rescheduleAll` now reads window prefs/offset, passes them to `scheduleForHorizon`, and folds them into the schedule fingerprint.

- [ ] **Step 1: Write the failing test**

In `frontend/__tests__/services/notificationService.test.ts`, make these edits:

(a) Add `readWindowMap` and `readWindowOffset` to the `mocks` type in `NotificationServiceSetup`:

```ts
    readWindowMap: jest.Mock;
    readWindowOffset: jest.Mock;
```

(b) Add their default implementations inside the `mocks` object in `loadNotificationService` (next to `readSoundMode`):

```ts
    readWindowMap: jest.fn(async () => ({
      Fajr: false,
      Dhuhr: true,
      Asr: false,
      Maghrib: false,
    })),
    readWindowOffset: jest.fn(async () => 15),
```

(c) Add them to the storage `jest.doMock` factory:

```ts
  jest.doMock("@/services/notifications/storage", () => ({
    readDayFingerprint: mocks.readDayFingerprint,
    readMasterEnabled: mocks.readMasterEnabled,
    readPrefs: mocks.readPrefs,
    readPrayerSettings: mocks.readPrayerSettings,
    readSoundMode: mocks.readSoundMode,
    readWindowMap: mocks.readWindowMap,
    readWindowOffset: mocks.readWindowOffset,
    writeDayFingerprint: mocks.writeDayFingerprint,
  }));
```

(d) Add a new test inside the `describe` block:

```ts
  it("passes window preferences and offset through to scheduleForHorizon", async () => {
    const { NotificationService, mocks } = await loadNotificationService({
      readDayFingerprint: jest.fn(async () => "old-key"),
    });

    await NotificationService.rescheduleAll("init");

    expect(mocks.scheduleForHorizon).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleForHorizon.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
        windowOffset: 15,
      }),
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/notificationService.test.ts -t "passes window preferences"`
Expected: FAIL — `scheduleForHorizon` is called without `windowPrefs`/`windowOffset`.

- [ ] **Step 3: Wire window prefs into rescheduleAll**

In `frontend/services/notificationService.ts`:

(a) Add `readWindowMap` and `readWindowOffset` to the import from `"./notifications/storage"`:

```ts
import {
  readDayFingerprint,
  readMasterEnabled,
  readPrefs,
  readPrayerSettings,
  readSoundMode,
  readWindowMap,
  readWindowOffset,
  writeDayFingerprint,
} from "./notifications/storage";
```

(b) Extend `buildScheduleFingerprint` to accept and include the window inputs. Change its params type and return string:

```ts
function buildScheduleFingerprint(params: {
  dayKey: string;
  prefs: Awaited<ReturnType<typeof readPrefs>>;
  cityDisplay: string;
  soundMode: Awaited<ReturnType<typeof readSoundMode>>;
  times: Awaited<ReturnType<typeof getPrayerTimesToday>>;
  effective: Awaited<ReturnType<typeof deriveEffectiveSettings>>;
  windowPrefs: Awaited<ReturnType<typeof readWindowMap>>;
  windowOffset: Awaited<ReturnType<typeof readWindowOffset>>;
}): string {
  const {
    dayKey,
    prefs,
    cityDisplay,
    soundMode,
    times,
    effective,
    windowPrefs,
    windowOffset,
  } = params;

  const timesFingerprint = JSON.stringify(times.map((t) => [t.label, t.time]));
  const effectiveFingerprint = JSON.stringify({
    useLocation: effective.useLocation,
    city: effective.city
      ? {
          n: effective.city.name,
          lat: effective.city.lat,
          lng: effective.city.lng,
        }
      : null,
  });

  return `day_${dayKey}_${JSON.stringify(prefs)}_${cityDisplay}_${timesFingerprint}_${effectiveFingerprint}_${soundMode}_${JSON.stringify(windowPrefs)}_${windowOffset}`;
}
```

(c) In `rescheduleAll`, after `const soundMode = await readSoundMode();`, add:

```ts
      const windowPrefs = await readWindowMap();
      const windowOffset = await readWindowOffset();
```

(d) Pass the new values into the `buildScheduleFingerprint` call:

```ts
      const nextKey = buildScheduleFingerprint({
        dayKey: today,
        prefs,
        cityDisplay,
        soundMode,
        times: todayTimes,
        effective,
        windowPrefs,
        windowOffset,
      });
```

(e) Pass the new values into BOTH `scheduleForHorizon` calls (the heavy-rebuild branch and the incremental branch). Each call becomes:

```ts
        await scheduleForHorizon({
          days: HORIZON_DAYS,
          prefs,
          cityDisplay,
          effective,
          soundMode,
          windowPrefs,
          windowOffset,
        });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/notificationService.test.ts`
Expected: PASS, all tests (the new one plus the five existing ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/notificationService.ts frontend/__tests__/services/notificationService.test.ts
git commit -m "feat(notifications): read window prefs in rescheduleAll and fingerprint them"
```

---

### Task 4: Preferences hook

**Files:**
- Modify: `frontend/hooks/useNotificationPreferences.ts`
- Modify: `frontend/__tests__/hooks/useNotificationPreferences.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_WINDOW_PREFS`, `DEFAULT_WINDOW_OFFSET`, `STORAGE_WINDOW_MAP`, `STORAGE_WINDOW_OFFSET`, `WINDOW_OFFSET_OPTIONS`, `WINDOW_PRAYERS`, `WindowPrayerKey`, `WindowPrefMap` (Task 1).
- Produces: hook return gains `windowPrefs: WindowPrefMap`, `windowOffset: number`, `setWindowPreference(key: WindowPrayerKey, value: boolean): Promise<void>`, `setWindowOffset(minutes: number): Promise<void>`. The `NOTIF_PREFS_UPDATED` payload gains `windowPrefs` and `windowOffset`.

- [ ] **Step 1: Write the failing test**

In `frontend/__tests__/hooks/useNotificationPreferences.test.ts`, add `STORAGE_WINDOW_MAP`, `STORAGE_WINDOW_OFFSET`, and `DEFAULT_WINDOW_PREFS` to the import from `@/utils/notifications/constants`, then add these two tests inside the `describe` block:

```ts
  it("hydrates window prefs and offset from storage", async () => {
    await AsyncStorage.multiSet([
      [STORAGE_ENABLED, "1"],
      [STORAGE_WINDOW_MAP, JSON.stringify({ Dhuhr: true, Sunrise: true })],
      [STORAGE_WINDOW_OFFSET, "20"],
    ]);

    const { result } = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.windowPrefs).toEqual({
      ...DEFAULT_WINDOW_PREFS,
      Dhuhr: true,
    });
    expect(result.current.windowOffset).toBe(20);
  });

  it("persists window preference updates and emits payload", async () => {
    await AsyncStorage.setItem(STORAGE_ENABLED, "1");
    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    const { result } = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.enabled).toBe(true);
    });

    emitSpy.mockClear();

    await act(async () => {
      await result.current.setWindowPreference("Asr", true);
    });

    expect(
      JSON.parse((await AsyncStorage.getItem(STORAGE_WINDOW_MAP)) || "{}"),
    ).toEqual(expect.objectContaining({ Asr: true }));
    expect(emitSpy).toHaveBeenCalledWith(
      NOTIF_PREFS_UPDATED_EVENT,
      expect.objectContaining({
        windowPrefs: expect.objectContaining({ Asr: true }),
      }),
    );

    emitSpy.mockClear();

    await act(async () => {
      await result.current.setWindowOffset(30);
    });

    expect(await AsyncStorage.getItem(STORAGE_WINDOW_OFFSET)).toBe("30");
    expect(result.current.windowOffset).toBe(30);
    expect(emitSpy).toHaveBeenCalledWith(
      NOTIF_PREFS_UPDATED_EVENT,
      expect.objectContaining({ windowOffset: 30 }),
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --runTestsByPath __tests__/hooks/useNotificationPreferences.test.ts`
Expected: FAIL — `windowPrefs`, `windowOffset`, and the setters do not exist yet.

- [ ] **Step 3: Extend the hook**

In `frontend/hooks/useNotificationPreferences.ts`:

(a) Extend the import from `"../utils/notifications/constants"` to add:

```ts
  DEFAULT_WINDOW_OFFSET,
  DEFAULT_WINDOW_PREFS,
  STORAGE_WINDOW_MAP,
  STORAGE_WINDOW_OFFSET,
  WINDOW_OFFSET_OPTIONS,
  WINDOW_PRAYERS,
  WindowPrayerKey,
  WindowPrefMap,
```

(b) Replace the `emitPreferences` signature and body so the payload carries the window fields:

```ts
function parseWindowPrefs(raw: string | null): WindowPrefMap {
  const next = { ...DEFAULT_WINDOW_PREFS };
  if (!raw) return next;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of WINDOW_PRAYERS) {
      if (typeof parsed[key] === "boolean") next[key] = parsed[key] as boolean;
    }
  } catch {
    // ignore malformed JSON
  }
  return next;
}

function parseWindowOffset(raw: string | null): number {
  const value = raw ? parseInt(raw, 10) : NaN;
  return (WINDOW_OFFSET_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_WINDOW_OFFSET;
}

function emitPreferences(payload: {
  enabled: boolean;
  prefs: Record<PrayerKey, boolean>;
  soundMode: SoundMode;
  windowPrefs: WindowPrefMap;
  windowOffset: number;
}) {
  try {
    DeviceEventEmitter.emit(NOTIF_PREFS_UPDATED_EVENT, payload);
  } catch {
    // ignore emit errors
  }
}
```

(c) Add state and refs after the existing `soundMode` state/refs:

```ts
  const [windowPrefs, setWindowPrefs] = useState<WindowPrefMap>(() => ({
    ...DEFAULT_WINDOW_PREFS,
  }));
  const [windowOffset, setWindowOffsetState] = useState<number>(
    DEFAULT_WINDOW_OFFSET,
  );

  const windowPrefsRef = useRef<WindowPrefMap>({ ...DEFAULT_WINDOW_PREFS });
  const windowOffsetRef = useRef<number>(DEFAULT_WINDOW_OFFSET);
```

(d) In the hydration `useEffect`, add `STORAGE_WINDOW_MAP` and `STORAGE_WINDOW_OFFSET` to the `multiGet` array, and after the sound hydration block add:

```ts
        const rawWindowMap = entries.find(
          ([key]) => key === STORAGE_WINDOW_MAP,
        )?.[1];
        const nextWindowPrefs = parseWindowPrefs(rawWindowMap ?? null);
        windowPrefsRef.current = nextWindowPrefs;
        setWindowPrefs(nextWindowPrefs);

        const rawWindowOffset = entries.find(
          ([key]) => key === STORAGE_WINDOW_OFFSET,
        )?.[1];
        const nextWindowOffset = parseWindowOffset(rawWindowOffset ?? null);
        windowOffsetRef.current = nextWindowOffset;
        setWindowOffsetState(nextWindowOffset);
```

(e) Keep the refs in sync — add two effects next to the existing `prefsRef`/`soundModeRef` sync effects:

```ts
  useEffect(() => {
    windowPrefsRef.current = windowPrefs;
  }, [windowPrefs]);

  useEffect(() => {
    windowOffsetRef.current = windowOffset;
  }, [windowOffset]);
```

(f) Update EVERY existing `emitPreferences({ ... })` call (there are three: the enabled-change effect, `setPrayerPreference`, and `updateSoundMode`) to include the window fields. For example the enabled-change effect becomes:

```ts
    emitPreferences({
      enabled,
      prefs: prefsRef.current,
      soundMode: soundModeRef.current,
      windowPrefs: windowPrefsRef.current,
      windowOffset: windowOffsetRef.current,
    });
```

Apply the same two added lines (`windowPrefs: windowPrefsRef.current, windowOffset: windowOffsetRef.current`) to the `emitPreferences` calls inside `setPrayerPreference` and `updateSoundMode`.

(g) Add the two new setters before the `return`:

```ts
  const setWindowPreference = useCallback(
    async (key: WindowPrayerKey, value: boolean) => {
      const next = { ...windowPrefsRef.current, [key]: value };
      windowPrefsRef.current = next;
      setWindowPrefs(next);
      try {
        await AsyncStorage.setItem(STORAGE_WINDOW_MAP, JSON.stringify(next));
      } catch {
        // ignore persist errors
      }
      emitPreferences({
        enabled,
        prefs: prefsRef.current,
        soundMode: soundModeRef.current,
        windowPrefs: next,
        windowOffset: windowOffsetRef.current,
      });
    },
    [enabled],
  );

  const setWindowOffset = useCallback(
    async (minutes: number) => {
      if (minutes === windowOffsetRef.current) return;
      windowOffsetRef.current = minutes;
      setWindowOffsetState(minutes);
      try {
        await AsyncStorage.setItem(STORAGE_WINDOW_OFFSET, String(minutes));
      } catch {
        // ignore persist errors
      }
      emitPreferences({
        enabled,
        prefs: prefsRef.current,
        soundMode: soundModeRef.current,
        windowPrefs: windowPrefsRef.current,
        windowOffset: minutes,
      });
    },
    [enabled],
  );
```

(h) Add the four new values to the returned object:

```ts
  return {
    loaded,
    enabled,
    prefs,
    soundMode,
    windowPrefs,
    windowOffset,
    setPrayerPreference,
    updateSoundMode,
    setWindowPreference,
    setWindowOffset,
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/hooks/useNotificationPreferences.test.ts`
Expected: PASS, all tests (new and existing).

- [ ] **Step 5: Commit**

```bash
git add frontend/hooks/useNotificationPreferences.ts frontend/__tests__/hooks/useNotificationPreferences.test.ts
git commit -m "feat(notifications): manage window reminder prefs in useNotificationPreferences"
```

---

### Task 5: Settings UI subsection

**Files:**
- Modify: `frontend/components/NotificationSettings.tsx`
- Modify: `frontend/__tests__/components/notification-settings.contract.test.tsx`

**Interfaces:**
- Consumes: the extended hook return from Task 4 (`windowPrefs`, `windowOffset`, `setWindowPreference`, `setWindowOffset`); `WINDOW_PRAYERS`, `WINDOW_OFFSET_OPTIONS`, `WindowPrayerKey` (Task 1).
- Produces: a "Window reminders" subsection rendered between "Prayer Alerts" and "Adhan sound", reusing existing styles. Note: the offset segment is a simple selected-background segmented control (no sliding-indicator animation) to keep scope contained; this is a deliberate simplification of the Adhan segment.

- [ ] **Step 1: Write the failing UI contract tests**

In `frontend/__tests__/components/notification-settings.contract.test.tsx`:

(a) Add `WINDOW_PRAYERS` and `WINDOW_OFFSET_OPTIONS` to the import from `@/utils/notifications/constants`, plus a `setWindowPreference`/`setWindowOffset` jest.fn near the other mock fns:

```ts
const setWindowPreference = jest.fn(async () => {});
const setWindowOffset = jest.fn(async () => {});
```

(b) In `configureHookMocks`, add `windowPrefs`, `windowOffset`, and the two setters to the `mockUseNotificationPreferences.mockReturnValue({ ... })` object:

```ts
    windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
    windowOffset: 15,
    setWindowPreference,
    setWindowOffset,
```

(c) Add these tests inside the `describe` block:

```ts
  it("renders the window reminders subsection with prayer toggles and offsets", () => {
    const { getByText, getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />,
    );

    expect(getByText("Window reminders")).toBeTruthy();
    WINDOW_PRAYERS.forEach((p) => {
      expect(getByLabelText(`${p} window reminder`)).toBeTruthy();
    });
    WINDOW_OFFSET_OPTIONS.forEach((n) => {
      expect(getByLabelText(`${n} minutes before`)).toBeTruthy();
    });
  });

  it("wires the window prayer toggle when enabled", async () => {
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />,
    );

    fireEvent.press(getByLabelText("Asr window reminder"));

    await waitFor(() =>
      expect(setWindowPreference).toHaveBeenCalledWith("Asr", true),
    );
  });

  it("wires the window offset selection when enabled", async () => {
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />,
    );

    fireEvent.press(getByLabelText("30 minutes before"));

    await waitFor(() => expect(setWindowOffset).toHaveBeenCalledWith(30));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --runTestsByPath __tests__/components/notification-settings.contract.test.tsx`
Expected: FAIL — the subsection and its controls do not exist yet.

- [ ] **Step 3: Render the subsection**

In `frontend/components/NotificationSettings.tsx`:

(a) Extend the import from `"../utils/notifications/constants"` to add `WINDOW_PRAYERS`, `WINDOW_OFFSET_OPTIONS`, and `type WindowPrayerKey`.

(b) Destructure the new hook values:

```ts
  const {
    loaded,
    enabled,
    prefs,
    soundMode,
    windowPrefs,
    windowOffset,
    setPrayerPreference,
    updateSoundMode,
    setWindowPreference,
    setWindowOffset,
  } = useNotificationPreferences({ notifStatus });
```

(c) Add two handlers next to `togglePrayer`:

```ts
  const toggleWindowPrayer = useCallback(
    (k: WindowPrayerKey) => {
      void setWindowPreference(k, !windowPrefs[k]);
    },
    [windowPrefs, setWindowPreference],
  );

  const handleOffsetChange = useCallback(
    (minutes: number) => {
      void setWindowOffset(minutes);
    },
    [setWindowOffset],
  );
```

(d) Insert the subsection JSX immediately AFTER the closing `)` of the `{PRAYERS.map(...)}` block and BEFORE `<View style={[styles.soundCard, ...]}>`. It reuses existing styles (`prayerSectionHeader`, `prayerSectionTitle`, `prayerSectionDescription`, `rowWrapper`, `rowBase`, `rowSurface`, `rowActive`, `rowPressed`, `rowLabel`, `rowIndicator`, `rowIndicatorText`, `revealDivider`, `soundCard`, `soundSegmentRow`, `soundSegment`, `soundSegmentLabel`):

```tsx
          <View style={styles.revealDivider} />
          <View style={styles.prayerSectionHeader}>
            <Text style={[styles.prayerSectionTitle, { color: textColor }]}>
              Window reminders
            </Text>
            <Text
              style={[
                styles.prayerSectionDescription,
                { color: withOpacity(textColor, 0.72) },
              ]}
            >
              A heads up before a prayer's time runs out. Sent only if you have
              not logged it yet.
            </Text>
          </View>

          <View style={[styles.soundSegmentRow, { opacity: enabled ? 1 : 0.55 }]}>
            {WINDOW_OFFSET_OPTIONS.map((minutes, idx) => {
              const selected = windowOffset === minutes;
              return (
                <Pressable
                  key={minutes}
                  disabled={!enabled}
                  onPress={() => enabled && handleOffsetChange(minutes)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !enabled }}
                  accessibilityLabel={`${minutes} minutes before`}
                  style={({ pressed }) => [
                    styles.soundSegment,
                    {
                      marginRight:
                        idx === WINDOW_OFFSET_OPTIONS.length - 1
                          ? 0
                          : SOUND_SEGMENT_GAP,
                      backgroundColor: selected ? accentColor : pillOffBgColor,
                      borderColor: selected ? accentColor : dividerColor,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.soundSegmentLabel,
                      { color: selected ? themeColors.onAccent : textColor },
                    ]}
                  >
                    {`${minutes} min`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {WINDOW_PRAYERS.map((p) => {
            const isOn = windowPrefs[p];
            const labelColor = !enabled
              ? rowDisabledTextColor
              : isOn
                ? textColor
                : rowOffTextColor;
            const indicatorColor = !enabled
              ? withOpacity(textColor, 0.35)
              : isOn
                ? accentColor
                : rowOffTextColor;
            const cardBg = !enabled
              ? pillOffBgColor
              : isOn
                ? rowOnBgColor
                : rowOffBgColor;
            const cardBorder = !enabled
              ? dividerColor
              : isOn
                ? rowOnBorderColor
                : rowOffBorderColor;

            return (
              <View
                key={p}
                style={[styles.rowWrapper, { opacity: enabled ? 1 : 0.55 }]}
              >
                <Pressable
                  onPress={() => {
                    if (!enabled) return;
                    toggleWindowPrayer(p);
                  }}
                  disabled={!enabled}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isOn, disabled: !enabled }}
                  accessibilityLabel={`${p} window reminder`}
                  style={({ pressed }) => [
                    styles.rowBase,
                    styles.rowSurface,
                    { backgroundColor: cardBg, borderColor: cardBorder },
                    isOn && enabled ? styles.rowActive : undefined,
                    pressed && enabled ? styles.rowPressed : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: labelColor },
                      !enabled ? styles.rowLabelDisabled : undefined,
                    ]}
                  >
                    {p}
                  </Text>
                  <View style={styles.rowIndicator}>
                    <Ionicons
                      name={isOn ? "notifications" : "notifications-off-outline"}
                      size={18}
                      color={indicatorColor}
                    />
                    <Text
                      style={[styles.rowIndicatorText, { color: indicatorColor }]}
                    >
                      {isOn ? "On" : "Off"}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/components/notification-settings.contract.test.tsx`
Expected: PASS, all tests (new and existing).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/NotificationSettings.tsx frontend/__tests__/components/notification-settings.contract.test.tsx
git commit -m "feat(notifications): add window reminders subsection to settings"
```

---

### Task 6: Documentation and full verification

**Files:**
- Modify: `Sirat/CLAUDE.md`
- Modify: `frontend/__tests__/README.md` (if not already updated in Task 1)

- [ ] **Step 1: Document the new AsyncStorage keys**

In `Sirat/CLAUDE.md`, under "### AsyncStorage Keys" in the **Notifications:** line, add `notif_window_map_v1` (per-window-prayer on/off JSON) and `notif_window_offset_v1` (global minutes-before, string) to the listed keys.

- [ ] **Step 2: Note the feature in conventions**

In `Sirat/CLAUDE.md`, under "Frontend patterns" near the existing notification note, add one line: window reminders fire `offset` minutes before the next prayer (Fajr→Sunrise, no Isha), are suppressed when the prayer is logged, and share the iOS 60-notification budget with at-prayer alerts (sorted by fire time in `services/notifications/scheduler.ts`).

- [ ] **Step 3: Run the full verification suite**

Run: `npm run verify`
Expected: PASS — lint clean, typecheck clean, all Jest suites green.

If anything fails, read the error, fix it, and re-run `npm run verify` until clean. Do not proceed until it passes.

- [ ] **Step 4: Commit**

```bash
git add Sirat/CLAUDE.md frontend/__tests__/README.md
git commit -m "docs(notifications): document window reminder keys and behavior"
```

---

## Self-Review

**Spec coverage:**
- Coexisting subsection in Notifications card → Task 5.
- Per-prayer on/off (Fajr/Dhuhr/Asr/Maghrib), no Isha/Sunrise → Tasks 1, 2, 5.
- Global preset minutes (5/15/20/30, default 15) → Tasks 1, 4, 5.
- Suppression on any logged status → Task 2 (`getDayStatuses` check).
- Fajr→Sunrise boundary + "is at" phrasing → Task 2 (tested).
- Notification copy (no em dashes, separate title/body) → Task 2.
- iOS 64-cap via combined sort + 60 budget → Tasks 1, 2 (tested).
- Reschedule wiring (`NOTIF_PREFS_UPDATED`, `PRAYER_LOG_UPDATED`) → existing lifecycle; payload extended in Task 4; `PRAYER_LOG_UPDATED` already triggers reschedule (no change needed).
- Device-local keys, never synced → Tasks 1, 4 (plain `notif_*` keys).
- Test updates + README + CLAUDE.md → Tasks 1, 6.

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output.

**Type consistency:** `WindowPrayerKey`/`WindowPrefMap`/`WINDOW_PRAYERS`/`WINDOW_OFFSET_OPTIONS`/`DEFAULT_WINDOW_PREFS`/`DEFAULT_WINDOW_OFFSET` defined in Task 1 and consumed identically in Tasks 2, 4, 5. `scheduleForHorizon` param additions (Task 2) match the call sites updated in Task 3. Hook return additions (Task 4) match the consumption in Task 5 and the contract-test mock. `getDayStatuses` returns lowercase `PrayerName` keys; Task 2 maps `label.toLowerCase()` accordingly.
