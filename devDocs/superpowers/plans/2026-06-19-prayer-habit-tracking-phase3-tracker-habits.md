# Prayer & Habit Tracking — Phase 3 (Tracker Screen, Habits UI, Display Font) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the dedicated **Tracker** screen (streak hero, per-prayer completion rings, month heatmap, qada counter), full **habit management** (create/edit/reorder/archive with an Ionicons glyph picker and flexible daily/weekly frequency), a per-day **habit checklist** on Calendar, a streak chip + "View tracker" affordance on Home, and the one custom **display font** (Fraunces) used only for large stat numerals.

**Architecture:** Builds on the Phase-1 data layer (`services/tracking/*`, facades `@/services/prayerTracker` + `@/services/habitTracker`) and the Phase-2 prayer-logging UI. New pure stats helpers (`unwrapHabitLog`, `monthDailyScores`) extend `stats.ts`. New hooks (`useHabits`, `useHabitLog`/`useHabitLogAll`, `useTrackingStats`) bridge services to UI, staying in sync via the existing `HABITS_UPDATED` / `HABIT_LOG_UPDATED` / `PRAYER_LOG_UPDATED` events. New presentational components live under `components/tracking/`. The Tracker screen is a stack route (like Settings), reached from Home. Habit reorder/archive uses **simple explicit controls** (chevrons + buttons) — no gesture/drag libraries.

**Tech Stack:** React Native 0.81 / Expo 54, TypeScript, `@expo-google-fonts/fraunces` (new dep) + `expo-font` (`useFonts`, already wired), `react-native-svg` (already a dep), `@gorhom/bottom-sheet` (already used), `@expo/vector-icons` (Ionicons), Jest + `@testing-library/react-native`. Path alias `@/` → `frontend/`.

**Plan series:** Phase 3 of the tracking feature. Phase 4 (the separate streak-aware reminder notification service) is **out of scope here** — do NOT build `tracking/reminders.ts`, the `tracking:reminder_prefs_v1` key, notification channels, or any reminder UI in the `HabitEditor`. The `Habit.reminder` field already exists in the schema; leave it unused this phase.

**Source spec:** `docs/superpowers/specs/2026-06-19-prayer-habit-tracking-design.md`

## Global Constraints

- All commands run from `frontend/`. Path alias `@/` maps to `frontend/`.
- Frontend Jest is **Babel-based** — no dynamic `await import()`. Components/hooks tested with `@testing-library/react-native` (`render`, `renderHook`, `fireEvent`, `act`, `waitFor`). `expo-glass-effect` and `expo-blur` are already globally mocked in `test/setup/jest.setup.ts`, and AsyncStorage is the standard jest mock — do NOT re-mock them. Tests that mock `react-native-safe-area-context` must include `useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })` (add `useSafeAreaFrame: () => ({ x:0, y:0, width:390, height:844 })` when the component reads the frame).
- **Theming:** all UI uses `useTheme()` + a `createStyles(theme)` factory. **Never use static color constants.** Use existing theme tokens only; `withOpacity(hex, alpha)` for fills/borders. Status colors: **prayed → `colors.accentSecondary`** (emerald), **late → `colors.accent`** (gold), **missed → `colors.danger`** (red).
- **Display font:** Fraunces, loaded via `@expo-google-fonts/fraunces` in `app/_layout.tsx`. Used **only** for large stat numerals through the `DisplayNumber` component (Task 1). The font-family string constant is `DISPLAY_FONT_FAMILY = "Fraunces_700Bold"`. All other text stays on the system stack via the existing `@/components/ui/Text` components.
- **Iconography:** Ionicons in the existing app style only. The **streak flame `🔥` is the only emoji permitted** anywhere in the feature; every other icon is an Ionicons glyph. Habit icons are chosen from a curated Ionicons glyph set.
- **Habit list interaction:** simple explicit controls — up/down chevrons to reorder, an archive button, edit via the editor. **No** drag-to-reorder, **no** swipe gestures, **no** new gesture/drag dependency.
- **Date keys:** use `dateKeyFromDate()` from `@/services/holidayService` (local `YYYY-MM-DD`).
- **Frequency copy:** daily → `"Daily"`; weekly → `` `${n}× / week` `` (e.g. `"3× / week"`).
- Verify with `npm run verify` (from `frontend/`) before the final commit.

---

### Task 1: Display font (Fraunces) + `DisplayNumber` component

**Files:**
- Modify: `frontend/package.json` (add `@expo-google-fonts/fraunces`)
- Modify: `frontend/app/_layout.tsx:177-179` (add Fraunces to `useFonts`)
- Create: `frontend/components/ui/DisplayNumber.tsx`
- Test: `frontend/__tests__/components/ui/DisplayNumber.test.tsx`

**Interfaces:**
- Produces: `DISPLAY_FONT_FAMILY` (string constant `"Fraunces_700Bold"`) and `DisplayNumber({ value, size, color?, style? }: { value: number | string; size: number; color?: string; style?: StyleProp<TextStyle> })` — renders the value in Fraunces with tabular figures. Consumed by `StreakHero`, `CompletionRings`, `QadaCard`.

- [ ] **Step 1: Install the font package**

Run: `npm install @expo-google-fonts/fraunces`
Expected: package added to `dependencies`; `node_modules/@expo-google-fonts/fraunces` exists.

- [ ] **Step 2: Write the failing test**

```tsx
// frontend/__tests__/components/ui/DisplayNumber.test.tsx
import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import DisplayNumber, { DISPLAY_FONT_FAMILY } from "@/components/ui/DisplayNumber";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("DisplayNumber", () => {
  it("renders the value with the Fraunces family, size and tabular figures", () => {
    const { getByText } = render(wrap(<DisplayNumber value={12} size={40} />));
    const node = getByText("12");
    const flat = StyleSheet.flatten(node.props.style);
    expect(flat.fontFamily).toBe(DISPLAY_FONT_FAMILY);
    expect(flat.fontSize).toBe(40);
    expect(flat.fontVariant).toEqual(["tabular-nums"]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/ui/DisplayNumber.test.tsx`
Expected: FAIL — cannot find module `@/components/ui/DisplayNumber`.

- [ ] **Step 4: Implement `DisplayNumber`**

```tsx
// frontend/components/ui/DisplayNumber.tsx
import { ReactNode } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

import { useTheme } from "@/context/ThemeContext";

export const DISPLAY_FONT_FAMILY = "Fraunces_700Bold";

type Props = {
  value: ReactNode;
  size: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/** Large stat numerals only — the app's single custom display face. */
export default function DisplayNumber({ value, size, color, style }: Props) {
  const { theme } = useTheme();
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily: DISPLAY_FONT_FAMILY,
          fontSize: size,
          lineHeight: Math.round(size * 1.02),
          color: color ?? theme.colors.white,
          fontVariant: ["tabular-nums"],
        },
        style,
      ]}
    >
      {value}
    </Text>
  );
}
```

- [ ] **Step 5: Wire the font into the root layout**

In `frontend/app/_layout.tsx`, add the import near the other font imports and extend the existing `useFonts` call:

```tsx
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces";
```

```tsx
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    Fraunces_700Bold,
  });
```

