# Calendar Inline-Agenda + Liquid Glass Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Calendar tab's "tap a day → push a separate `/[date]` page" flow with an inline agenda — the month grid stays pinned at the top and the selected day's detail renders directly beneath it — and restyle the day detail with the glass system.

**Architecture:** Extract the day detail into a shared presentational `DayDetailPanel` consumed both inline by `Calendar.tsx` and by the retained `/[date]` route (Home + deep links). `PrayerArc` gains a `live` flag (full sun/progress/next-ring for today, static shell otherwise). The grid always reserves 6 week-rows so the panel never shifts between months.

**Tech Stack:** Expo SDK 54 / React Native 0.81 / Expo Router 6, TypeScript, RN `Animated` (no Reanimated here), `expo-glass-effect`, `react-native-svg`, Jest + `jest-expo` + `@testing-library/react-native`.

## Global Constraints

- **Imports:** use the `@/` alias for all frontend imports (maps to `frontend/`).
- **Theming:** themed UI uses `useTheme()` + a `createStyles(theme)` factory; never static color constants. Transparency via `withOpacity(hex, alpha)`.
- **Glass:** place glass only via `GlassSurface` (`tier="chrome"|"card"|"row"`). **Never animate the opacity of a `GlassView`/`GlassSurface` or any ancestor** — it stops the material rendering. Animate `translateX` or non-glass children instead.
- **Type ramp:** use the typed `Text` components (`LargeTitle`, `Title2`, `Headline`, `Body`, `Caption`, …) from `@/components/ui/Text`; do not hand-set `fontSize`/`fontFamily`.
- **Radii/spacing:** use `theme.radii.*` and `theme.spacing.*`.
- **Haptics:** via `useHaptics()` — `"selection"` for day/month selection, `"light"` for the missed-fast toggle.
- **Tests:** all commands run from `frontend/`. Run a single file with `npm test -- --runTestsByPath <path>`. `npm run verify` = lint + typecheck + test. Jest has `clearMocks: true` (mocks auto-reset between tests).
- **Run all test commands from the `frontend/` directory.**

---

## File Structure

**Create:**
- `frontend/components/calendar/DayDetailPanel.tsx` — presentational day detail (date heading + Hijri + holiday chip, per-day Ramadan toggle, `PrayerArc`, error/empty states). One responsibility: render everything about *one selected day*, given data via props.
- `frontend/__tests__/components/day-detail-panel.contract.test.tsx` — DayDetailPanel render contract.

**Modify:**
- `frontend/components/PrayerArc.tsx` — add `live?: boolean` (default `true`); gate sun/progress/next-ring/breathing + label on it.
- `frontend/__tests__/components/prayer-arc.contract.test.tsx` — **create** (no existing PrayerArc test) covering live vs static label.
- `frontend/hooks/useCalendarViewState.ts` — expose `fullMatrix` (untrimmed 6-row matrix).
- `frontend/__tests__/hooks/useCalendarViewState.test.ts` — add a `fullMatrix` assertion.
- `frontend/app/(tabs)/Calendar.tsx` — host `selectedDate` + day hooks; fixed 6-row grid; inline selection (no push); default-select-today; abbreviated top-right month switcher; inline Ramadan-summary jump; adopt `Screen`/glass/typed text/haptics; render `DayDetailPanel` inline.
- `frontend/app/[date].tsx` — slim down to a glass back-header + glass-safe day swiper wrapping `DayDetailPanel`.
- `frontend/__tests__/navigation/routes-params.contract.test.tsx` — grid + Ramadan-summary assertions become inline-selection; add `fullMatrix` to the view-state mock.
- `frontend/__tests__/screens/screen-contracts.test.tsx` — mock the three day hooks; add `fullMatrix`; update month label + day a11y label.
- `frontend/__tests__/README.md` — note the two new suites.

**Unaffected (verify only):** `frontend/__tests__/navigation/navigation-contracts.test.tsx` (only tests `/[date]` back-nav, which is preserved), `frontend/__tests__/flows/calendar-missed-fast.flow.test.tsx` (tests hooks directly, no UI).

---

## Task 1: `PrayerArc` static (`live`) mode

**Files:**
- Modify: `frontend/components/PrayerArc.tsx`
- Test: `frontend/__tests__/components/prayer-arc.contract.test.tsx` (create)

**Interfaces:**
- Produces: `PrayerArc` now accepts `live?: boolean` (default `true`). When `false`: no sun/moon glyph, no gold progress overlay, no "next" ring, no breathing loop, all six markers neutral, label reads `PRAYER TIMES` (vs `TODAY'S PRAYERS` when live).

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/components/prayer-arc.contract.test.tsx`:

```tsx
import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GlassView: ({ children, ...p }: any) => React.createElement(View, p, children),
    isGlassEffectAPIAvailable: () => false,
  };
});

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import PrayerArc from "@/components/PrayerArc";

const TIMES = [
  { label: "Fajr", time: "5:31 AM" },
  { label: "Sunrise", time: "7:48 AM" },
  { label: "Dhuhr", time: "12:18 PM" },
  { label: "Asr", time: "3:42 PM" },
  { label: "Maghrib", time: "6:02 PM" },
  { label: "Isha", time: "7:29 PM" },
];

