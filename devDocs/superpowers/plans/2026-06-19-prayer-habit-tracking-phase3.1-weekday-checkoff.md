# Prayer & Habit Tracking — Phase 3.1 (Weekday Habits + Tracker Check-off) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "N× per week (any days)" habit model with **specific weekday(s)** scheduling, and let users mark a habit done for **today directly from the Tracker habit rows** (not only the Calendar checklist).

**Architecture:** Two user-chosen refinements to Phase 3. (1) `HabitFrequency` weekly variant changes from `{ type: "weekly"; timesPerWeek }` to `{ type: "weekly"; days: number[] }` (`days` = weekday indices, 0=Sun…6=Sat). A `isHabitDueOnDate(freq, date)` helper drives where a habit appears; `frequencyLabel` lists the weekdays; the weekly streak counts consecutive *scheduled occurrences* completed; the editor uses a weekday multi-select; the Calendar checklist only shows a habit on days it is due. Legacy weekly habits (with `timesPerWeek`) are migrated to Daily on read (no weekday info is recoverable from a count). (2) Each Tracker `HabitRow` gains a leading check-off circle that toggles **today's** completion — interactive only when the habit is due today.

**Tech Stack:** React Native 0.81 / Expo 54, TypeScript, `@gorhom/bottom-sheet`, `@expo/vector-icons` (Ionicons), Jest + `@testing-library/react-native`. Path alias `@/` → `frontend/`.

**Plan series:** Phase 3.1, builds directly on Phase 3 (`docs`/`devDocs/superpowers/plans/2026-06-19-prayer-habit-tracking-phase3-tracker-habits.md`). Phase 4 (reminders) remains out of scope.

## Global Constraints

- All commands run from `frontend/`. Path alias `@/` → `frontend/`. Frontend Jest is Babel-based — no dynamic `import()`. AsyncStorage, `expo-glass-effect`, `expo-blur` are already globally mocked in `test/setup/jest.setup.ts` — do NOT re-mock them.
- **Theming:** all UI uses `useTheme()` + a `createStyles(theme)` factory. NEVER static color constants; `withOpacity(hex, alpha)` for fills/borders. Status colors: prayed → `accentSecondary`, late → `accent`, missed → `danger`. Done/active habit accents use `accentSecondary` (emerald).
- **Iconography:** Ionicons only; the streak flame `🔥` is the ONLY emoji. Dynamic glyph names cast via `as keyof typeof Ionicons.glyphMap` — never `as any`.
- **Weekday model:** `HabitFrequency` weekly variant is `{ type: "weekly"; days: number[] }` where each entry is a weekday index from `Date.getDay()` (0=Sunday … 6=Saturday), stored sorted-ascending and de-duplicated. Daily stays `{ type: "daily" }`.
- **Weekday short names** (index 0→6): `["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]`.
- **Migration:** any persisted habit whose `frequency.type === "weekly"` but whose `frequency.days` is not an array (i.e. legacy `timesPerWeek`) is coerced to `{ type: "daily" }` on read. Do not bump `updatedAt` during this coercion.
- **Due semantics:** `isHabitDueOnDate(freq, date)` → daily: always `true`; weekly: `freq.days.includes(date.getDay())`.
- **Storage key stays `tracking:habits_v1`** — no key bump (migration is read-side sanitize).
- Commit messages must contain NO `Co-Authored-By` or any trailers. Use HEREDOC; no interactive git flags.
- Verify with `npm run verify` (from `frontend/`) before the final commit.

---

### Task 1: Weekday frequency model — type, migration, `isHabitDueOnDate`, `frequencyLabel`

**Files:**
- Modify: `frontend/services/tracking/types.ts` (change `HabitFrequency` weekly variant)
- Modify: `frontend/services/tracking/habits.ts` (migrate legacy weekly on read)
- Modify: `frontend/utils/habitFrequency.ts` (`frequencyLabel` weekday list + new `isHabitDueOnDate` + `WEEKDAY_SHORT`)
- Modify: `frontend/__tests__/components/tracking/HabitRow.test.tsx` (its fixture/assertion used `timesPerWeek` — update to `days`)
- Modify: `frontend/__tests__/hooks/useHabits.test.ts` (its `create` call used `timesPerWeek` — update to `days`)
- Test: `frontend/__tests__/utils/habitFrequency.test.ts` (new) and `frontend/__tests__/services/tracking/habits.migration.test.ts` (new)