(The existing `appReady = fontsLoaded && initialSynced && isHydrated` gate now also waits for Fraunces — no other change needed.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/ui/DisplayNumber.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 7: Typecheck (new dep has bundled types)**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/app/_layout.tsx frontend/components/ui/DisplayNumber.tsx frontend/__tests__/components/ui/DisplayNumber.test.tsx
git commit -m "feat(tracking): add Fraunces display font + DisplayNumber component"
```

---

### Task 2: `stats.ts` additions — `unwrapHabitLog` + `monthDailyScores`

**Files:**
- Modify: `frontend/services/tracking/stats.ts`
- Modify: `frontend/services/habitTracker.ts` (re-export `unwrapHabitLog`)
- Modify: `frontend/services/prayerTracker.ts` (re-export `monthDailyScores`)
- Test: `frontend/__tests__/services/tracking/stats.phase3.test.ts`

**Interfaces:**
- Consumes: `HabitLog`, `PrayerName`, `PrayerStatus`, `PRAYER_NAMES` from `./types`.
- Produces:
  - `unwrapHabitLog(log: HabitLog): Record<string, Record<string, boolean>>` — strips `Cell` wrappers (dateKey → habitId → done).
  - `monthDailyScores(statusesByDay: Record<string, Partial<Record<PrayerName, PrayerStatus>>>, year: number, monthIndex0: number): number[]` — for each day of the month (index 0 = day 1), the fraction of the 5 prayers logged as non-missed (`0..1`). Days with no log → `0`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/services/tracking/stats.phase3.test.ts
import { unwrapHabitLog, monthDailyScores } from "@/services/tracking/stats";

describe("unwrapHabitLog", () => {
  it("strips Cell wrappers to plain booleans", () => {
    const out = unwrapHabitLog({
      "2026-06-19": {
        h1: { value: true, updatedAt: 1 },
        h2: { value: false, updatedAt: 2 },
      },
    });
    expect(out).toEqual({ "2026-06-19": { h1: true, h2: false } });
  });
});

describe("monthDailyScores", () => {
  it("returns a non-missed fraction per day of the month", () => {
    const byDay = {
      "2026-06-01": { fajr: "prayed", dhuhr: "prayed", asr: "prayed", maghrib: "prayed", isha: "late" },
      "2026-06-02": { fajr: "prayed", dhuhr: "missed", asr: "prayed" },
    } as const;
    const scores = monthDailyScores(byDay as any, 2026, 5); // June (0-indexed)
    expect(scores).toHaveLength(30);
    expect(scores[0]).toBe(1); // 5/5 non-missed
    expect(scores[1]).toBeCloseTo(2 / 5); // 2 non-missed of 5
    expect(scores[2]).toBe(0); // no log
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/stats.phase3.test.ts`
Expected: FAIL — `unwrapHabitLog`/`monthDailyScores` not exported.

- [ ] **Step 3: Implement the helpers**

Append to `frontend/services/tracking/stats.ts` (it already imports `PRAYER_NAMES` and the types at the top; add `HabitLog` to that import):

```ts
import type { Habit, HabitLog, PrayerLog, PrayerName, PrayerStatus } from "./types";
```

```ts
export function unwrapHabitLog(
  log: HabitLog,
): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [dateKey, day] of Object.entries(log)) {
    const unwrapped: Record<string, boolean> = {};
    for (const habitId of Object.keys(day)) {
      unwrapped[habitId] = day[habitId].value;
    }
    out[dateKey] = unwrapped;
  }
  return out;
}

/** Per-day non-missed prayer fraction (0..1) for each day of the month; index 0 = day 1. */
export function monthDailyScores(
  statusesByDay: Record<string, Partial<Record<PrayerName, PrayerStatus>>>,
  year: number,
  monthIndex0: number,
): number[] {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const scores: number[] = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const day = statusesByDay[key];
    if (!day) {
      scores.push(0);
      continue;
    }
    let ok = 0;
    for (const p of PRAYER_NAMES) {
      const s = day[p];
      if (s != null && s !== "missed") ok += 1;
    }
    scores.push(ok / PRAYER_NAMES.length);
  }
  return scores;
}
```

(Keep the existing `import { PRAYER_NAMES } from "./types";` line; only the `import type { ... }` line gains `HabitLog`.)

- [ ] **Step 4: Re-export through the facades**

In `frontend/services/habitTracker.ts`, change the stats re-export line:

```ts
export { habitStreak, unwrapHabitLog } from "./tracking/stats";
```

In `frontend/services/prayerTracker.ts`, add `monthDailyScores` to the stats re-export block:

```ts
export {
  addDaysKey,
  isDayComplete,
  prayerStreak,
  monthlyCompletion,
  qadaCount,
  unwrapPrayerLog,
  monthDailyScores,
} from "./tracking/stats";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/stats.phase3.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/services/tracking/stats.ts frontend/services/habitTracker.ts frontend/services/prayerTracker.ts frontend/__tests__/services/tracking/stats.phase3.test.ts
git commit -m "feat(tracking): add unwrapHabitLog + monthDailyScores stats helpers"
```

---

### Task 3: `useHabits` hook

**Files:**
- Create: `frontend/hooks/useHabits.ts`
- Test: `frontend/__tests__/hooks/useHabits.test.ts`

**Interfaces:**
- Consumes: `HABITS_UPDATED_EVENT`, `getActiveHabits`, `createHabit`, `updateHabit`, `reorderHabits`, `deleteHabit`, `Habit`, `HabitFrequency`, `HabitReminder` from `@/services/habitTracker`.
- Produces: `useHabits(): { habits: Habit[]; create: (input: { name: string; icon: string; frequency: HabitFrequency; reminder?: HabitReminder }) => Promise<Habit>; update: (id: string, patch: Partial<Pick<Habit, "name" | "icon" | "frequency" | "reminder" | "archived" | "order">>) => Promise<void>; archive: (id: string) => Promise<void>; remove: (id: string) => Promise<void>; reorder: (orderedIds: string[]) => Promise<void> }`. `habits` is the active, order-sorted list; it reloads on mount and on every `HABITS_UPDATED` event.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/hooks/useHabits.test.ts
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHabits } from "@/hooks/useHabits";