describe("PrayerArc live vs static", () => {
  it("shows the live label by default", () => {
    const { getByText } = render(
      <PrayerArc loading={false} prayerTimes={TIMES as any} nextPrayer={{ label: "Asr", time: "3:42 PM" }} />,
    );
    expect(getByText("TODAY'S PRAYERS")).toBeTruthy();
  });

  it("shows the static label and no next highlight when live=false", () => {
    const { getByText, queryByText } = render(
      <PrayerArc loading={false} prayerTimes={TIMES as any} nextPrayer={null} live={false} />,
    );
    expect(getByText("PRAYER TIMES")).toBeTruthy();
    expect(queryByText("TODAY'S PRAYERS")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/prayer-arc.contract.test.tsx`
Expected: FAIL — the second test errors because the label is hard-coded `TODAY'S PRAYERS` (and `live` is not a prop).

- [ ] **Step 3: Add the `live` prop and gate the live layer**

In `frontend/components/PrayerArc.tsx`:

Add `live` to the props type (after `now?: Date;`):

```tsx
type PrayerArcProps = {
  loading: boolean;
  prayerTimes: PrayerTime[];
  nextPrayer: { label: string; time: string } | null;
  now?: Date;
  live?: boolean;
};
```

Destructure it with a default:

```tsx
export default function PrayerArc({
  loading,
  prayerTimes,
  nextPrayer,
  now,
  live = true,
}: PrayerArcProps) {
```

Make `prayers` ignore the next-state when static (so no gold "next" marker/coloring):

```tsx
  const prayers = useMemo(
    () => prayerStates(prayerTimes, live ? (nextPrayer?.label ?? null) : null),
    [prayerTimes, nextPrayer, live],
  );
```

Compute the sun only when live:

```tsx
  const sun = useMemo(
    () => (loading || !live ? null : sunMarker(prayerTimes, now ?? new Date())),
    [loading, live, prayerTimes, now],
  );
```

Guard the breathing loop so it never runs when static:

```tsx
  useEffect(() => {
    if (!live) return;
    const loop = Animated.loop(
```

Swap the label:

```tsx
      <Caption color={withOpacity(colors.white, 0.5)} style={styles.label}>
        {live ? "TODAY'S PRAYERS" : "PRAYER TIMES"}
      </Caption>
```

In the static case, render the six markers in a uniform neutral style. Replace the `prayers.map((p) => (<Marker … />))` block with a state-overriding version:

```tsx
        {prayers.map((p) => (
          <Marker
            key={p.label}
            prayer={live ? p : { ...p, state: "upcoming" }}
            colors={colors}
            slot={styles.markerSlot}
            breathScale={breathScale}
            dim={loading}
          />
        ))}
```

In the times row, also neutralize state when static. Change the `prayers.map` inside `styles.row` to derive a local state:

```tsx
        {prayers.map((p) => {
          const state = live ? p.state : "upcoming";
          const nameColor =
            state === "next"
              ? colors.accent
              : withOpacity(colors.white, state === "passed" ? 0.4 : 0.75);
          const timeColor =
            state === "next"
              ? colors.accent
              : withOpacity(colors.white, state === "passed" ? 0.4 : 1);
          return (
```

(The `sunPoint`/progress `Path` already key off `sun`, which is now `null` when static, so they disappear automatically.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/prayer-arc.contract.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add components/PrayerArc.tsx __tests__/components/prayer-arc.contract.test.tsx
git commit -m "feat(prayer-arc): add static (non-today) live=false mode"
```

---

## Task 2: `useCalendarViewState` — expose `fullMatrix`

**Files:**
- Modify: `frontend/hooks/useCalendarViewState.ts`
- Test: `frontend/__tests__/hooks/useCalendarViewState.test.ts`

**Interfaces:**
- Produces: `useCalendarViewState(...)` return gains `fullMatrix: number[][]` — always exactly 6 rows × 7 (untrimmed; blank days are `0`). `visibleMatrix` is unchanged.

- [ ] **Step 1: Write the failing test**

Append to `frontend/__tests__/hooks/useCalendarViewState.test.ts` (inside the existing top-level `describe`; if the file renders the hook via `renderHook`, follow that pattern). Add:

```ts
it("exposes a full 6-row matrix regardless of month length", () => {
  const { result } = renderHook(() =>
    useCalendarViewState({ monthParam: "1", yearParam: "2027", isSmall: false }),
  );
  // February 2027 fits in 4 visible weeks, but fullMatrix is always 6 rows.
  expect(result.current.fullMatrix).toHaveLength(6);
  expect(result.current.fullMatrix.every((w) => w.length === 7)).toBe(true);
  expect(result.current.visibleMatrix.length).toBeLessThan(6);
});
```

(If `renderHook`/`useCalendarViewState` are not yet imported in this file, add `import { renderHook } from "@testing-library/react-native";` and `import { useCalendarViewState } from "@/hooks/useCalendarViewState";` at the top.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/hooks/useCalendarViewState.test.ts`
Expected: FAIL — `result.current.fullMatrix` is `undefined`.

- [ ] **Step 3: Return `fullMatrix` from the hook**

In `frontend/hooks/useCalendarViewState.ts`, add it to the returned object (alongside `visibleMatrix`):

```ts
    dayButtonSize,
    fullMatrix: matrix,
    visibleMatrix,
    monthName,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/hooks/useCalendarViewState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useCalendarViewState.ts __tests__/hooks/useCalendarViewState.test.ts
git commit -m "feat(calendar): expose untrimmed 6-row fullMatrix from view-state hook"
```

---

## Task 3: `DayDetailPanel` shared component

**Files:**
- Create: `frontend/components/calendar/DayDetailPanel.tsx`
- Test: `frontend/__tests__/components/day-detail-panel.contract.test.tsx`

**Interfaces:**
- Consumes: `PrayerArc` (`live` prop, Task 1).
- Produces: `DayDetailPanel` with this exact prop shape (later tasks pass it):

```ts
type DayDetailPanelProps = {
  date: Date;
  isToday: boolean;
  holiday: string | null;
  loading: boolean;
  prayerTimes: PrayerTime[];           // from "@/services/prayerTimes"
  error: PrayerTimesError | null;      // from "@/hooks/usePrayerTimes"
  onRetry: () => void;
  onOpenSettings: () => void;
  nextPrayer: { label: string; time: string } | null;
  timeLeft: string;
  isRamadan: boolean;
  isFastMissed: boolean;
  onToggleMissedFast: () => void;
};
```

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/components/day-detail-panel.contract.test.tsx`:

```tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GlassView: ({ children, ...p }: any) => React.createElement(View, p, children),
    isGlassEffectAPIAvailable: () => false,
  };
});

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

jest.mock("@/components/PrayerArc", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return (props: any) =>
    React.createElement(Text, { testID: "prayer-arc" }, props.live ? "live" : "static");
});

import DayDetailPanel from "@/components/calendar/DayDetailPanel";

const baseProps = {
  date: new Date(2026, 2, 15),
  isToday: false,
  holiday: null as string | null,
  loading: false,
  prayerTimes: [{ label: "Fajr", time: "5:31 AM" }] as any,
  error: null,
  onRetry: jest.fn(),
  onOpenSettings: jest.fn(),
  nextPrayer: null,
  timeLeft: "",
  isRamadan: false,
  isFastMissed: false,
  onToggleMissedFast: jest.fn(),
};

describe("DayDetailPanel", () => {
  it("renders a static arc for a non-today day", () => {
    const { getByTestId } = render(<DayDetailPanel {...baseProps} />);
    expect(getByTestId("prayer-arc")).toHaveTextContent("static");
  });

  it("renders a live arc for today", () => {
    const { getByTestId } = render(<DayDetailPanel {...baseProps} isToday />);
    expect(getByTestId("prayer-arc")).toHaveTextContent("live");
  });

  it("shows the holiday chip when a holiday is present", () => {
    const { getByText } = render(<DayDetailPanel {...baseProps} holiday="Laylat al-Mi'raj" />);
    expect(getByText("Laylat al-Mi'raj")).toBeTruthy();
  });

  it("shows the missed-fast toggle and fires it in Ramadan", () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      <DayDetailPanel {...baseProps} isRamadan onToggleMissedFast={onToggle} />,
    );
    fireEvent.press(getByLabelText("Mark fast as missed"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows the error card with a retry action", () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <DayDetailPanel
        {...baseProps}
        error={{ code: "GENERIC", message: "boom" }}
        onRetry={onRetry}
      />,
    );
    fireEvent.press(getByText("Try again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/day-detail-panel.contract.test.tsx`
Expected: FAIL — module `@/components/calendar/DayDetailPanel` not found.

- [ ] **Step 3: Implement the component**

Create `frontend/components/calendar/DayDetailPanel.tsx`:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import PrayerArc from "@/components/PrayerArc";
import GlassSurface from "@/components/ui/GlassSurface";
import { Body, Caption, Headline, Title2 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import type { PrayerTimesError } from "@/hooks/usePrayerTimes";
import type { PrayerTime } from "@/services/prayerTimes";

type DayDetailPanelProps = {
  date: Date;
  isToday: boolean;
  holiday: string | null;
  loading: boolean;
  prayerTimes: PrayerTime[];
  error: PrayerTimesError | null;
  onRetry: () => void;
  onOpenSettings: () => void;
  nextPrayer: { label: string; time: string } | null;
  timeLeft: string;
  isRamadan: boolean;
  isFastMissed: boolean;
  onToggleMissedFast: () => void;
};

export default function DayDetailPanel({
  date,
  isToday,
  holiday,
  loading,
  prayerTimes,
  error,
  onRetry,
  onOpenSettings,
  nextPrayer,
  timeLeft,
  isRamadan,
  isFastMissed,
  onToggleMissedFast,
}: DayDetailPanelProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const haptics = useHaptics();

  const dateLine = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const hijri = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Title2 numberOfLines={1}>{isToday ? `Today · ${dateLine}` : dateLine}</Title2>
          <Caption color={withOpacity(colors.accent, 0.95)} style={styles.hijri}>
            {hijri}
          </Caption>
        </View>
        {holiday ? (
          <GlassSurface tier="row" radius={theme.radii.pill} style={styles.chip}>
            <Ionicons name="sparkles-outline" size={13} color={colors.accent} />
            <Caption color={colors.accent} numberOfLines={1} style={styles.chipText}>
              {holiday}
            </Caption>
          </GlassSurface>
        ) : null}
      </View>

      {isRamadan ? (
        <TouchableOpacity
          onPress={() => {
            haptics("light");
            onToggleMissedFast();
          }}
          accessibilityRole="button"
          accessibilityLabel={isFastMissed ? "Clear missed fast" : "Mark fast as missed"}
          style={[styles.toggle, isFastMissed ? styles.toggleOn : null]}
        >
          <Ionicons
            name={isFastMissed ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={isFastMissed ? colors.onAccent : colors.accent}
          />
          <Headline color={isFastMissed ? colors.onAccent : colors.accent} style={styles.toggleText}>
            {isFastMissed ? "Marked as missed fast" : "Mark fast as missed"}
          </Headline>
        </TouchableOpacity>
      ) : null}

      {isToday && nextPrayer ? (
        <Caption color={withOpacity(colors.white, 0.7)} style={styles.nextLine}>
          Next {nextPrayer.label}
          {timeLeft ? ` · in ${timeLeft}` : ""}
        </Caption>
      ) : null}

      {error ? (
        <GlassSurface tier="card" radius={theme.radii.card} style={styles.stateCard}>
          <View style={styles.stateHeader}>
            <Ionicons name="alert-circle" size={18} color={colors.accent} />
            <Headline color={colors.accent} style={styles.stateTitle}>
              Problem loading prayer times
            </Headline>
          </View>
          <Body color={withOpacity(colors.white, 0.9)} style={styles.stateMsg}>
            {error.message}
          </Body>
          <View style={styles.stateActions}>
            <TouchableOpacity
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading prayer times"
              style={styles.primaryBtn}
            >
              <Body color={colors.onAccent} style={styles.primaryBtnText}>Try again</Body>
            </TouchableOpacity>
            {error.code === "PERMISSION" ? (
              <TouchableOpacity
                onPress={onOpenSettings}
                accessibilityRole="button"
                accessibilityLabel="Open app settings"
                style={styles.secondaryBtn}
              >
                <Body color={colors.accent} style={styles.primaryBtnText}>Open Settings</Body>
              </TouchableOpacity>
            ) : null}
          </View>
        </GlassSurface>
      ) : !loading && prayerTimes.length === 0 ? (
        <GlassSurface tier="card" radius={theme.radii.card} style={styles.stateCard}>
          <Body color={withOpacity(colors.white, 0.9)} style={styles.emptyText}>
            No prayer times available for this date.
          </Body>
          <TouchableOpacity
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading prayer times"
            style={[styles.primaryBtn, styles.emptyBtn]}
          >
            <Body color={colors.onAccent} style={styles.primaryBtnText}>Try again</Body>
          </TouchableOpacity>
        </GlassSurface>
      ) : (
        <PrayerArc
          loading={loading}
          prayerTimes={prayerTimes}
          nextPrayer={isToday ? nextPrayer : null}
          live={isToday}
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    headerText: { flexShrink: 1 },
    hijri: { marginTop: 2 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 1,
      maxWidth: "52%",
    },
    chipText: { flexShrink: 1 },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.4),
      marginBottom: spacing.md,
    },
    toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    toggleText: {},
    nextLine: { marginBottom: spacing.sm },
    stateCard: { padding: spacing.lg },
    stateHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stateTitle: { flexShrink: 1 },
    stateMsg: { marginTop: spacing.sm },
    stateActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginTop: spacing.md },
    primaryBtn: {
      backgroundColor: colors.accent,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg - 2,
      borderRadius: theme.radii.chip,
    },
    secondaryBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg - 2,
      borderRadius: theme.radii.chip,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    primaryBtnText: { fontFamily: "SFProDisplay-Semibold" },
    emptyText: { textAlign: "center" },
    emptyBtn: { alignSelf: "center", marginTop: spacing.sm + 2 },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/day-detail-panel.contract.test.tsx`
Expected: PASS (all five).

- [ ] **Step 5: Commit**

```bash
git add components/calendar/DayDetailPanel.tsx __tests__/components/day-detail-panel.contract.test.tsx
git commit -m "feat(calendar): add shared DayDetailPanel (glass day detail)"
```

---

## Task 4: Calendar — inline selection, fixed grid, default-select-today

**Files:**
- Modify: `frontend/app/(tabs)/Calendar.tsx`
- Modify: `frontend/__tests__/navigation/routes-params.contract.test.tsx`
- Modify: `frontend/__tests__/screens/screen-contracts.test.tsx`

**Interfaces:**
- Consumes: `DayDetailPanel` (Task 3), `fullMatrix` (Task 2), `usePrayerTimes`/`useNextPrayer`/`useRamadanTracker`, `useHaptics`.
- Produces: Calendar holds `selectedDate: Date | null`; grid day taps call `setSelectedDate` (no `router.push`); a grid day's a11y label is `Select <Month> <day>, <year>`; renders `DayDetailPanel` for a selection or a prompt otherwise.

This task converts behavior; the two contract tests are updated **first** (red), then the screen.

- [ ] **Step 1: Update the grid-selection contract test (red)**

In `frontend/__tests__/navigation/routes-params.contract.test.tsx`:

(a) Add `fullMatrix` to the `mockUseCalendarViewState.mockReturnValue({...})` (the grid renders it). Put it next to `visibleMatrix`:

```ts
      dayButtonSize: 40,
      fullMatrix: [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [10, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ],
      visibleMatrix: [[10, 0, 0, 0, 0, 0, 0]],
      monthName: "March",
```

(b) Replace the test `it("pushes /[date] with selected day params from the calendar grid", ...)` (lines ~300–321) with an inline-selection assertion:

```ts
  it("selects the day inline from the calendar grid (no navigation)", () => {
    const expectedIso = new Date(2026, 2, 10).toISOString();
    const { getByLabelText } = render(<CalendarScreen />);

    fireEvent.press(getByLabelText("Select March 10, 2026"));

    expect(mockPush).not.toHaveBeenCalled();
    const calls = mockUsePrayerTimes.mock.calls;
    const lastArg = calls[calls.length - 1][0] as Date | null;
    expect(lastArg?.toISOString()).toBe(expectedIso);
  });
```

- [ ] **Step 2: Update the screen-contracts Calendar test (red)**

In `frontend/__tests__/screens/screen-contracts.test.tsx`:

(a) Add hook mocks. Near the other calendar hook mocks (around lines 118–131) add:

```ts
jest.mock("@/hooks/usePrayerTimes", () => ({
  usePrayerTimes: jest.fn(),
}));
jest.mock("@/hooks/useNextPrayer", () => ({
  useNextPrayer: jest.fn(),
}));
jest.mock("@/hooks/useRamadanTracker", () => ({
  useRamadanTracker: jest.fn(),
}));
```

(b) Import them as typed mocks next to the other calendar imports (around line 417–420):

```ts
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useNextPrayer } from "@/hooks/useNextPrayer";
import { useRamadanTracker } from "@/hooks/useRamadanTracker";
```

and below the existing `mockUseCalendar*` typed-mock declarations:

```ts
const mockUsePrayerTimes = usePrayerTimes as jest.MockedFunction<typeof usePrayerTimes>;
const mockUseNextPrayer = useNextPrayer as jest.MockedFunction<typeof useNextPrayer>;
const mockUseRamadanTracker = useRamadanTracker as jest.MockedFunction<typeof useRamadanTracker>;
```

(c) In `buildCalendarViewState` add `fullMatrix` mirroring its `visibleMatrix` but padded to 6 rows (keep day 10 present). If `buildCalendarViewState` currently returns `visibleMatrix: [[10, 0,0,0,0,0,0]]`, add:

```ts
  fullMatrix: [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [10, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
```

(d) In the `beforeEach`, after `mockUseCalendarSummaryTransition.mockReturnValue(...)`, seed the day hooks:

```ts
    mockUsePrayerTimes.mockReturnValue({
      prayerTimes: [{ label: "Fajr", time: "5:31 AM" }],
      loading: false,
      error: null,
      retry: jest.fn(),
      prayerTimesDateKey: "2026-03-10",
    } as any);
    mockUseNextPrayer.mockReturnValue({ nextPrayer: null, timeLeft: "" } as any);
    mockUseRamadanTracker.mockReturnValue({
      isRamadan: false,
      isFastMissed: false,
      loadingRamadan: false,
      toggleMissedFast: jest.fn(),
    } as any);
```

(e) Update the two Calendar assertions (lines ~840–846):

```ts
    it("renders calendar header and month contract", () => {
      const { getByText, getByLabelText } = render(<CalendarScreen />);

      expect(getByText("Calendar")).toBeTruthy();
      expect(getByText("Mar 2026")).toBeTruthy();
      expect(getByLabelText("Select March 10, 2026")).toBeTruthy();
    });
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npm test -- --runTestsByPath __tests__/navigation/routes-params.contract.test.tsx __tests__/screens/screen-contracts.test.tsx`
Expected: FAIL — old screen still pushes, still renders `"March 2026"` and label `"Open March 10, 2026"`, and `fullMatrix` is unused.

- [ ] **Step 4: Rewrite `Calendar.tsx` for inline selection + fixed grid**

Replace the entire contents of `frontend/app/(tabs)/Calendar.tsx` with:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DayDetailPanel from "@/components/calendar/DayDetailPanel";
import PressableScale from "@/components/PressableScale";
import GlassSurface from "@/components/ui/GlassSurface";
import Screen from "@/components/ui/Screen";
import { Body, Caption, Headline, LargeTitle } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useCalendarNavigationTransitions } from "@/hooks/useCalendarNavigationTransitions";
import { useCalendarViewState } from "@/hooks/useCalendarViewState";
import { useNextPrayer } from "@/hooks/useNextPrayer";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useRamadanTracker } from "@/hooks/useRamadanTracker";
import { dateKeyFromDate } from "@/services/holidayService";
import { useWindowDimensions } from "react-native";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarScreen() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  const { month, year } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const {
    today,
    minDate,
    maxDate,
    viewYear,
    setViewYear,
    viewMonth,
    setViewMonth,
    viewMonthRef,
    viewYearRef,
    initialIsViewingToday,
    isViewingToday,
    canGoPrev,
    canGoNext,
    dayButtonSize,
    fullMatrix,
    monthName,
  } = useCalendarViewState({ monthParam: month, yearParam: year, isSmall });

  const {
    holidayMap,
    loadingHolidays,
    ramadanStart,
    ramadanEnd,
    ramadanSummary,
    firstMissedFastDate,
    missedDaysLabel,
    showRamadanSummary,
  } = useCalendarData(viewYear, viewMonth);

  const {
    navigating,
    fadeAnim,
    translateX,
    backToTodayAnim,
    panHandlers,
    goToPreviousMonth,
    goToNextMonth,
    goBackToToday,
  } = useCalendarNavigationTransitions({
    viewYear,
    viewMonth,
    setViewYear,
    setViewMonth,
    viewYearRef,
    viewMonthRef,
    minDate,
    maxDate,
    today,
    screenWidth: width,
    initialIsViewingToday,
    isViewingToday,
  });
  const tabBarHeight = useBottomTabBarHeight();

  // ---- Selected day (inline agenda) ----
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const pendingSelectRef = useRef<Date | null>(null);

  // On mount and whenever the viewed month changes, resolve the selection:
  // an explicit pending pick wins; otherwise auto-select today if it's in
  // view, else clear to the prompt.
  useEffect(() => {
    if (pendingSelectRef.current) {
      setSelectedDate(pendingSelectRef.current);
      pendingSelectRef.current = null;
      return;
    }
    const todayInView =
      viewMonth === today.getMonth() && viewYear === today.getFullYear();
    setSelectedDate(todayInView ? new Date(today) : null);
    // `today` is a fresh Date each render; intentionally keyed on the month only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth, viewYear]);

  const ramadanParam = useMemo(
    () => ({
      start: ramadanStart?.toISOString(),
      end: ramadanEnd?.toISOString(),
    }),
    [ramadanStart, ramadanEnd],
  );

  const { prayerTimes, loading, error, retry, prayerTimesDateKey } =
    usePrayerTimes(selectedDate);
  const { nextPrayer, timeLeft } = useNextPrayer(
    selectedDate,
    prayerTimes,
    prayerTimesDateKey,
  );
  const { isRamadan, isFastMissed, toggleMissedFast } = useRamadanTracker(
    selectedDate,
    ramadanParam.start,
    ramadanParam.end,
  );

  const selectedIsToday =
    !!selectedDate && selectedDate.toDateString() === today.toDateString();
  const selectedHoliday = selectedDate
    ? holidayMap[dateKeyFromDate(selectedDate)] ?? null
    : null;

  const selectDay = useCallback(
    (day: number) => {
      if (day <= 0) return;
      haptics("selection");
      setSelectedDate(new Date(viewYear, viewMonth, day));
    },
    [haptics, viewMonth, viewYear],
  );

  const handlePrevMonth = useCallback(() => {
    haptics("selection");
    goToPreviousMonth();
  }, [goToPreviousMonth, haptics]);

  const handleNextMonth = useCallback(() => {
    haptics("selection");
    goToNextMonth();
  }, [goToNextMonth, haptics]);

  const handleRamadanSummaryPress = useCallback(() => {
    if (!firstMissedFastDate) return;
    haptics("selection");
    const m = firstMissedFastDate.getMonth();
    const y = firstMissedFastDate.getFullYear();
    if (m !== viewMonth || y !== viewYear) {
      pendingSelectRef.current = firstMissedFastDate;
      setViewYear(y);
      setViewMonth(m);
    } else {
      setSelectedDate(firstMissedFastDate);
    }
  }, [firstMissedFastDate, haptics, setViewMonth, setViewYear, viewMonth, viewYear]);

  const openSettings = useCallback(async () => {
    try {
      if (Platform.OS === "ios") await Linking.openURL("app-settings:");
      else await Linking.openSettings();
    } catch {}
  }, []);

  return (
    <Screen>
      <View style={styles.fill}>
        {/* Header: title + bare top-right month switcher */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Caption color={withOpacity(colors.accent, 0.92)} style={styles.eyebrow}>
              Planner
            </Caption>
            <LargeTitle>Calendar</LargeTitle>
          </View>
          <View style={styles.monthSwitcher}>
            <PressableScale
              onPress={handlePrevMonth}
              disabled={!canGoPrev}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              style={styles.monthChevron}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={canGoPrev ? colors.accent : withOpacity(colors.accent, 0.3)}
              />
            </PressableScale>
            <Headline style={styles.monthLabel}>
              {monthName.slice(0, 3)} {viewYear}
            </Headline>
            <PressableScale
              onPress={handleNextMonth}
              disabled={!canGoNext}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              style={styles.monthChevron}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={canGoNext ? colors.accent : withOpacity(colors.accent, 0.3)}
              />
            </PressableScale>
          </View>
        </View>

        {/* Weekday row */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Caption
              key={`${d}-${i}`}
              color={colors.accent}
              style={[styles.weekdayText, { width: dayButtonSize }]}
            >
              {d}
            </Caption>
          ))}
        </View>

        {/* Fixed-height 6-row grid (month swipe lives here only) */}
        <Animated.View
          {...panHandlers}
          style={[
            styles.gridWrap,
            { opacity: fadeAnim, transform: [{ translateX }] },
          ]}
        >
          {loadingHolidays ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : (
            fullMatrix.map((week, i) => (
              <View key={i} style={styles.weekRow}>
                {week.map((day, j) => {
                  const isToday =
                    day === today.getDate() &&
                    viewMonth === today.getMonth() &&
                    viewYear === today.getFullYear();
                  const holidayName =
                    day > 0
                      ? holidayMap[dateKeyFromDate(new Date(viewYear, viewMonth, day))] ?? null
                      : null;
                  const isSelected =
                    !!selectedDate &&
                    day > 0 &&
                    selectedDate.getDate() === day &&
                    selectedDate.getMonth() === viewMonth &&
                    selectedDate.getFullYear() === viewYear;
                  return (
                    <PressableScale
                      key={j}
                      onPress={() => selectDay(day)}
                      disabled={navigating || day <= 0}
                      accessibilityRole="button"
                      accessibilityLabel={
                        day > 0 ? `Select ${monthName} ${day}, ${viewYear}` : "Empty day"
                      }
                      style={[
                        styles.dayButton,
                        { width: dayButtonSize, height: dayButtonSize, borderRadius: dayButtonSize / 2 },
                        isToday ? styles.dayToday : isSelected ? styles.daySelected : holidayName ? styles.dayHoliday : null,
                      ]}
                    >
                      <Body
                        color={
                          isToday
                            ? colors.onAccent
                            : isSelected || holidayName
                            ? colors.accent
                            : colors.white
                        }
                        style={[styles.dayText, isSmall ? styles.dayTextSmall : null]}
                      >
                        {day > 0 ? String(day) : ""}
                      </Body>
                    </PressableScale>
                  );
                })}
              </View>
            ))
          )}
        </Animated.View>

        <View style={styles.divider} />

        {/* Scrolling day panel */}
        <ScrollView
          style={styles.fill}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.panelContent,
            { paddingBottom: tabBarHeight + insets.bottom + spacing.lg },
          ]}
        >
          {!isViewingToday && (
            <Animated.View style={{ opacity: backToTodayAnim }}>
              <PressableScale
                onPress={goBackToToday}
                accessibilityRole="button"
                accessibilityLabel="Back to current month"
                style={styles.backToToday}
              >
                <Ionicons name="today-outline" size={15} color={colors.onAccent} />
                <Headline color={colors.onAccent} style={styles.backToTodayText}>
                  Back to Today
                </Headline>
              </PressableScale>
            </Animated.View>
          )}

          {showRamadanSummary && (
            <PressableScale
              onPress={handleRamadanSummaryPress}
              accessibilityRole="button"
              accessibilityLabel="Open first missed Ramadan fast date"
              style={styles.summaryWrap}
            >
              <GlassSurface tier="card" radius={theme.radii.card} style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <Headline color={colors.accent}>Ramadan Summary</Headline>
                  <Ionicons name="arrow-forward-circle-outline" size={20} color={withOpacity(colors.accent, 0.95)} />
                </View>
                <Body color={colors.white} style={styles.summaryText}>
                  Missed fasts: {ramadanSummary?.totalMissed ?? 0}
                </Body>
                <Caption color={withOpacity(colors.white, 0.85)}>Missed days: {missedDaysLabel}</Caption>
              </GlassSurface>
            </PressableScale>
          )}

          {selectedDate ? (
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
              isRamadan={isRamadan}
              isFastMissed={isFastMissed}
              onToggleMissedFast={toggleMissedFast}
            />
          ) : (
            <View style={styles.prompt}>
              <Ionicons name="calendar-outline" size={30} color={withOpacity(colors.accent, 0.6)} />
              <Body color={withOpacity(colors.white, 0.7)} style={styles.promptText}>
                Tap any day to see its prayer times &amp; events.
              </Body>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    fill: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    headerLeft: { flexShrink: 1 },
    eyebrow: { textTransform: "uppercase", letterSpacing: 1 },
    monthSwitcher: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    monthChevron: { padding: spacing.xs, minWidth: 32, alignItems: "center" },
    monthLabel: {},
    weekdayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.xs,
    },
    weekdayText: { textAlign: "center" },
    gridWrap: { paddingHorizontal: spacing.xl },
    loadingWrap: { height: 6 * 44, justifyContent: "center", alignItems: "center" },
    weekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: spacing.xs,
    },
    dayButton: { justifyContent: "center", alignItems: "center" },
    dayToday: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    daySelected: {
      borderWidth: 2,
      borderColor: colors.accent,
      backgroundColor: withOpacity(colors.accent, 0.14),
    },
    dayHoliday: {
      borderWidth: 1.5,
      borderColor: withOpacity(colors.accent, 0.6),
    },
    dayText: { textAlign: "center" },
    dayTextSmall: {},
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: withOpacity(colors.white, 0.12),
      marginHorizontal: spacing.xl,
      marginTop: spacing.sm,
    },
    panelContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    backToToday: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.pill,
      marginBottom: spacing.lg,
    },
    backToTodayText: {},
    summaryWrap: { marginBottom: spacing.lg },
    summaryCard: { padding: spacing.lg },
    summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    summaryText: {},
    prompt: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.huge, gap: spacing.sm },
    promptText: { textAlign: "center", maxWidth: 240 },
  });
};
```

- [ ] **Step 5: Run the updated contract tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/navigation/routes-params.contract.test.tsx __tests__/screens/screen-contracts.test.tsx`
Expected: PASS (the grid-selection and Calendar-header tests). The Ramadan-summary push test in `routes-params` is still the **old** push assertion and will FAIL — it is fixed in Task 5. To scope this run, append `-t "selects the day inline"` for routes-params confirmation, and run screen-contracts in full.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/Calendar.tsx __tests__/navigation/routes-params.contract.test.tsx __tests__/screens/screen-contracts.test.tsx
git commit -m "feat(calendar): inline day selection + fixed 6-row grid + glass shell"
```

---

## Task 5: Ramadan summary → inline jump

**Files:**
- Modify: `frontend/__tests__/navigation/routes-params.contract.test.tsx`

(`Calendar.tsx` already implements `handleRamadanSummaryPress` inline in Task 4; this task locks it with the test.)

- [ ] **Step 1: Update the Ramadan-summary test (red→green)**

Replace `it("pushes /[date] with first missed fast params from Ramadan summary", ...)` (lines ~323–339) with:

```ts
  it("selects the first missed fast date inline from the Ramadan summary", () => {
    const { getByLabelText } = render(<CalendarScreen />);

    fireEvent.press(getByLabelText("Open first missed Ramadan fast date"));

    expect(mockPush).not.toHaveBeenCalled();
    const calls = mockUsePrayerTimes.mock.calls;
    const lastArg = calls[calls.length - 1][0] as Date | null;
    // firstMissedFastDate (2026-03-05) is in the viewed month (March) → selected directly.
    expect(lastArg?.toISOString()).toBe(firstMissedFastDate.toISOString());
  });
```

- [ ] **Step 2: Run to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/navigation/routes-params.contract.test.tsx`
Expected: PASS — all three tests (inline grid select, inline Ramadan jump, and the still-valid `/[date]` back-nav test).

- [ ] **Step 3: Commit**

```bash
git add __tests__/navigation/routes-params.contract.test.tsx
git commit -m "test(calendar): Ramadan summary selects first missed fast inline"
```

---

## Task 6: `/[date]` route — glass restyle over `DayDetailPanel`

**Files:**
- Modify: `frontend/app/[date].tsx`

**Interfaces:**
- Consumes: `DayDetailPanel` (Task 3), the day hooks, `useHaptics`.
- Preserves: a pressable labelled `Calendar` that calls `router.replace(\`/Calendar?month=${month}&year=${year}\`)`; `usePrayerTimes(selectedDate)` is still called with the parsed param date (keeps `routes-params`/`navigation-contracts` back-nav tests green). Day swipe animates **translateX only** (glass-safe).

- [ ] **Step 1: Confirm the existing back-nav tests describe current behavior**

Run: `npm test -- --runTestsByPath __tests__/navigation/navigation-contracts.test.tsx`
Expected: PASS (baseline before the refactor — proves the "Calendar" back button + replace contract we must keep).

- [ ] **Step 2: Rewrite `[date].tsx` to use `DayDetailPanel` + glass**

Replace the entire contents of `frontend/app/[date].tsx` with:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Platform } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DayDetailPanel from "@/components/calendar/DayDetailPanel";
import PressableScale from "@/components/PressableScale";
import Screen from "@/components/ui/Screen";
import { Headline } from "@/components/ui/Text";
import { type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useNextPrayer } from "@/hooks/useNextPrayer";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useRamadanTracker } from "@/hooks/useRamadanTracker";
import { dateKeyFromDate, getHolidayMapForYear } from "@/services/holidayService";

export default function CalendarDetail() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    date,
    month,
    year,
    holiday: holidayParam,
    ramadanStart: ramadanStartParam,
    ramadanEnd: ramadanEndParam,
  } = useLocalSearchParams();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [holiday, setHoliday] = useState<string | null>(
    typeof holidayParam === "string" && holidayParam.trim().length > 0 ? holidayParam : null,
  );

  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typeof date === "string") setSelectedDate(new Date(decodeURIComponent(date)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate) return;
      try {
        const map = await getHolidayMapForYear(selectedDate.getFullYear());
        if (mounted) setHoliday(map[dateKeyFromDate(selectedDate)] ?? null);
      } catch (e) {
        console.warn("Failed to resolve holiday:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const { prayerTimes, loading, error, retry, prayerTimesDateKey } =
    usePrayerTimes(selectedDate);
  const { nextPrayer, timeLeft } = useNextPrayer(selectedDate, prayerTimes, prayerTimesDateKey);
  const { isRamadan, isFastMissed, toggleMissedFast } = useRamadanTracker(
    selectedDate,
    ramadanStartParam,
    ramadanEndParam,
  );

  // Glass-safe horizontal day stepping: translateX only (never opacity on glass).
  const stepDay = (deltaDays: number) => {
    const current = selectedDateRef.current;
    if (!current) return;
    const next = new Date(current);
    next.setDate(next.getDate() + deltaDays);
    const dir = deltaDays > 0 ? -1 : 1;
    Animated.timing(slide, { toValue: dir * width, duration: 130, useNativeDriver: true }).start(() => {
      setSelectedDate(next);
      slide.setValue(-dir * width);
      Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
    haptics("selection");
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => slide.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        const threshold = Math.min(0.25 * width, 80);
        if (g.dx < -threshold || (g.vx < -0.8 && Math.abs(g.dx) > 20)) stepDay(1);
        else if (g.dx > threshold || (g.vx > 0.8 && Math.abs(g.dx) > 20)) stepDay(-1);
        else Animated.timing(slide, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () =>
        Animated.timing(slide, { toValue: 0, duration: 160, useNativeDriver: true }).start(),
    }),
  ).current;

  const goBack = () => {
    haptics("selection");
    router.replace(`/Calendar?month=${month}&year=${year}`);
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === "ios") await Linking.openURL("app-settings:");
      else await Linking.openSettings();
    } catch {}
  };

  if (!selectedDate) return null;
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <Screen safeArea={false}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale onPress={goBack} accessibilityRole="button" style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
          <Headline color={colors.accent}>Calendar</Headline>
        </PressableScale>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.content,
          {
            paddingBottom: insets.bottom + spacing.xxl,
            transform: [{ translateX: slide }],
          },
        ]}
      >
        <DayDetailPanel
          date={selectedDate}
          isToday={isToday}
          holiday={holiday}
          loading={loading}
          prayerTimes={prayerTimes}
          error={error}
          onRetry={retry}
          onOpenSettings={openSettings}
          nextPrayer={nextPrayer}
          timeLeft={timeLeft}
          isRamadan={isRamadan}
          isFastMissed={isFastMissed}
          onToggleMissedFast={toggleMissedFast}
        />
      </Animated.View>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: spacing.xs + 2 },
    content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  });
};
```

- [ ] **Step 3: Run the back-nav contract tests to verify they still pass**

Run: `npm test -- --runTestsByPath __tests__/navigation/navigation-contracts.test.tsx __tests__/navigation/routes-params.contract.test.tsx`
Expected: PASS — `usePrayerTimes` is called with the parsed `Date`, and pressing `Calendar` calls `router.replace("/Calendar?month=2&year=2026")`.

- [ ] **Step 4: Commit**

```bash
git add app/\[date\].tsx
git commit -m "feat(calendar): glass-restyle /[date] over shared DayDetailPanel"
```

---

## Task 7: Docs + full verify

**Files:**
- Modify: `frontend/__tests__/README.md`

- [ ] **Step 1: Document the new suites**

Add two entries to the suite list in `frontend/__tests__/README.md` (match the existing formatting):

```markdown
- `components/prayer-arc.contract.test.tsx` — PrayerArc live vs static (non-today) rendering.
- `components/day-detail-panel.contract.test.tsx` — shared DayDetailPanel states (today/other-day/holiday/Ramadan/error).
```

- [ ] **Step 2: Run the full verify suite**

Run: `npm run verify`
Expected: PASS — lint, typecheck (`tsc --noEmit`), and the full Jest run all green.

If typecheck flags an unused import or style left over from the rewrites, remove it and re-run. If any other Calendar/`[date]` test references the removed `PrayerTimesList` import or the old `visibleMatrix`-only grid, update it to the new contract per Tasks 4–6.

- [ ] **Step 3: Commit**

```bash
git add __tests__/README.md
git commit -m "docs(tests): note PrayerArc + DayDetailPanel contract suites"
```

---

## Self-Review

**Spec coverage** (against `2026-06-17-calendar-inline-agenda-glass-redesign-design.md`):
- Inline agenda / grid pinned / scrolling panel / tap-selects-inline → Task 4. ✓
- Day-swiper removed on Calendar flow → Task 4 (grid tap replaces push; no day swiper on Calendar). ✓
- PrayerArc live for today, static otherwise → Tasks 1, 3, 4. ✓
- Bare top-right `‹ Mon Year ›` switcher, no pill → Task 4 (`monthSwitcher`, abbreviated, plain chevrons). ✓
- Default-select-today / prompt when no today → Task 4 (`useEffect` on `[viewMonth, viewYear]`, `prompt`). ✓
- Ramadan per-day toggle in panel + month summary atop panel + inline jump → Tasks 3, 4, 5. ✓
- Fixed 6-row grid → Tasks 2, 4 (`fullMatrix`). ✓
- `/[date]` kept + restyled + shares components → Task 6. ✓
- Glass-opacity-animation constraint → Tasks 1 (no breathing when static), 6 (translateX-only swipe). ✓
- Contract tests updated → Tasks 4, 5, 6; README → Task 7. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows the command + expected result. ✓

**Type consistency:** `DayDetailPanelProps` defined in Task 3 is consumed verbatim in Tasks 4 and 6 (same prop names/types: `date,isToday,holiday,loading,prayerTimes,error,onRetry,onOpenSettings,nextPrayer,timeLeft,isRamadan,isFastMissed,onToggleMissedFast`). `PrayerArc`'s new `live` prop (Task 1) is used in Task 3. `fullMatrix` (Task 2) is consumed in Task 4 and seeded in both updated mocks. `usePrayerTimes` return (`prayerTimes,loading,error,retry,prayerTimesDateKey`) matches Calendar/`[date]` usage. ✓

> **Note on grid loading height:** `loadingWrap` uses `6 * 44` as a nominal reserved height; if QA shows a visible jump between the loading state and the rendered 6-row grid at `dayButtonSize` 34/40, set it to `6 * (dayButtonSize + spacing.xs * 2)` for an exact match.