**Interfaces:**
- Consumes: `Habit`, `HabitFrequency` from `./types`.
- Produces:
  - `HabitFrequency = { type: "daily" } | { type: "weekly"; days: number[] }`.
  - `WEEKDAY_SHORT: readonly string[]` = `["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]`.
  - `frequencyLabel(freq): string` — daily → `"Daily"`; weekly with days → the day short-names joined `", "` in week order (e.g. `"Mon, Thu"`); weekly with empty days → `"Weekly"`.
  - `isHabitDueOnDate(freq: HabitFrequency, date: Date): boolean` — daily → `true`; weekly → `freq.days.includes(date.getDay())`.
  - Migration: `getAllHabits()` coerces any persisted `{type:"weekly"}` lacking an array `days` into `{type:"daily"}`.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/__tests__/utils/habitFrequency.test.ts
import { frequencyLabel, isHabitDueOnDate, WEEKDAY_SHORT } from "@/utils/habitFrequency";

describe("frequencyLabel", () => {
  it("formats daily, weekday list, and empty weekly", () => {
    expect(frequencyLabel({ type: "daily" })).toBe("Daily");
    expect(frequencyLabel({ type: "weekly", days: [1, 4] })).toBe("Mon, Thu");
    expect(frequencyLabel({ type: "weekly", days: [] })).toBe("Weekly");
  });
  it("lists days in week order regardless of input order", () => {
    expect(frequencyLabel({ type: "weekly", days: [4, 1, 0] })).toBe("Sun, Mon, Thu");
  });
});

describe("isHabitDueOnDate", () => {
  it("daily is always due", () => {
    expect(isHabitDueOnDate({ type: "daily" }, new Date(2026, 5, 16))).toBe(true);
  });
  it("weekly is due only on its weekdays", () => {
    const tue = new Date(2026, 5, 16); // 2026-06-16 is a Tuesday (getDay()===2)
    const thu = new Date(2026, 5, 18); // Thursday (getDay()===4)
    expect(isHabitDueOnDate({ type: "weekly", days: [4] }, tue)).toBe(false);
    expect(isHabitDueOnDate({ type: "weekly", days: [4] }, thu)).toBe(true);
  });
  it("WEEKDAY_SHORT is Sun..Sat", () => {
    expect(WEEKDAY_SHORT[0]).toBe("Sun");
    expect(WEEKDAY_SHORT[6]).toBe("Sat");
  });
});
```

```ts
// frontend/__tests__/services/tracking/habits.migration.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const HABITS_KEY = "tracking:habits_v1";