describe("useHabits", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("creates a habit and reflects it in the active list", async () => {
    const { result } = renderHook(() => useHabits());
    await act(async () => {
      await result.current.create({ name: "Read Qur'an", icon: "book-outline", frequency: { type: "daily" } });
    });
    await waitFor(() =>
      expect(result.current.habits.some((h) => h.name === "Read Qur'an")).toBe(true),
    );
  });

  it("archiving removes a habit from the active list", async () => {
    const { result } = renderHook(() => useHabits());
    let id = "";
    await act(async () => {
      const h = await result.current.create({ name: "Tahajjud", icon: "moon-outline", frequency: { type: "weekly", timesPerWeek: 3 } });
      id = h.id;
    });
    await waitFor(() => expect(result.current.habits.some((h) => h.id === id)).toBe(true));
    await act(async () => {
      await result.current.archive(id);
    });
    await waitFor(() => expect(result.current.habits.some((h) => h.id === id)).toBe(false));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/hooks/useHabits.test.ts`
Expected: FAIL — cannot find module `@/hooks/useHabits`.

- [ ] **Step 3: Implement the hook**

```ts
// frontend/hooks/useHabits.ts
import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  HABITS_UPDATED_EVENT,
  createHabit,
  deleteHabit,
  getActiveHabits,
  reorderHabits,
  updateHabit,
  type Habit,
  type HabitFrequency,
  type HabitReminder,
} from "@/services/habitTracker";

type UpdatePatch = Partial<
  Pick<Habit, "name" | "icon" | "frequency" | "reminder" | "archived" | "order">
>;

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getActiveHabits().then((h) => {
        if (mounted) setHabits(h);
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(HABITS_UPDATED_EVENT, reload);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const create = useCallback(
    (input: { name: string; icon: string; frequency: HabitFrequency; reminder?: HabitReminder }) =>
      createHabit(input),
    [],
  );
  const update = useCallback((id: string, patch: UpdatePatch) => updateHabit(id, patch), []);
  const archive = useCallback((id: string) => updateHabit(id, { archived: true }), []);
  const remove = useCallback((id: string) => deleteHabit(id), []);
  const reorder = useCallback((orderedIds: string[]) => reorderHabits(orderedIds), []);

  return { habits, create, update, archive, remove, reorder };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/hooks/useHabits.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/hooks/useHabits.ts frontend/__tests__/hooks/useHabits.test.ts
git commit -m "feat(tracking): add useHabits hook"
```

---

### Task 4: `useHabitLog` + `useHabitLogAll` hooks

**Files:**
- Create: `frontend/hooks/useHabitLog.ts`
- Test: `frontend/__tests__/hooks/useHabitLog.test.ts`

**Interfaces:**
- Consumes: `HABIT_LOG_UPDATED_EVENT`, `getDayHabitDone`, `setHabitDone`, `getHabitLog`, `unwrapHabitLog` from `@/services/habitTracker`.
- Produces:
  - `useHabitLog(dateKey: string): { done: Record<string, boolean>; toggle: (habitId: string) => Promise<void> }` — done-map for one day; `toggle` flips a habit's done state for that day. Reloads on mount and on `HABIT_LOG_UPDATED` matching `dateKey`.
  - `useHabitLogAll(): Record<string, Record<string, boolean>>` — the entire unwrapped log (dateKey → habitId → done), reloaded on every `HABIT_LOG_UPDATED`. Used to compute per-habit streaks on the Tracker screen.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/hooks/useHabitLog.test.ts
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHabitLog, useHabitLogAll } from "@/hooks/useHabitLog";

describe("useHabitLog", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("toggles a habit done for a day", async () => {
    const { result } = renderHook(() => useHabitLog("2026-06-19"));
    await waitFor(() => expect(result.current.done).toEqual({}));
    await act(async () => {
      await result.current.toggle("h1");
    });
    await waitFor(() => expect(result.current.done.h1).toBe(true));
    await act(async () => {
      await result.current.toggle("h1");
    });
    await waitFor(() => expect(result.current.done.h1).toBe(false));
  });

  it("useHabitLogAll exposes the full unwrapped log", async () => {
    const { result: log } = renderHook(() => useHabitLog("2026-06-20"));
    await act(async () => {
      await log.current.toggle("h2");
    });
    const { result: all } = renderHook(() => useHabitLogAll());
    await waitFor(() => expect(all.current["2026-06-20"]?.h2).toBe(true));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/hooks/useHabitLog.test.ts`
Expected: FAIL — cannot find module `@/hooks/useHabitLog`.

- [ ] **Step 3: Implement the hooks**

```ts
// frontend/hooks/useHabitLog.ts
import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  HABIT_LOG_UPDATED_EVENT,
  getDayHabitDone,
  getHabitLog,
  setHabitDone,
  unwrapHabitLog,
} from "@/services/habitTracker";

export function useHabitLog(dateKey: string) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getDayHabitDone(dateKey).then((d) => {
        if (mounted) setDone(d);
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(
      HABIT_LOG_UPDATED_EVENT,
      (payload: { dateKey?: string }) => {
        if (payload?.dateKey === dateKey) reload();
      },
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [dateKey]);

  const toggle = useCallback(
    (habitId: string) => setHabitDone(dateKey, habitId, !done[habitId]),
    [dateKey, done],
  );

  return { done, toggle };
}

export function useHabitLogAll() {
  const [byDay, setByDay] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getHabitLog().then((log) => {
        if (mounted) setByDay(unwrapHabitLog(log));
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(HABIT_LOG_UPDATED_EVENT, reload);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return byDay;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/hooks/useHabitLog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/hooks/useHabitLog.ts frontend/__tests__/hooks/useHabitLog.test.ts
git commit -m "feat(tracking): add useHabitLog + useHabitLogAll hooks"
```

---

### Task 5: `useTrackingStats` hook

**Files:**
- Create: `frontend/hooks/useTrackingStats.ts`
- Test: `frontend/__tests__/hooks/useTrackingStats.test.ts`

**Interfaces:**
- Consumes: `PRAYER_LOG_UPDATED_EVENT`, `getPrayerLog`, `unwrapPrayerLog`, `prayerStreak`, `monthlyCompletion`, `qadaCount`, `monthDailyScores`, `PrayerName` from `@/services/prayerTracker`; `dateKeyFromDate` from `@/services/holidayService`.
- Produces: `useTrackingStats(): TrackingStats | null` where
  ```ts
  type TrackingStats = {
    streak: number;
    completion: { overall: number; byPrayer: Record<PrayerName, number> };
    qada: number;
    dailyScores: number[];
    year: number;
    monthIndex0: number;
  };
  ```
  Computed for the current month/today; recomputed on every `PRAYER_LOG_UPDATED`. `null` until the first read resolves.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/hooks/useTrackingStats.test.ts
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTrackingStats } from "@/hooks/useTrackingStats";
import { setPrayerStatus } from "@/services/prayerTracker";
import { dateKeyFromDate } from "@/services/holidayService";

describe("useTrackingStats", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("reflects a missed prayer in the qada count", async () => {
    const todayKey = dateKeyFromDate(new Date());
    const { result } = renderHook(() => useTrackingStats());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.qada).toBe(0);
    await act(async () => {
      await setPrayerStatus(todayKey, "asr", "missed");
    });
    await waitFor(() => expect(result.current!.qada).toBe(1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/hooks/useTrackingStats.test.ts`
Expected: FAIL — cannot find module `@/hooks/useTrackingStats`.

- [ ] **Step 3: Implement the hook**

```ts
// frontend/hooks/useTrackingStats.ts
import { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  PRAYER_LOG_UPDATED_EVENT,
  getPrayerLog,
  monthDailyScores,
  monthlyCompletion,
  prayerStreak,
  qadaCount,
  unwrapPrayerLog,
  type PrayerName,
} from "@/services/prayerTracker";
import { dateKeyFromDate } from "@/services/holidayService";

export type TrackingStats = {
  streak: number;
  completion: { overall: number; byPrayer: Record<PrayerName, number> };
  qada: number;
  dailyScores: number[];
  year: number;
  monthIndex0: number;
};

export function useTrackingStats(): TrackingStats | null {
  const [stats, setStats] = useState<TrackingStats | null>(null);

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getPrayerLog().then((log) => {
        if (!mounted) return;
        const byDay = unwrapPrayerLog(log);
        const now = new Date();
        const todayKey = dateKeyFromDate(now);
        const year = now.getFullYear();
        const monthIndex0 = now.getMonth();
        setStats({
          streak: prayerStreak(byDay, todayKey),
          completion: monthlyCompletion(byDay, year, monthIndex0),
          qada: qadaCount(byDay),
          dailyScores: monthDailyScores(byDay, year, monthIndex0),
          year,
          monthIndex0,
        });
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(PRAYER_LOG_UPDATED_EVENT, reload);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return stats;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/hooks/useTrackingStats.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add frontend/hooks/useTrackingStats.ts frontend/__tests__/hooks/useTrackingStats.test.ts
git commit -m "feat(tracking): add useTrackingStats hook"
```

---

### Task 6: `StreakHero` + `QadaCard` numeral cards

**Files:**
- Create: `frontend/components/tracking/StreakHero.tsx`
- Create: `frontend/components/tracking/QadaCard.tsx`
- Test: `frontend/__tests__/components/tracking/StatCards.test.tsx`

**Interfaces:**
- Consumes: `DisplayNumber` (Task 1), `GlassSurface`, `Caption`/`Headline` from `@/components/ui/Text`, `useTheme`, `withOpacity`, `Ionicons`.
- Produces:
  - `StreakHero({ streak }: { streak: number })` — glass card: flame `🔥` + Fraunces numeral + `DAY STREAK` label.
  - `QadaCard({ count }: { count: number })` — glass row: Ionicons + "Qada" / "Prayers to make up" + Fraunces numeral in gold.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/tracking/StatCards.test.tsx
import { render } from "@testing-library/react-native";
import StreakHero from "@/components/tracking/StreakHero";
import QadaCard from "@/components/tracking/QadaCard";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("StreakHero", () => {
  it("shows the streak numeral and label", () => {
    const { getByText } = render(wrap(<StreakHero streak={12} />));
    expect(getByText("12")).toBeTruthy();
    expect(getByText("DAY STREAK")).toBeTruthy();
  });
});

describe("QadaCard", () => {
  it("shows the qada count and title", () => {
    const { getByText } = render(wrap(<QadaCard count={7} />));
    expect(getByText("7")).toBeTruthy();
    expect(getByText("Qada")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/StatCards.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `StreakHero`**

```tsx
// frontend/components/tracking/StreakHero.tsx
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import DisplayNumber from "@/components/ui/DisplayNumber";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export default function StreakHero({ streak }: { streak: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="card" radius={theme.radii.heroLg} style={styles.card}>
      <Text style={styles.flame} accessibilityLabel="Current streak">🔥</Text>
      <View style={styles.textCol}>
        <DisplayNumber value={streak} size={64} color={colors.white} />
        <Caption color={withOpacity(colors.white, 0.6)} style={styles.label}>
          DAY STREAK
        </Caption>
      </View>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.xl },
    flame: { fontSize: 40 },
    textCol: { gap: 2 },
    label: { letterSpacing: 1.4, textTransform: "uppercase" },
  });
};
```

- [ ] **Step 4: Implement `QadaCard`**

```tsx
// frontend/components/tracking/QadaCard.tsx
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import DisplayNumber from "@/components/ui/DisplayNumber";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export default function QadaCard({ count }: { count: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Ionicons name="refresh-circle-outline" size={24} color={colors.accent} />
      <View style={styles.textCol}>
        <Headline>Qada</Headline>
        <Caption color={withOpacity(colors.white, 0.6)}>Prayers to make up</Caption>
      </View>
      <DisplayNumber value={count} size={34} color={colors.accent} />
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
    textCol: { flex: 1, gap: 2 },
  });
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/StatCards.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/tracking/StreakHero.tsx frontend/components/tracking/QadaCard.tsx frontend/__tests__/components/tracking/StatCards.test.tsx
git commit -m "feat(tracking): add StreakHero and QadaCard"
```

---

### Task 7: `CompletionRings` component

**Files:**
- Create: `frontend/components/tracking/CompletionRings.tsx`
- Test: `frontend/__tests__/components/tracking/CompletionRings.test.tsx`

**Interfaces:**
- Consumes: `react-native-svg` (`Svg`, `Circle`), `DisplayNumber`, `GlassSurface`, `Caption`, `useTheme`, `withOpacity`; `PrayerName` from `@/services/prayerTracker`.
- Produces: `CompletionRings({ byPrayer }: { byPrayer: Record<PrayerName, number> })` — a glass card with a `THIS MONTH` caption and a row of 5 SVG progress rings (Fajr…Isha), each showing the rounded percentage. Each ring container has `testID={`ring-${name}`}`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/tracking/CompletionRings.test.tsx
import { render } from "@testing-library/react-native";
import CompletionRings from "@/components/tracking/CompletionRings";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, Svg: View, Circle: View };
});

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("CompletionRings", () => {
  it("renders a ring and rounded percentage per prayer", () => {
    const { getByTestId, getByText } = render(
      wrap(
        <CompletionRings
          byPrayer={{ fajr: 0.86, dhuhr: 0.97, asr: 0.65, maghrib: 1, isha: 0.5 }}
        />,
      ),
    );
    expect(getByTestId("ring-fajr")).toBeTruthy();
    expect(getByText("86")).toBeTruthy();
    expect(getByText("100")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/CompletionRings.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CompletionRings`**

```tsx
// frontend/components/tracking/CompletionRings.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import DisplayNumber from "@/components/ui/DisplayNumber";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerName } from "@/services/prayerTracker";

const ORDER: { name: PrayerName; label: string }[] = [
  { name: "fajr", label: "Fajr" },
  { name: "dhuhr", label: "Dhuhr" },
  { name: "asr", label: "Asr" },
  { name: "maghrib", label: "Maghrib" },
  { name: "isha", label: "Isha" },
];

const SIZE = 54;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function CompletionRings({
  byPrayer,
}: {
  byPrayer: Record<PrayerName, number>;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Caption color={withOpacity(colors.white, 0.6)} style={styles.heading}>
        THIS MONTH
      </Caption>
      <View style={styles.row}>
        {ORDER.map(({ name, label }) => {
          const value = byPrayer[name] ?? 0;
          const pct = Math.round(value * 100);
          const offset = CIRC * (1 - Math.max(0, Math.min(1, value)));
          return (
            <View key={name} style={styles.ring} testID={`ring-${name}`}>
              <Svg width={SIZE} height={SIZE}>
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={withOpacity(colors.white, 0.1)}
                  strokeWidth={STROKE}
                />
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={colors.accentSecondary}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              </Svg>
              <View style={styles.pctWrap} pointerEvents="none">
                <DisplayNumber value={pct} size={14} color={colors.white} />
              </View>
              <Caption color={withOpacity(colors.white, 0.6)} style={styles.label}>
                {label}
              </Caption>
            </View>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, gap: spacing.md },
    heading: { letterSpacing: 1.2 },
    row: { flexDirection: "row", justifyContent: "space-between" },
    ring: { alignItems: "center", width: SIZE },
    pctWrap: { position: "absolute", top: 0, width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
    label: { marginTop: spacing.xs },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/CompletionRings.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/tracking/CompletionRings.tsx frontend/__tests__/components/tracking/CompletionRings.test.tsx
git commit -m "feat(tracking): add CompletionRings"
```

---

### Task 8: `MonthHeatmap` component

**Files:**
- Create: `frontend/components/tracking/MonthHeatmap.tsx`
- Test: `frontend/__tests__/components/tracking/MonthHeatmap.test.tsx`

**Interfaces:**
- Consumes: `GlassSurface`, `Caption`, `useTheme`, `withOpacity`.
- Produces: `MonthHeatmap({ scores, year, monthIndex0 }: { scores: number[]; year: number; monthIndex0: number })` — a glass card titled with the month name and a 7-column grid of day cells; each cell's emerald fill opacity scales with its score (`0` → faint white). Leading blanks pad the first weekday. Each day cell has `testID={`heatcell-${day}`}`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/tracking/MonthHeatmap.test.tsx
import { render } from "@testing-library/react-native";
import MonthHeatmap from "@/components/tracking/MonthHeatmap";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("MonthHeatmap", () => {
  it("renders a cell per day of the month with the month name", () => {
    const scores = Array.from({ length: 30 }, (_, i) => (i % 5) / 5); // June has 30 days
    const { getByTestId, getByText } = render(
      wrap(<MonthHeatmap scores={scores} year={2026} monthIndex0={5} />),
    );
    expect(getByText("June")).toBeTruthy();
    expect(getByTestId("heatcell-1")).toBeTruthy();
    expect(getByTestId("heatcell-30")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/MonthHeatmap.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `MonthHeatmap`**

```tsx
// frontend/components/tracking/MonthHeatmap.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Cell = { day: number; score: number } | null;

function buildWeeks(scores: number[], year: number, monthIndex0: number): Cell[][] {
  const firstWeekday = new Date(year, monthIndex0, 1).getDay(); // 0 = Sunday
  const cells: Cell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  scores.forEach((score, i) => cells.push({ day: i + 1, score }));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function MonthHeatmap({
  scores,
  year,
  monthIndex0,
}: {
  scores: number[];
  year: number;
  monthIndex0: number;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const weeks = useMemo(() => buildWeeks(scores, year, monthIndex0), [scores, year, monthIndex0]);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(year, monthIndex0, 1),
  );

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Caption color={withOpacity(colors.white, 0.6)} style={styles.heading}>
        {monthName}
      </Caption>
      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((cell, ci) =>
              cell ? (
                <View
                  key={ci}
                  testID={`heatcell-${cell.day}`}
                  style={[
                    styles.cell,
                    {
                      backgroundColor:
                        cell.score > 0
                          ? withOpacity(colors.accentSecondary, 0.18 + cell.score * 0.72)
                          : withOpacity(colors.white, 0.06),
                    },
                  ]}
                />
              ) : (
                <View key={ci} style={[styles.cell, styles.empty]} />
              ),
            )}
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, gap: spacing.md },
    heading: { letterSpacing: 1.2 },
    grid: { gap: spacing.xs },
    week: { flexDirection: "row", justifyContent: "space-between" },
    cell: { flex: 1, aspectRatio: 1, marginHorizontal: 2, borderRadius: 6 },
    empty: { backgroundColor: "transparent" },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/MonthHeatmap.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/tracking/MonthHeatmap.tsx frontend/__tests__/components/tracking/MonthHeatmap.test.tsx
git commit -m "feat(tracking): add MonthHeatmap"
```

---

### Task 9: `HabitRow` component (simple controls)

**Files:**
- Create: `frontend/utils/habitFrequency.ts`
- Create: `frontend/components/tracking/HabitRow.tsx`
- Test: `frontend/__tests__/components/tracking/HabitRow.test.tsx`

**Interfaces:**
- Consumes: `Ionicons`, `PressableScale`, `GlassSurface`, `Headline`/`Caption`, `useTheme`, `withOpacity`; `Habit` from `@/services/habitTracker`.
- Produces:
  - `frequencyLabel(freq: HabitFrequency): string` in `utils/habitFrequency.ts` — `"Daily"` or `` `${n}× / week` ``.
  - `HabitRow({ habit, streak, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onEdit, onArchive }: { habit: Habit; streak: number; canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void; onEdit: () => void; onArchive: () => void })` — a glass row: habit icon, name, frequency badge, `🔥 {streak}` flame, then move-up/move-down chevrons (disabled at the ends), an edit (pencil) button, and an archive button. Buttons carry accessibility labels `Move {name} up`, `Move {name} down`, `Edit {name}`, `Archive {name}`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/tracking/HabitRow.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import HabitRow from "@/components/tracking/HabitRow";
import { frequencyLabel } from "@/utils/habitFrequency";
import { ThemeProvider } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";

const habit: Habit = {
  id: "h1",
  name: "Read Qur'an",
  icon: "book-outline",
  frequency: { type: "weekly", timesPerWeek: 3 },
  order: 0,
  archived: false,
  createdAtKey: "2026-06-01",
  updatedAt: 1,
};

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("frequencyLabel", () => {
  it("formats daily and weekly", () => {
    expect(frequencyLabel({ type: "daily" })).toBe("Daily");
    expect(frequencyLabel({ type: "weekly", timesPerWeek: 3 })).toBe("3× / week");
  });
});

describe("HabitRow", () => {
  it("renders name, frequency, streak and fires actions", () => {
    const onArchive = jest.fn();
    const onEdit = jest.fn();
    const { getByText, getByLabelText } = render(
      wrap(
        <HabitRow
          habit={habit}
          streak={5}
          canMoveUp
          canMoveDown
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          onEdit={onEdit}
          onArchive={onArchive}
        />,
      ),
    );
    expect(getByText("Read Qur'an")).toBeTruthy();
    expect(getByText("3× / week")).toBeTruthy();
    fireEvent.press(getByLabelText("Archive Read Qur'an"));
    expect(onArchive).toHaveBeenCalled();
    fireEvent.press(getByLabelText("Edit Read Qur'an"));
    expect(onEdit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitRow.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `frequencyLabel`**

```ts
// frontend/utils/habitFrequency.ts
import type { HabitFrequency } from "@/services/habitTracker";

export function frequencyLabel(freq: HabitFrequency): string {
  return freq.type === "daily" ? "Daily" : `${freq.timesPerWeek}× / week`;
}
```

- [ ] **Step 4: Implement `HabitRow`**

```tsx
// frontend/components/tracking/HabitRow.tsx
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";
import { frequencyLabel } from "@/utils/habitFrequency";

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  habit: Habit;
  streak: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

export default function HabitRow({
  habit,
  streak,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onArchive,
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="row" radius={theme.radii.row} style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name={habit.icon as IoniconName} size={18} color={colors.accentSecondary} />
      </View>
      <View style={styles.meta}>
        <Headline numberOfLines={1}>{habit.name}</Headline>
        <Caption color={withOpacity(colors.white, 0.6)}>{frequencyLabel(habit.frequency)}</Caption>
      </View>
      <View style={styles.streak}>
        <Text style={styles.flame}>🔥</Text>
        <Caption color={colors.accent} style={styles.streakNum}>{streak}</Caption>
      </View>
      <View style={styles.controls}>
        <PressableScale
          onPress={onMoveUp}
          disabled={!canMoveUp}
          accessibilityRole="button"
          accessibilityLabel={`Move ${habit.name} up`}
          style={styles.ctrlBtn}
        >
          <Ionicons name="chevron-up" size={16} color={canMoveUp ? colors.white : withOpacity(colors.white, 0.25)} />
        </PressableScale>
        <PressableScale
          onPress={onMoveDown}
          disabled={!canMoveDown}
          accessibilityRole="button"
          accessibilityLabel={`Move ${habit.name} down`}
          style={styles.ctrlBtn}
        >
          <Ionicons name="chevron-down" size={16} color={canMoveDown ? colors.white : withOpacity(colors.white, 0.25)} />
        </PressableScale>
        <PressableScale
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${habit.name}`}
          style={styles.ctrlBtn}
        >
          <Ionicons name="create-outline" size={16} color={withOpacity(colors.white, 0.8)} />
        </PressableScale>
        <PressableScale
          onPress={onArchive}
          accessibilityRole="button"
          accessibilityLabel={`Archive ${habit.name}`}
          style={styles.ctrlBtn}
        >
          <Ionicons name="archive-outline" size={16} color={withOpacity(colors.white, 0.8)} />
        </PressableScale>
      </View>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.accentSecondary, 0.14),
    },
    meta: { flex: 1, gap: 2 },
    streak: { flexDirection: "row", alignItems: "center", gap: 3 },
    flame: { fontSize: 13 },
    streakNum: { fontWeight: "700" },
    controls: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    ctrlBtn: { padding: spacing.xs },
  });
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitRow.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/utils/habitFrequency.ts frontend/components/tracking/HabitRow.tsx frontend/__tests__/components/tracking/HabitRow.test.tsx
git commit -m "feat(tracking): add HabitRow with simple reorder/archive controls"
```

---

### Task 10: `HabitEditor` bottom sheet (create/edit, glyph picker, frequency)

**Files:**
- Create: `frontend/components/tracking/HabitEditor.tsx`
- Test: `frontend/__tests__/components/tracking/HabitEditor.test.tsx`

**Interfaces:**
- Consumes: `@gorhom/bottom-sheet` (`BottomSheet`, `BottomSheetView`), `@/components/ui/SheetBackground`, `BottomSheetTextInput` from `@gorhom/bottom-sheet`, `PressableScale`, `Ionicons`, `Title3`/`Headline`/`Caption`, `useTheme`, `withOpacity`, `useSafeAreaInsets`; `Habit`, `HabitFrequency` from `@/services/habitTracker`.
- Produces: `HabitEditor({ visible, initial, onSubmit, onDelete, onClose }: { visible: boolean; initial?: Habit | null; onSubmit: (input: { name: string; icon: string; frequency: HabitFrequency }) => void; onDelete?: () => void; onClose: () => void })`. A bottom sheet (mounted-through-close, following `PrayerLogSheet`): name field, curated Ionicons glyph picker, Daily/Weekly toggle with a 1–7 stepper when weekly, a **Save** button (disabled until name is non-empty), and a **Delete** button shown only when `initial` is set and `onDelete` provided. On Save it calls `onSubmit` with the built input then `onClose`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/tracking/HabitEditor.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import HabitEditor from "@/components/tracking/HabitEditor";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View, TextInput } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp, BottomSheetTextInput: TextInput };
});
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("HabitEditor", () => {
  it("creates a daily habit from name + icon", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      wrap(<HabitEditor visible initial={null} onSubmit={onSubmit} onClose={jest.fn()} />),
    );
    fireEvent.changeText(getByPlaceholderText("Habit name"), "Morning adhkar");
    fireEvent.press(getByLabelText("Choose icon moon-outline"));
    fireEvent.press(getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Morning adhkar",
      icon: "moon-outline",
      frequency: { type: "daily" },
    });
  });

  it("builds a weekly frequency", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText, getByLabelText } = render(
      wrap(<HabitEditor visible initial={null} onSubmit={onSubmit} onClose={jest.fn()} />),
    );
    fireEvent.changeText(getByPlaceholderText("Habit name"), "Tahajjud");
    fireEvent.press(getByText("Weekly"));
    fireEvent.press(getByLabelText("Increase times per week")); // default 1 -> 2
    fireEvent.press(getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Tahajjud", frequency: { type: "weekly", timesPerWeek: 2 } }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitEditor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `HabitEditor`**

```tsx
// frontend/components/tracking/HabitEditor.tsx
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetTextInput, BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/PressableScale";
import SheetBackground from "@/components/ui/SheetBackground";
import { Caption, Headline, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit, HabitFrequency } from "@/services/habitTracker";

type IoniconName = keyof typeof Ionicons.glyphMap;

function EditorSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

const GLYPHS: IoniconName[] = [
  "book-outline",
  "moon-outline",
  "hand-left-outline",
  "heart-outline",
  "sunny-outline",
  "water-outline",
  "walk-outline",
  "cash-outline",
  "people-outline",
  "star-outline",
  "leaf-outline",
  "time-outline",
];

type Props = {
  visible: boolean;
  initial?: Habit | null;
  onSubmit: (input: { name: string; icon: string; frequency: HabitFrequency }) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export default function HabitEditor({ visible, initial, onSubmit, onDelete, onClose }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const tabBarClearance = Math.max(insets.bottom, 14) + 6 + 64 + 8;

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IoniconName>(GLYPHS[0]);
  const [weekly, setWeekly] = useState(false);
  const [timesPerWeek, setTimesPerWeek] = useState(1);

  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  // Initialise the form whenever the sheet opens.
  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      setName(initial?.name ?? "");
      setIcon((initial?.icon as IoniconName) ?? GLYPHS[0]);
      const f = initial?.frequency;
      setWeekly(f?.type === "weekly");
      setTimesPerWeek(f?.type === "weekly" ? f.timesPerWeek : 1);
    }
  }, [visible, initial]);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      sheetRef.current?.snapToIndex(0);
    } else if (!visible && previousVisibleRef.current) {
      sheetRef.current?.close();
    }
    previousVisibleRef.current = visible;
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        setMounted(false);
        onClose();
      }
    },
    [onClose],
  );

  const handleIndicatorStyle = useMemo(
    () => ({ backgroundColor: withOpacity(colors.white, 0.3), width: 38 }),
    [colors.white],
  );

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSubmit({
      name: trimmed,
      icon,
      frequency: weekly ? { type: "weekly", timesPerWeek } : { type: "daily" },
    });
    onClose();
  }, [canSave, trimmed, icon, weekly, timesPerWeek, onSubmit, onClose]);

  if (!mounted) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      backgroundComponent={EditorSheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: tabBarClearance + 16 }]}>
        <Title3 style={styles.title}>{initial ? "Edit habit" : "New habit"}</Title3>

        <BottomSheetTextInput
          placeholder="Habit name"
          placeholderTextColor={withOpacity(colors.white, 0.4)}
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <Caption color={withOpacity(colors.white, 0.6)} style={styles.sectionLabel}>ICON</Caption>
        <View style={styles.glyphGrid}>
          {GLYPHS.map((g) => {
            const active = g === icon;
            return (
              <PressableScale
                key={g}
                onPress={() => setIcon(g)}
                accessibilityRole="button"
                accessibilityLabel={`Choose icon ${g}`}
                style={[styles.glyph, active && styles.glyphActive]}
              >
                <Ionicons
                  name={g}
                  size={20}
                  color={active ? colors.onAccent : withOpacity(colors.white, 0.8)}
                />
              </PressableScale>
            );
          })}
        </View>

        <Caption color={withOpacity(colors.white, 0.6)} style={styles.sectionLabel}>FREQUENCY</Caption>
        <View style={styles.freqRow}>
          <PressableScale
            onPress={() => setWeekly(false)}
            accessibilityRole="button"
            style={[styles.freqBtn, !weekly && styles.freqBtnActive]}
          >
            <Headline color={!weekly ? colors.onAccent : colors.white}>Daily</Headline>
          </PressableScale>
          <PressableScale
            onPress={() => setWeekly(true)}
            accessibilityRole="button"
            style={[styles.freqBtn, weekly && styles.freqBtnActive]}
          >
            <Headline color={weekly ? colors.onAccent : colors.white}>Weekly</Headline>
          </PressableScale>
        </View>

        {weekly ? (
          <View style={styles.stepper}>
            <PressableScale
              onPress={() => setTimesPerWeek((n) => Math.max(1, n - 1))}
              accessibilityRole="button"
              accessibilityLabel="Decrease times per week"
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={18} color={colors.white} />
            </PressableScale>
            <Headline style={styles.stepValue}>{timesPerWeek}× / week</Headline>
            <PressableScale
              onPress={() => setTimesPerWeek((n) => Math.min(7, n + 1))}
              accessibilityRole="button"
              accessibilityLabel="Increase times per week"
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={18} color={colors.white} />
            </PressableScale>
          </View>
        ) : null}

        <PressableScale
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          style={[styles.save, !canSave && styles.saveDisabled]}
        >
          <Headline color={colors.onAccent}>Save</Headline>
        </PressableScale>

        {initial && onDelete ? (
          <PressableScale
            onPress={() => {
              onDelete();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete habit"
            style={styles.delete}
          >
            <Headline color={colors.danger}>Delete</Headline>
          </PressableScale>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
    title: { marginBottom: spacing.xs },
    input: {
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
      borderRadius: theme.radii.row,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.white,
      fontSize: 16,
    },
    sectionLabel: { letterSpacing: 1, marginTop: spacing.xs },
    glyphGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    glyph: {
      width: 46,
      height: 46,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.1),
    },
    glyphActive: { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary },
    freqRow: { flexDirection: "row", gap: spacing.sm },
    freqBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    freqBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.row,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    stepValue: { flex: 1, textAlign: "center" },
    save: {
      backgroundColor: colors.accent,
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: theme.radii.row,
      marginTop: spacing.sm,
    },
    saveDisabled: { opacity: 0.4 },
    delete: { alignItems: "center", paddingVertical: spacing.sm },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitEditor.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/tracking/HabitEditor.tsx frontend/__tests__/components/tracking/HabitEditor.test.tsx
git commit -m "feat(tracking): add HabitEditor bottom sheet"
```

---

### Task 11: `Tracker` screen + route registration

**Files:**
- Create: `frontend/app/Tracker.tsx`
- Modify: `frontend/app/_layout.tsx` (register the `Tracker` stack screen)
- Test: `frontend/__tests__/screens/Tracker.test.tsx`

**Interfaces:**
- Consumes: `useTrackingStats` (Task 5), `useHabits` (Task 3), `useHabitLogAll` (Task 4), `StreakHero`/`QadaCard`/`CompletionRings`/`MonthHeatmap`/`HabitRow`/`HabitEditor` (Tasks 6–10); `habitStreak` from `@/services/habitTracker`; `dateKeyFromDate`; `Screen`; `useRouter`; `useSafeAreaInsets`; `Ionicons`; `PressableScale`; `LargeTitle`/`Title2`/`Caption`.
- Produces: the `/Tracker` screen. Overview section (StreakHero, CompletionRings, MonthHeatmap, QadaCard) driven by `useTrackingStats`; Habits section listing `HabitRow`s with per-habit streaks (`habitStreak(habit, allDone, habit.id, todayKey)`), reorder via id-swap → `reorder`, archive → `archive`, edit/new → `HabitEditor`. Back button (top-left) calls `router.back()`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/screens/Tracker.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import Tracker from "@/app/Tracker";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View, TextInput } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp, BottomSheetTextInput: TextInput };
});
jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, Svg: View, Circle: View };
});
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));

jest.mock("@/hooks/useTrackingStats", () => ({
  useTrackingStats: () => ({
    streak: 12,
    completion: { overall: 0.8, byPrayer: { fajr: 0.8, dhuhr: 0.9, asr: 0.7, maghrib: 1, isha: 0.6 } },
    qada: 7,
    dailyScores: Array.from({ length: 30 }, () => 0.5),
    year: 2026,
    monthIndex0: 5,
  }),
}));
jest.mock("@/hooks/useHabits", () => ({
  useHabits: () => ({
    habits: [
      { id: "h1", name: "Read Qur'an", icon: "book-outline", frequency: { type: "daily" }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
    ],
    create: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  }),
}));
jest.mock("@/hooks/useHabitLog", () => ({ useHabitLogAll: () => ({}) }));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Tracker screen", () => {
  it("renders the streak hero, qada and a habit", () => {
    const { getByText } = render(wrap(<Tracker />));
    expect(getByText("12")).toBeTruthy();
    expect(getByText("Qada")).toBeTruthy();
    expect(getByText("Read Qur'an")).toBeTruthy();
  });

  it("back button calls router.back", () => {
    const { getByLabelText } = render(wrap(<Tracker />));
    fireEvent.press(getByLabelText("Go back"));
    expect(mockBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/screens/Tracker.test.tsx`
Expected: FAIL — cannot find module `@/app/Tracker`.

- [ ] **Step 3: Implement the `Tracker` screen**

```tsx
// frontend/app/Tracker.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/PressableScale";
import CompletionRings from "@/components/tracking/CompletionRings";
import HabitEditor from "@/components/tracking/HabitEditor";
import HabitRow from "@/components/tracking/HabitRow";
import MonthHeatmap from "@/components/tracking/MonthHeatmap";
import QadaCard from "@/components/tracking/QadaCard";
import StreakHero from "@/components/tracking/StreakHero";
import Screen from "@/components/ui/Screen";
import { Caption, LargeTitle, Title2 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHabitLogAll } from "@/hooks/useHabitLog";
import { useHabits } from "@/hooks/useHabits";
import { useTrackingStats } from "@/hooks/useTrackingStats";
import { habitStreak, type Habit } from "@/services/habitTracker";
import { dateKeyFromDate } from "@/services/holidayService";

export default function Tracker() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const stats = useTrackingStats();
  const { habits, create, update, archive, remove, reorder } = useHabits();
  const allDone = useHabitLogAll();
  const todayKey = dateKeyFromDate(new Date());

  const [editing, setEditing] = useState<{ open: boolean; habit: Habit | null }>({
    open: false,
    habit: null,
  });

  const move = (index: number, delta: number) => {
    const ids = habits.map((h) => h.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void reorder(ids);
  };

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.headerRow}>
          <PressableScale
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </PressableScale>
          <LargeTitle>Tracker</LargeTitle>
        </View>

        <View style={styles.section}>
          <StreakHero streak={stats?.streak ?? 0} />
          <CompletionRings byPrayer={stats?.completion.byPrayer ?? EMPTY_BY_PRAYER} />
          {stats ? (
            <MonthHeatmap scores={stats.dailyScores} year={stats.year} monthIndex0={stats.monthIndex0} />
          ) : null}
          <QadaCard count={stats?.qada ?? 0} />
        </View>

        <View style={styles.habitsHeader}>
          <Title2>Habits</Title2>
          <PressableScale
            onPress={() => setEditing({ open: true, habit: null })}
            accessibilityRole="button"
            accessibilityLabel="New habit"
            style={styles.newBtn}
          >
            <Ionicons name="add" size={18} color={colors.onAccent} />
            <Caption color={colors.onAccent} style={styles.newBtnText}>New habit</Caption>
          </PressableScale>
        </View>

        {habits.length === 0 ? (
          <Caption color={withOpacity(colors.white, 0.6)} style={styles.empty}>
            No habits yet. Tap “New habit” to start.
          </Caption>
        ) : (
          <View style={styles.habitList}>
            {habits.map((habit, index) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                streak={habitStreak(habit, allDone, habit.id, todayKey)}
                canMoveUp={index > 0}
                canMoveDown={index < habits.length - 1}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onEdit={() => setEditing({ open: true, habit })}
                onArchive={() => void archive(habit.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <HabitEditor
        visible={editing.open}
        initial={editing.habit}
        onSubmit={(input) => {
          if (editing.habit) void update(editing.habit.id, input);
          else void create(input);
        }}
        onDelete={editing.habit ? () => void remove(editing.habit!.id) : undefined}
        onClose={() => setEditing({ open: false, habit: null })}
      />
    </Screen>
  );
}

const EMPTY_BY_PRAYER = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    backBtn: { padding: spacing.xs, marginLeft: -spacing.xs },
    section: { gap: spacing.md },
    habitsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.pill,
    },
    newBtnText: { fontWeight: "700" },
    habitList: { gap: spacing.sm },
    empty: { paddingVertical: spacing.xl, textAlign: "center" },
  });
};
```

- [ ] **Step 4: Register the route in `_layout.tsx`**

In `frontend/app/_layout.tsx`, inside the `<Stack>` (after the `Settings` screen), add:

```tsx
                <Stack.Screen name="Tracker" options={{ animation: "slide_from_right" }} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/screens/Tracker.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/Tracker.tsx frontend/app/_layout.tsx frontend/__tests__/screens/Tracker.test.tsx
git commit -m "feat(tracking): add Tracker screen + route"
```

---

### Task 12: Home — streak chip + "View tracker & habits" affordance

**Files:**
- Modify: `frontend/app/(tabs)/index.tsx`
- Modify: `frontend/__tests__/screens/screen-contracts.test.tsx` (mock `useTrackingStats`)
- Test: `frontend/__tests__/screens/home-tracker-affordance.test.tsx`

**Interfaces:**
- Consumes: `useTrackingStats` (Task 5), `useRouter` (already imported in Home).
- Produces: a compact pressable row in the arc area showing `🔥 {streak} day streak` and `View tracker & habits →`, routing to `/Tracker`. (Placed adjacent to the arc card rather than inside `PrayerArc`'s internal header, to keep `PrayerArc` untouched this phase.)

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/screens/home-tracker-affordance.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Home from "@/app/(tabs)/index";
import { ThemeProvider } from "@/context/ThemeContext";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp };
});
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/hooks/useHomePrayerTimes", () => ({
  useHomePrayerTimes: () => ({
    prayerTimes: [{ label: "Fajr", time: "5:12 AM" }],
    nextPrayer: { label: "Isha", time: "8:01 PM" },
    nextDayFajr: null, timeLeft: "1h", loading: false, refreshing: false,
    banner: "", locationLabel: "Tunis", refresh: jest.fn(),
  }),
}));
jest.mock("@/hooks/useTrackingStats", () => ({
  useTrackingStats: () => ({
    streak: 9,
    completion: { overall: 0, byPrayer: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } },
    qada: 0, dailyScores: [], year: 2026, monthIndex0: 5,
  }),
}));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Home tracker affordance", () => {
  beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

  it("shows the streak and routes to the Tracker", () => {
    const { getByLabelText, getByText } = render(wrap(<Home />));
    expect(getByText("9 day streak")).toBeTruthy();
    fireEvent.press(getByLabelText("View tracker and habits"));
    expect(mockPush).toHaveBeenCalledWith("/Tracker");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/screens/home-tracker-affordance.test.tsx`
Expected: FAIL — no such row.

- [ ] **Step 3: Implement the Home affordance**

In `frontend/app/(tabs)/index.tsx`:

1. Add imports:
```tsx
import { useTrackingStats } from "@/hooks/useTrackingStats";
import { Text } from "react-native"; // add Text to the existing react-native import instead of a new line
```
(Prefer adding `Text` to the existing `react-native` import list rather than a separate statement.)

2. Inside `Home`, after the existing `usePrayerLog` line:
```tsx
const stats = useTrackingStats();
```

3. In the `arcSlot` block, render the affordance row directly under the `<PrayerArc .../>`:
```tsx
<PressableScale
  onPress={() => router.push("/Tracker")}
  accessibilityRole="button"
  accessibilityLabel="View tracker and habits"
  style={styles.trackerRow}
>
  <View style={styles.streakChip}>
    <Text style={styles.flame}>🔥</Text>
    <Caption color={colors.accent} style={styles.streakChipText}>
      {stats?.streak ?? 0} day streak
    </Caption>
  </View>
  <Caption color={withOpacity(colors.white, 0.7)}>View tracker &amp; habits →</Caption>
</PressableScale>
```

4. Add styles to `createStyles`:
```tsx
trackerRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: spacing.md,
  paddingHorizontal: spacing.xs,
},
streakChip: { flexDirection: "row", alignItems: "center", gap: 4 },
streakChipText: { fontWeight: "700" },
flame: { fontSize: 13 },
```

- [ ] **Step 4: Keep `screen-contracts` green — mock `useTrackingStats`**

In `frontend/__tests__/screens/screen-contracts.test.tsx`, add a mock alongside the other `@/hooks/*` mocks (near the `usePrayerLog` mock):

```tsx
jest.mock("@/hooks/useTrackingStats", () => ({
  useTrackingStats: jest.fn(() => ({
    streak: 0,
    completion: { overall: 0, byPrayer: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } },
    qada: 0,
    dailyScores: [],
    year: 2026,
    monthIndex0: 2,
  })),
}));
```

- [ ] **Step 5: Run the new test and the contracts suite**

Run: `npm test -- --runTestsByPath __tests__/screens/home-tracker-affordance.test.tsx __tests__/screens/screen-contracts.test.tsx`
Expected: PASS (both suites).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(tabs)/index.tsx frontend/__tests__/screens/screen-contracts.test.tsx frontend/__tests__/screens/home-tracker-affordance.test.tsx
git commit -m "feat(tracking): add streak chip + Tracker affordance to Home"
```

---

### Task 13: Calendar — per-day habit checklist

**Files:**
- Create: `frontend/components/tracking/HabitChecklist.tsx`
- Modify: `frontend/app/(tabs)/Calendar.tsx`
- Modify: `frontend/__tests__/screens/screen-contracts.test.tsx` (mock `useHabits` + `useHabitLog`)
- Test: `frontend/__tests__/components/tracking/HabitChecklist.test.tsx`

**Interfaces:**
- Consumes (component): `Ionicons`, `PressableScale`, `GlassSurface`, `Title3`/`Headline`/`Caption`, `useTheme`, `withOpacity`; `Habit` from `@/services/habitTracker`; `frequencyLabel` (Task 9).
- Produces: `HabitChecklist({ habits, done, onToggle }: { habits: Habit[]; done: Record<string, boolean>; onToggle: (habitId: string) => void })` — a glass card titled "Habits" with one toggle row per active habit (checkmark-circle when done, ellipse-outline otherwise). Each row has `accessibilityLabel={`Toggle ${habit.name}`}` and `accessibilityState={{ checked }}`. Renders nothing when `habits` is empty.
- Calendar change: read `useHabits()` + `useHabitLog(selectedDayKey)` and render `HabitChecklist` inside the scroll panel, right after `DayDetailPanel`, for the selected day.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/tracking/HabitChecklist.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import HabitChecklist from "@/components/tracking/HabitChecklist";
import { ThemeProvider } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";

const habits: Habit[] = [
  { id: "h1", name: "Read Qur'an", icon: "book-outline", frequency: { type: "daily" }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
];
const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("HabitChecklist", () => {
  it("toggles a habit", () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      wrap(<HabitChecklist habits={habits} done={{}} onToggle={onToggle} />),
    );
    fireEvent.press(getByLabelText("Toggle Read Qur'an"));
    expect(onToggle).toHaveBeenCalledWith("h1");
  });

  it("renders nothing when there are no habits", () => {
    const { queryByText } = render(wrap(<HabitChecklist habits={[]} done={{}} onToggle={jest.fn()} />));
    expect(queryByText("Habits")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitChecklist.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `HabitChecklist`**

```tsx
// frontend/components/tracking/HabitChecklist.tsx
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";
import { frequencyLabel } from "@/utils/habitFrequency";

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  habits: Habit[];
  done: Record<string, boolean>;
  onToggle: (habitId: string) => void;
};

export default function HabitChecklist({ habits, done, onToggle }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (habits.length === 0) return null;

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Title3 style={styles.title}>Habits</Title3>
      {habits.map((habit) => {
        const checked = done[habit.id] === true;
        return (
          <PressableScale
            key={habit.id}
            onPress={() => onToggle(habit.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`Toggle ${habit.name}`}
            style={styles.row}
          >
            <Ionicons
              name={checked ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={checked ? colors.accentSecondary : withOpacity(colors.white, 0.5)}
            />
            <View style={styles.meta}>
              <Headline numberOfLines={1}>{habit.name}</Headline>
              <Caption color={withOpacity(colors.white, 0.6)}>{frequencyLabel(habit.frequency)}</Caption>
            </View>
            <Ionicons
              name={habit.icon as IoniconName}
              size={16}
              color={withOpacity(colors.white, 0.4)}
            />
          </PressableScale>
        );
      })}
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
    title: { marginBottom: spacing.xs },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    meta: { flex: 1, gap: 2 },
  });
};
```

- [ ] **Step 4: Wire it into Calendar**

In `frontend/app/(tabs)/Calendar.tsx`:

1. Add imports:
```tsx
import HabitChecklist from "@/components/tracking/HabitChecklist";
import { useHabits } from "@/hooks/useHabits";
import { useHabitLog } from "@/hooks/useHabitLog";
```

2. After the existing `usePrayerLog(selectedDayKey)` line:
```tsx
const { habits } = useHabits();
const { done: habitDone, toggle: toggleHabit } = useHabitLog(selectedDayKey);
```

3. Inside the scroll panel, immediately after the `<DayDetailPanel ... />` block (still inside the `selectedDate ? (...) : (...)` true-branch — render the checklist below the panel by wrapping both in a fragment):
```tsx
{selectedDate ? (
  <>
    <DayDetailPanel
      date={selectedDate}
      isToday={selectedIsToday}
      holiday={selectedHoliday}
      loading={loading}
      prayerTimes={prayerTimes}
      error={error}
      onRetry={retry}
      onOpenSettings={openSettings}
      nextPrayer={nextPrayer}
      timeLeft={timeLeft}
      statuses={statuses}
      onPressPrayer={(name, label) => setPrayerSheet({ name, label })}
    />
    <View style={{ height: spacing.lg }} />
    <HabitChecklist habits={habits} done={habitDone} onToggle={toggleHabit} />
  </>
) : (
  // ...unchanged prompt branch...
)}
```

- [ ] **Step 5: Keep `screen-contracts` green — mock `useHabits` + `useHabitLog`**

In `frontend/__tests__/screens/screen-contracts.test.tsx`, add near the other hook mocks:

```tsx
jest.mock("@/hooks/useHabits", () => ({
  useHabits: jest.fn(() => ({
    habits: [],
    create: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  })),
}));

jest.mock("@/hooks/useHabitLog", () => ({
  useHabitLog: jest.fn(() => ({ done: {}, toggle: jest.fn() })),
  useHabitLogAll: jest.fn(() => ({})),
}));
```

- [ ] **Step 6: Run the new test and the contracts suite**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitChecklist.test.tsx __tests__/screens/screen-contracts.test.tsx`
Expected: PASS (both suites).

- [ ] **Step 7: Commit**

```bash
git add frontend/components/tracking/HabitChecklist.tsx frontend/app/(tabs)/Calendar.tsx frontend/__tests__/screens/screen-contracts.test.tsx frontend/__tests__/components/tracking/HabitChecklist.test.tsx
git commit -m "feat(tracking): add per-day habit checklist to Calendar"
```

---

### Task 14: Docs + full verify

**Files:**
- Modify: `frontend/__tests__/README.md` (document the new Phase-3 suites)
- Modify: `CLAUDE.md` (note the Tracker route + Fraunces display font convention)

**Interfaces:** none (documentation + green-suite gate).

- [ ] **Step 1: Update `frontend/__tests__/README.md`**

Add entries (matching the file's existing format) for the new suites created in this phase:
- `components/ui/DisplayNumber.test.tsx` — display-numeral font/style
- `services/tracking/stats.phase3.test.ts` — `unwrapHabitLog`, `monthDailyScores`
- `hooks/useHabits.test.ts`, `hooks/useHabitLog.test.ts`, `hooks/useTrackingStats.test.ts`
- `components/tracking/StatCards.test.tsx`, `CompletionRings.test.tsx`, `MonthHeatmap.test.tsx`, `HabitRow.test.tsx`, `HabitEditor.test.tsx`, `HabitChecklist.test.tsx`
- `screens/Tracker.test.tsx`, `screens/home-tracker-affordance.test.tsx`

- [ ] **Step 2: Update `CLAUDE.md`**

Under the relevant conventions, add two short notes:
- **Display font:** "Large stat numerals use Fraunces via `@/components/ui/DisplayNumber` (`DISPLAY_FONT_FAMILY = "Fraunces_700Bold"`, loaded in `app/_layout.tsx`). The streak flame `🔥` is the only emoji; all other icons are Ionicons."
- **Routes:** "`/Tracker` is a stack route (registered in `app/_layout.tsx`) reached from Home's 'View tracker & habits' affordance."

- [ ] **Step 3: Run the full verification suite**

Run: `npm run verify`
Expected: lint clean, typecheck clean, full Jest suite (all prior suites + every new Phase-3 suite) passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/__tests__/README.md CLAUDE.md
git commit -m "docs(tracking): document Phase 3 tracker/habits suites + conventions"
```

---

## Self-Review

**Spec coverage (Phase 3 = Tracker screen + habit UI + display font):**
- Display font for large numerals only, via `expo-font` → Task 1 (Fraunces + `DisplayNumber`); used in Tasks 6, 7, 8 (hero, rings, qada). ✓
- Tracker screen with Overview (StreakHero, CompletionRings, MonthHeatmap, QadaCard) + Habits section → Tasks 6–11. ✓
- Streaks (prayer + per-habit), monthly completion %, qada → Tasks 5 (`useTrackingStats`), 9/11 (`habitStreak`). Reuses Phase-1 pure stats; adds `monthDailyScores` + `unwrapHabitLog` (Task 2). ✓
- Habit management: create/edit/reorder/archive/delete, flexible daily/weekly, Ionicons glyph picker → Tasks 3 (`useHabits`), 9 (`HabitRow`), 10 (`HabitEditor`), 11 (Tracker wiring). Reorder/archive use **simple controls** per the chosen UX. ✓
- Home streak chip + "View tracker & habits →" → Task 12. ✓
- Calendar per-day habit checklist → Task 13. ✓
- Cross-screen sync via `HABITS_UPDATED` / `HABIT_LOG_UPDATED` / `PRAYER_LOG_UPDATED` → Tasks 3, 4, 5. ✓
- No emoji except the streak flame; all icons Ionicons → enforced in every component (flame only in StreakHero/HabitRow/Home chip). ✓
- **Intentionally deferred to Phase 4:** the streak-aware reminder service (`tracking/reminders.ts`), `tracking:reminder_prefs_v1`, notification channels, and any reminder UI in `HabitEditor`. The `Habit.reminder` field is left unused.

**Placeholder scan:** every code step has complete, runnable code; every command has expected output. The two documentation steps (Task 14) reference concrete files/entries to add, not vague TODOs.

**Type consistency:** `PrayerName`/`PrayerStatus` and `Habit`/`HabitFrequency`/`HabitReminder` come from the existing facades throughout. `DISPLAY_FONT_FAMILY`/`DisplayNumber` (Task 1) are consumed by Tasks 6–8. `frequencyLabel` (Task 9) is reused in Task 13. `useTrackingStats`'s `TrackingStats` shape (Task 5) matches its consumers in Tasks 11 and 12. `useHabits` return shape (Task 3) matches Tasks 11 and the screen-contracts mock (Task 13). `useHabitLog`/`useHabitLogAll` (Task 4) match Tasks 11 and 13. `habitStreak(habit, doneByDay, habitId, todayKey)` (Phase-1 signature) is called correctly in Task 11 with `useHabitLogAll()` output.