describe("legacy weekly habit migration", () => {
  beforeEach(async () => {
    jest.resetModules();
    await AsyncStorage.clear();
  });

  it("coerces a legacy {weekly, timesPerWeek} habit to daily on read", async () => {
    const legacy = [
      {
        id: "h1",
        name: "Tahajjud",
        icon: "moon-outline",
        frequency: { type: "weekly", timesPerWeek: 3 },
        order: 0,
        archived: false,
        createdAtKey: "2026-06-01",
        updatedAt: 1,
      },
    ];
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(legacy));
    const { getActiveHabits } = require("@/services/tracking/habits");
    const habits = await getActiveHabits();
    expect(habits[0].frequency).toEqual({ type: "daily" });
  });

  it("leaves a valid {weekly, days} habit untouched", async () => {
    const valid = [
      {
        id: "h2",
        name: "Fast",
        icon: "restaurant-outline",
        frequency: { type: "weekly", days: [1, 4] },
        order: 0,
        archived: false,
        createdAtKey: "2026-06-01",
        updatedAt: 1,
      },
    ];
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(valid));
    const { getActiveHabits } = require("@/services/tracking/habits");
    const habits = await getActiveHabits();
    expect(habits[0].frequency).toEqual({ type: "weekly", days: [1, 4] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --runTestsByPath __tests__/utils/habitFrequency.test.ts __tests__/services/tracking/habits.migration.test.ts`
Expected: FAIL — `isHabitDueOnDate`/`WEEKDAY_SHORT` not exported; migration not applied.

- [ ] **Step 3: Change the `HabitFrequency` type**

In `frontend/services/tracking/types.ts`, replace the weekly variant:

```ts
export type HabitFrequency =
  | { type: "daily" }
  | { type: "weekly"; days: number[] };
```

- [ ] **Step 4: Rewrite `utils/habitFrequency.ts`**

```ts
// frontend/utils/habitFrequency.ts
import type { HabitFrequency } from "@/services/habitTracker";

export const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export function frequencyLabel(freq: HabitFrequency): string {
  if (freq.type === "daily") return "Daily";
  if (freq.days.length === 0) return "Weekly";
  return [...freq.days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d])
    .join(", ");
}

export function isHabitDueOnDate(freq: HabitFrequency, date: Date): boolean {
  if (freq.type === "daily") return true;
  return freq.days.includes(date.getDay());
}
```

- [ ] **Step 5: Add the migration to `habits.ts`**

In `frontend/services/tracking/habits.ts`, add a coercion helper and apply it where the persisted array is parsed inside `getAllHabits()`. The current load does `cache = Array.isArray(parsed) ? (parsed as Habit[]) : [];` — change it to map through the migration:

```ts
function migrateHabitFrequency(h: Habit): Habit {
  const f = h.frequency as { type?: string; days?: unknown };
  if (f?.type === "weekly" && !Array.isArray(f.days)) {
    return { ...h, frequency: { type: "daily" } };
  }
  return h;
}
```

```ts
        cache = Array.isArray(parsed)
          ? (parsed as Habit[]).map(migrateHabitFrequency)
          : [];
```

(Do not bump `updatedAt`; the coerced shape persists on the next normal write.)

- [ ] **Step 6: Fix the two existing fixtures that used `timesPerWeek`**

In `frontend/__tests__/components/tracking/HabitRow.test.tsx`, change the habit fixture's frequency and the expected label:
- `frequency: { type: "weekly", timesPerWeek: 3 }` → `frequency: { type: "weekly", days: [1, 4] }`
- the assertion `expect(getByText("3× / week"))` → `expect(getByText("Mon, Thu"))`

In `frontend/__tests__/hooks/useHabits.test.ts`, change the `create` call:
- `frequency: { type: "weekly", timesPerWeek: 3 }` → `frequency: { type: "weekly", days: [1, 4] }`

- [ ] **Step 7: Run the new + touched tests**

Run: `npm test -- --runTestsByPath __tests__/utils/habitFrequency.test.ts __tests__/services/tracking/habits.migration.test.ts __tests__/components/tracking/HabitRow.test.tsx __tests__/hooks/useHabits.test.ts`
Expected: PASS (all four suites).

- [ ] **Step 8: Commit**

```bash
git add frontend/services/tracking/types.ts frontend/services/tracking/habits.ts frontend/utils/habitFrequency.ts frontend/__tests__/utils/habitFrequency.test.ts frontend/__tests__/services/tracking/habits.migration.test.ts frontend/__tests__/components/tracking/HabitRow.test.tsx frontend/__tests__/hooks/useHabits.test.ts
git commit -m "feat(tracking): weekday-based weekly habits + legacy migration"
```

---

### Task 2: Weekly streak = consecutive scheduled weekday occurrences

**Files:**
- Modify: `frontend/services/tracking/stats.ts` (`habitStreak` weekly branch)
- Modify: `frontend/__tests__/services/tracking/stats.test.ts` (its weekly-streak tests used `timesPerWeek` — replace with weekday cases). If the existing weekly tests live in a different stats test file, update that file instead — search the `__tests__/services/tracking/` directory for `timesPerWeek` and fix every occurrence.

**Interfaces:**
- Consumes: `addDaysKey` (already in `stats.ts`), `Habit`, `HabitFrequency`.
- Produces: `habitStreak(habit, doneByDay, habitId, todayKey)` weekly branch now walks backward over the habit's scheduled weekdays and counts consecutive completed scheduled occurrences, ending at the most recent scheduled day (today counts if done; if today is scheduled but not yet done, the run is measured from the previous scheduled occurrence so an in-progress day does not break it). Daily branch unchanged. Empty `days` → `0`.

- [ ] **Step 1: Write the failing tests**

Add (or replace the old weekly tests) in the stats test file:

```ts
// in frontend/__tests__/services/tracking/stats.test.ts (weekly streak section)
import { habitStreak } from "@/services/tracking/stats";

// Helper: weekday index of a YYYY-MM-DD key
const dow = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

describe("habitStreak (weekday weekly)", () => {
  // June 2026: 1=Mon, 4=Thu, 8=Mon, 11=Thu, 15=Mon, 18=Thu ...
  const mondaysThursdays = { type: "weekly" as const, days: [1, 4] };

  it("counts consecutive scheduled occurrences done, ending today", () => {
    const done = {
      "2026-06-08": { h: true }, // Mon
      "2026-06-11": { h: true }, // Thu
      "2026-06-15": { h: true }, // Mon
    };
    // today = Mon 2026-06-15 (done) -> streak 3
    expect(habitStreak(mondaysThursdays, done, "h", "2026-06-15")).toBe(3);
  });

  it("today scheduled but not done does not break the prior run", () => {
    const done = {
      "2026-06-08": { h: true }, // Mon
      "2026-06-11": { h: true }, // Thu
    };
    // today = Mon 2026-06-15 (NOT done) -> measured from Thu 06-11 -> streak 2
    expect(habitStreak(mondaysThursdays, done, "h", "2026-06-15")).toBe(2);
  });

  it("a missed scheduled occurrence breaks the streak", () => {
    const done = {
      "2026-06-08": { h: true }, // Mon
      // 2026-06-11 Thu missed
      "2026-06-15": { h: true }, // Mon (today, done)
    };
    expect(habitStreak(mondaysThursdays, done, "h", "2026-06-15")).toBe(1);
  });

  it("empty days yields zero", () => {
    expect(habitStreak({ type: "weekly", days: [] }, {}, "h", "2026-06-15")).toBe(0);
  });

  it("ignores done marks on non-scheduled days", () => {
    // sanity: a Wednesday done mark must not count for a Mon/Thu habit
    expect(dow("2026-06-17")).toBe(3); // Wed
    const done = { "2026-06-17": { h: true } };
    expect(habitStreak(mondaysThursdays, done, "h", "2026-06-18")).toBe(0); // Thu today, not done
  });
});
```

(Before writing, delete the obsolete `timesPerWeek`-based weekly streak tests in this file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/stats.test.ts`
Expected: FAIL — current weekly branch uses `timesPerWeek` and won't compile / produces wrong values.

- [ ] **Step 3: Rewrite the weekly branch of `habitStreak`**

In `frontend/services/tracking/stats.ts`, replace the entire `// weekly:` block (the part after the daily branch) with a weekday-scheduled walk. Keep the daily branch and the `isDone` helper intact:

```ts
  // weekly: walk backward over the habit's scheduled weekdays, counting
  // consecutive completed scheduled occurrences. An in-progress today
  // (scheduled but not yet done) is not counted and does not break the run.
  const days = habit.frequency.days;
  if (days.length === 0) return 0;
  const scheduled = new Set(days);
  const weekdayOf = (dateKey: string): number => {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  };
  const prevScheduled = (dateKey: string): string => {
    let cursor = addDaysKey(dateKey, -1);
    while (!scheduled.has(weekdayOf(cursor))) cursor = addDaysKey(cursor, -1);
    return cursor;
  };

  // Find the most recent scheduled day on or before today.
  let cursor = todayKey;
  while (!scheduled.has(weekdayOf(cursor))) cursor = addDaysKey(cursor, -1);
  // If that day is today and not done yet, start from the previous occurrence.
  if (cursor === todayKey && !isDone(cursor)) cursor = prevScheduled(cursor);

  let streak = 0;
  while (isDone(cursor)) {
    streak += 1;
    cursor = prevScheduled(cursor);
  }
  return streak;
```

(The `isDone(dateKey)` helper defined at the top of `habitStreak` already returns `doneByDay[dateKey]?.[habitId] === true`, so non-scheduled `done` marks are never visited and cannot count.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/services/tracking/stats.test.ts`
Expected: PASS (all stats tests, including the new weekday-streak cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/tracking/stats.ts frontend/__tests__/services/tracking/stats.test.ts
git commit -m "feat(tracking): weekly streak counts scheduled weekday occurrences"
```

---

### Task 3: `HabitEditor` weekday picker

**Files:**
- Modify: `frontend/components/tracking/HabitEditor.tsx`
- Modify: `frontend/__tests__/components/tracking/HabitEditor.test.tsx`

**Interfaces:**
- Consumes: `WEEKDAY_SHORT` from `@/utils/habitFrequency`; `HabitFrequency`.
- Produces: when "Weekly" is selected, render a 7-button weekday selector (Sun…Sat) instead of the times-per-week stepper. State `selectedDays: number[]`. Tapping a day toggles its index. Save builds `{ type: "weekly", days: [...selectedDays].sort((a,b)=>a-b) }`; **Save is disabled for weekly with zero days selected** (in addition to the existing non-empty-name rule). Each weekday button has `accessibilityLabel={`Toggle ${WEEKDAY_SHORT[i]}`}` and `accessibilityState={{ selected }}`. Editing an existing weekly habit initialises `selectedDays` from `initial.frequency.days`.

- [ ] **Step 1: Update the failing test**

Replace the weekly test in `frontend/__tests__/components/tracking/HabitEditor.test.tsx` (the one that used the stepper) with a weekday-picker version, and keep the daily test:

```tsx
  it("builds a weekly frequency from selected weekdays", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText, getByLabelText } = render(
      wrap(<HabitEditor visible initial={null} onSubmit={onSubmit} onClose={jest.fn()} />),
    );
    fireEvent.changeText(getByPlaceholderText("Habit name"), "Fast");
    fireEvent.press(getByText("Weekly"));
    fireEvent.press(getByLabelText("Toggle Mon"));
    fireEvent.press(getByLabelText("Toggle Thu"));
    fireEvent.press(getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Fast", frequency: { type: "weekly", days: [1, 4] } }),
    );
  });

  it("does not submit a weekly habit with no days selected", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      wrap(<HabitEditor visible initial={null} onSubmit={onSubmit} onClose={jest.fn()} />),
    );
    fireEvent.changeText(getByPlaceholderText("Habit name"), "Fast");
    fireEvent.press(getByText("Weekly"));
    fireEvent.press(getByText("Save"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
```

(The existing "creates a daily habit" test stays as-is; the daily payload is still `{ type: "daily" }`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitEditor.test.tsx`
Expected: FAIL — no weekday toggles; old stepper code.

- [ ] **Step 3: Implement the weekday picker**

In `frontend/components/tracking/HabitEditor.tsx`:

1. Import: `import { WEEKDAY_SHORT } from "@/utils/habitFrequency";`
2. Replace the `weekly`/`timesPerWeek` state with weekday state:
```tsx
  const [weekly, setWeekly] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
```
3. In the open-init effect, replace the frequency init lines with:
```tsx
      const f = initial?.frequency;
      setWeekly(f?.type === "weekly");
      setSelectedDays(f?.type === "weekly" ? [...f.days] : []);
```
4. Replace the `canSave` / `handleSave` frequency logic:
```tsx
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && (!weekly || selectedDays.length > 0);

  const toggleDay = useCallback((index: number) => {
    setSelectedDays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index],
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSubmit({
      name: trimmed,
      icon,
      frequency: weekly
        ? { type: "weekly", days: [...selectedDays].sort((a, b) => a - b) }
        : { type: "daily" },
    });
    onClose();
  }, [canSave, trimmed, icon, weekly, selectedDays, onSubmit, onClose]);
```
5. Replace the `{weekly ? (<stepper/>) : null}` block with the weekday selector:
```tsx
        {weekly ? (
          <View style={styles.weekdayRow}>
            {WEEKDAY_SHORT.map((label, index) => {
              const selected = selectedDays.includes(index);
              return (
                <PressableScale
                  key={label}
                  onPress={() => toggleDay(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle ${label}`}
                  accessibilityState={{ selected }}
                  style={[styles.weekday, selected && styles.weekdayActive]}
                >
                  <Caption color={selected ? colors.onAccent : colors.white}>{label}</Caption>
                </PressableScale>
              );
            })}
          </View>
        ) : null}
```
6. Remove the now-unused stepper styles (`stepper`, `stepBtn`, `stepValue`) and add:
```tsx
    weekdayRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.xs },
    weekday: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.chip,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    weekdayActive: { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary },
```
7. Ensure `Caption` is imported from `@/components/ui/Text` (it already imports `Headline`/`Title3`; add `Caption`). Remove the now-unused `Ionicons` `remove`/`add` stepper usages only if they are not used elsewhere in the file (the glyph picker still uses `Ionicons`, so keep the import).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitEditor.test.tsx`
Expected: PASS (daily, weekly-from-weekdays, and no-days-guard tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/tracking/HabitEditor.tsx frontend/__tests__/components/tracking/HabitEditor.test.tsx
git commit -m "feat(tracking): weekday picker in HabitEditor"
```

---

### Task 4: Calendar checklist shows habits only on due days

**Files:**
- Modify: `frontend/components/tracking/HabitChecklist.tsx`
- Modify: `frontend/__tests__/components/tracking/HabitChecklist.test.tsx`

**Interfaces:**
- Consumes: `isHabitDueOnDate` from `@/utils/habitFrequency`; `Habit`.
- Produces: `HabitChecklist` gains a required `date: Date` prop. It filters `habits` to those where `isHabitDueOnDate(habit.frequency, date)` is true before rendering rows; if none are due, it renders nothing (same as the empty case). Daily habits show every day; weekly habits show only on their weekdays. All other behavior (toggle, a11y) unchanged. New prop signature: `HabitChecklist({ habits, done, date, onToggle })`.

- [ ] **Step 1: Update the failing test**

In `frontend/__tests__/components/tracking/HabitChecklist.test.tsx`, pass a `date` and add a due-filter case:

```tsx
  it("hides a weekly habit on a non-scheduled day", () => {
    const weekly: Habit[] = [
      { id: "w1", name: "Fast", icon: "restaurant-outline", frequency: { type: "weekly", days: [4] }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
    ];
    const tue = new Date(2026, 5, 16); // Tuesday
    const { queryByText } = render(wrap(<HabitChecklist habits={weekly} done={{}} date={tue} onToggle={jest.fn()} />));
    expect(queryByText("Fast")).toBeNull();
    expect(queryByText("Habits")).toBeNull(); // nothing due -> card hidden
  });

  it("shows a weekly habit on its scheduled day", () => {
    const weekly: Habit[] = [
      { id: "w1", name: "Fast", icon: "restaurant-outline", frequency: { type: "weekly", days: [4] }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
    ];
    const thu = new Date(2026, 5, 18); // Thursday
    const { getByText } = render(wrap(<HabitChecklist habits={weekly} done={{}} date={thu} onToggle={jest.fn()} />));
    expect(getByText("Fast")).toBeTruthy();
  });
```

Update the two existing tests ("toggles a habit", "renders nothing when there are no habits") to pass `date={new Date(2026, 5, 18)}` (a Thursday) and keep their daily-habit fixtures (daily is always due).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitChecklist.test.tsx`
Expected: FAIL — `date` prop not accepted; no filtering.

- [ ] **Step 3: Add due-day filtering**

In `frontend/components/tracking/HabitChecklist.tsx`:
1. Import: `import { frequencyLabel, isHabitDueOnDate } from "@/utils/habitFrequency";` (it already imports `frequencyLabel`; add `isHabitDueOnDate`).
2. Add `date: Date` to `Props`.
3. Compute the due list and early-return when empty:
```tsx
  const dueHabits = habits.filter((h) => isHabitDueOnDate(h.frequency, date));
  if (dueHabits.length === 0) return null;
```
4. Map over `dueHabits` instead of `habits` in the render.

- [ ] **Step 4: Pass `date` from Calendar**

In `frontend/app/(tabs)/Calendar.tsx`, the `<HabitChecklist ... />` render must pass the selected date. It is rendered for the `selectedDate` branch, so add `date={selectedDate}` to the props (the branch only renders when `selectedDate` is non-null). Read the current `<HabitChecklist>` call site and add the `date` prop.

- [ ] **Step 5: Run test + typecheck**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitChecklist.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean (Calendar now passes `date`).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/tracking/HabitChecklist.tsx frontend/app/(tabs)/Calendar.tsx frontend/__tests__/components/tracking/HabitChecklist.test.tsx
git commit -m "feat(tracking): Calendar checklist shows habits only on due days"
```

---

### Task 5: Tracker habit rows — check off today

**Files:**
- Modify: `frontend/components/tracking/HabitRow.tsx`
- Modify: `frontend/app/Tracker.tsx`
- Modify: `frontend/__tests__/components/tracking/HabitRow.test.tsx`
- Modify: `frontend/__tests__/screens/Tracker.test.tsx`

**Interfaces:**
- Consumes (HabitRow): `isHabitDueOnDate` from `@/utils/habitFrequency`.
- Produces:
  - `HabitRow` gains three props: `dueToday: boolean`, `doneToday: boolean`, `onToggleToday: () => void`. It renders a leading check-off control: when `dueToday` is true, a `PressableScale` circle (Ionicons `checkmark-circle` filled `accentSecondary` when `doneToday`, else `ellipse-outline`) with `accessibilityRole="checkbox"`, `accessibilityState={{ checked: doneToday }}`, `accessibilityLabel={`Mark ${habit.name} done today`}` calling `onToggleToday`. When `dueToday` is false, render a non-interactive muted dot (`testID={`habitrow-notdue-${habit.id}`}`) in the same slot so the row layout is stable. Existing name / frequency badge / streak / move / edit / archive controls are unchanged.
  - `Tracker` computes `todayKey = dateKeyFromDate(new Date())` and `today = new Date()`, reads today's done map via `useHabitLog(todayKey)`, and passes to each `HabitRow`: `dueToday={isHabitDueOnDate(habit.frequency, today)}`, `doneToday={!!done[habit.id]}`, `onToggleToday={() => toggle(habit.id)}`.

- [ ] **Step 1: Update the failing tests**

In `frontend/__tests__/components/tracking/HabitRow.test.tsx`, add the new props to the existing render and assert the check-off:

```tsx
  it("fires onToggleToday when due today", () => {
    const onToggleToday = jest.fn();
    const { getByLabelText } = render(
      wrap(
        <HabitRow
          habit={habit}
          streak={5}
          dueToday
          doneToday={false}
          onToggleToday={onToggleToday}
          canMoveUp
          canMoveDown
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          onEdit={jest.fn()}
          onArchive={jest.fn()}
        />,
      ),
    );
    fireEvent.press(getByLabelText("Mark Read Qur'an done today"));
    expect(onToggleToday).toHaveBeenCalled();
  });

  it("shows a non-interactive marker when not due today", () => {
    const { getByTestId, queryByLabelText } = render(
      wrap(
        <HabitRow
          habit={habit}
          streak={5}
          dueToday={false}
          doneToday={false}
          onToggleToday={jest.fn()}
          canMoveUp
          canMoveDown
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          onEdit={jest.fn()}
          onArchive={jest.fn()}
        />,
      ),
    );
    expect(getByTestId(`habitrow-notdue-${habit.id}`)).toBeTruthy();
    expect(queryByLabelText("Mark Read Qur'an done today")).toBeNull();
  });
```

Update the EXISTING "renders name, frequency, streak and fires actions" test to also pass `dueToday`, `doneToday={false}`, and `onToggleToday={jest.fn()}` so it compiles.

In `frontend/__tests__/screens/Tracker.test.tsx`, the `@/hooks/useHabitLog` mock currently exports `useHabitLogAll` only; add `useHabitLog`:
```tsx
jest.mock("@/hooks/useHabitLog", () => ({
  useHabitLog: () => ({ done: {}, toggle: jest.fn() }),
  useHabitLogAll: () => ({}),
}));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitRow.test.tsx __tests__/screens/Tracker.test.tsx`
Expected: FAIL — new props/controls not present.

- [ ] **Step 3: Add the check-off control to `HabitRow`**

In `frontend/components/tracking/HabitRow.tsx`:
1. Add the three props to `Props` and the destructured signature: `dueToday`, `doneToday`, `onToggleToday`.
2. Render the leading control as the first child of the row (before the icon):
```tsx
      {dueToday ? (
        <PressableScale
          onPress={onToggleToday}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: doneToday }}
          accessibilityLabel={`Mark ${habit.name} done today`}
          style={styles.check}
        >
          <Ionicons
            name={doneToday ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={doneToday ? colors.accentSecondary : withOpacity(colors.white, 0.5)}
          />
        </PressableScale>
      ) : (
        <View testID={`habitrow-notdue-${habit.id}`} style={styles.notDue} />
      )}
```
3. Add styles:
```tsx
    check: { paddingRight: spacing.xs },
    notDue: {
      width: 10,
      height: 10,
      borderRadius: 999,
      marginRight: spacing.xs + 2,
      marginLeft: spacing.xs,
      backgroundColor: withOpacity(colors.white, 0.18),
    },
```

- [ ] **Step 4: Wire today's log into `Tracker`**

In `frontend/app/Tracker.tsx`:
1. Imports: add `import { isHabitDueOnDate } from "@/utils/habitFrequency";` and `import { useHabitLog } from "@/hooks/useHabitLog";` (it already imports `useHabitLogAll`).
2. Add near the other hook calls:
```tsx
  const today = new Date();
  const { done: doneToday, toggle: toggleToday } = useHabitLog(todayKey);
```
(`todayKey` already exists in the screen.)
3. Pass to each `<HabitRow>`:
```tsx
                dueToday={isHabitDueOnDate(habit.frequency, today)}
                doneToday={!!doneToday[habit.id]}
                onToggleToday={() => void toggleToday(habit.id)}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/HabitRow.test.tsx __tests__/screens/Tracker.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/tracking/HabitRow.tsx frontend/app/Tracker.tsx frontend/__tests__/components/tracking/HabitRow.test.tsx frontend/__tests__/screens/Tracker.test.tsx
git commit -m "feat(tracking): check off habits for today from the Tracker"
```

---

### Task 6: Full verify + docs

**Files:**
- Modify: `frontend/__tests__/README.md` (note the two new suites: `utils/habitFrequency.test.ts`, `services/tracking/habits.migration.test.ts`)
- Modify: `CLAUDE.md` (update the habit-frequency note: weekly = specific weekdays; Tracker rows check off today)

**Interfaces:** none (green-suite gate + docs).

- [ ] **Step 1: Update docs**

Add the two new Phase-3.1 suites to `frontend/__tests__/README.md` matching its existing format. In root `CLAUDE.md`, update the tracking notes to record: "Habit weekly frequency = specific weekdays (`{type:'weekly', days:number[]}`, 0=Sun..6=Sat); legacy `timesPerWeek` habits migrate to Daily on read. Habits are checked off for today from the Tracker rows (due days only) and for any date from the Calendar checklist."

- [ ] **Step 2: Run the full verification suite**

Run: `npm run verify`
Expected: lint clean, typecheck clean, full Jest suite green. If anything fails (especially a leftover `timesPerWeek` reference the per-file runs didn't surface), fix the root cause and re-run until green.

- [ ] **Step 3: Commit**

```bash
git add frontend/__tests__/README.md CLAUDE.md
git commit -m "docs(tracking): document weekday habits + Tracker check-off"
```

---

## Self-Review

**Spec coverage:**
- Weekly = specific weekday(s): type change + `isHabitDueOnDate` + `frequencyLabel` (Task 1), streak (Task 2), editor picker (Task 3), Calendar due-filtering (Task 4). ✓
- Legacy migration to Daily on read (Task 1). ✓
- Daily check-off from Tracker rows, due-days-only (Task 5). ✓
- Calendar checklist still works for any date; now due-filtered (Task 4). ✓
- Full green verify + docs (Task 6). ✓

**Placeholder scan:** every code step has complete code; the only "read the current call site" instructions (Task 4 Step 4, Task 5) name the exact prop to add. No TODOs.

**Type consistency:** `HabitFrequency` weekly is `{ type:"weekly"; days:number[] }` everywhere after Task 1; `isHabitDueOnDate`/`frequencyLabel`/`WEEKDAY_SHORT` (Task 1) are consumed by Tasks 3, 4, 5; `habitStreak` (Task 2) keeps its 4-arg signature; `HabitRow`'s new `dueToday`/`doneToday`/`onToggleToday` props (Task 5) match the Tracker call site; `HabitChecklist`'s new `date` prop (Task 4) matches the Calendar call site. The full `npm run verify` (Task 6) is the backstop for any leftover `timesPerWeek` reference.
