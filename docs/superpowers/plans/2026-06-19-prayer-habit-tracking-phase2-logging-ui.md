# Prayer & Habit Tracking — Phase 2 (Prayer Logging UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users log each daily prayer as Prayed / Late / Missed directly on the existing `PrayerArc` — on Home for today, and in the Calendar day detail for any past date.

**Architecture:** No new card. The existing `PrayerArc` (already titled "TODAY'S PRAYERS", already rendering a row of prayer columns) gains an optional `logging` mode: a status dot under each of the 5 canonical prayers, with passed/next columns tappable to open a `PrayerLogSheet` (gorhom bottom sheet, 3 states + clear). A `usePrayerLog(dateKey)` hook bridges the Phase-1 `prayerTracker` service to the UI and stays in sync via the `PRAYER_LOG_UPDATED` event. Sunrise is shown by the arc but is never loggable.

**Tech Stack:** React Native 0.81 / Expo 54, TypeScript, `@gorhom/bottom-sheet` (already used), `react-native-svg`, `@expo/vector-icons` (Ionicons), Jest + `@testing-library/react-native`. Path alias `@/` → `frontend/`.

**Plan series:** Phase 2 of the tracking feature. Depends on the Phase-1 data layer (`services/tracking/*`, facades `@/services/prayerTracker`). Phase 3 (Tracker stats screen, habit management UI, display font) builds on this. **Deferred to Phase 3 (do NOT add here):** the streak chip on the arc header and the "View tracker & habits →" navigation — both need the Phase-3 stats hook and `/Tracker` route. This plan ships working prayer logging on Home + Calendar on its own.

**Source spec:** `docs/superpowers/specs/2026-06-19-prayer-habit-tracking-design.md`

## Global Constraints

- All commands run from `frontend/`. Path alias `@/` maps to `frontend/`.
- Frontend Jest is Babel-based — no dynamic `await import()`. Components/hooks tested with `@testing-library/react-native` (`render`, `renderHook`, `fireEvent`, `act`). Tests mocking `react-native-safe-area-context` must include `useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })` alongside `SafeAreaView`/`SafeAreaProvider`.
- **Theming:** all UI uses `useTheme()` + a `createStyles(theme)` factory. Never use static color constants. Status colors map to existing theme tokens: **prayed → `colors.accentSecondary`** (emerald), **late → `colors.accent`** (gold), **missed → `colors.danger`** (red). Use `withOpacity(hex, alpha)` for fills/borders.
- **Iconography:** Ionicons in the existing app style only. No emoji. The status indicator is drawn with `react-native-svg`/`View`, not glyphs.
- **Prayer mapping:** the arc renders `ARC_PRAYER_ORDER = ["Fajr","Sunrise","Dhuhr","Asr","Maghrib","Isha"]`. Only the 5 non-Sunrise labels are loggable and map to `PrayerName` (`Fajr→fajr`, etc.). Sunrise renders no dot and is never tappable for logging.
- **Date keys:** use `dateKeyFromDate()` from `@/services/holidayService` (local `YYYY-MM-DD`).
- Logging is only enabled for prayers whose arc state is `passed` or `next` (you can't log a future prayer). Upcoming prayers show a faint inert dot.
- `PrayerArc` MUST stay backward compatible: `logging` defaults off, so existing usages are unaffected.
- Verify with `npm run verify` (from `frontend/`) before the final commit.

---

### Task 1: `prayerLabel` util — arc label → PrayerName

**Files:**
- Create: `frontend/utils/prayerLabel.ts`
- Test: `frontend/__tests__/utils/prayerLabel.test.ts`

**Interfaces:**
- Consumes: `PrayerName` from `@/services/prayerTracker`.
- Produces: `prayerNameForArcLabel(label: string): PrayerName | null` — returns the `PrayerName` for the 5 canonical labels, `null` for `"Sunrise"` or anything else.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/utils/prayerLabel.test.ts
import { prayerNameForArcLabel } from "@/utils/prayerLabel";

describe("prayerNameForArcLabel", () => {
  it("maps the five canonical labels", () => {
    expect(prayerNameForArcLabel("Fajr")).toBe("fajr");
    expect(prayerNameForArcLabel("Dhuhr")).toBe("dhuhr");
    expect(prayerNameForArcLabel("Asr")).toBe("asr");
    expect(prayerNameForArcLabel("Maghrib")).toBe("maghrib");
    expect(prayerNameForArcLabel("Isha")).toBe("isha");
  });
  it("returns null for Sunrise and unknown labels", () => {
    expect(prayerNameForArcLabel("Sunrise")).toBeNull();
    expect(prayerNameForArcLabel("Whatever")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/utils/prayerLabel.test.ts`
Expected: FAIL — cannot find module `@/utils/prayerLabel`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/utils/prayerLabel.ts
import type { PrayerName } from "@/services/prayerTracker";

const LABEL_TO_NAME: Record<string, PrayerName> = {
  Fajr: "fajr",
  Dhuhr: "dhuhr",
  Asr: "asr",
  Maghrib: "maghrib",
  Isha: "isha",
};

/** Map an arc prayer label to its PrayerName, or null if not loggable (e.g. Sunrise). */
export function prayerNameForArcLabel(label: string): PrayerName | null {
  return LABEL_TO_NAME[label] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/utils/prayerLabel.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/utils/prayerLabel.ts frontend/__tests__/utils/prayerLabel.test.ts
git commit -m "feat(tracking): map arc prayer labels to PrayerName"
```

---

### Task 2: `usePrayerLog` hook

**Files:**
- Create: `frontend/hooks/usePrayerLog.ts`
- Test: `frontend/__tests__/hooks/usePrayerLog.test.ts`

**Interfaces:**
- Consumes: `getDayStatuses`, `setPrayerStatus`, `clearPrayerStatus`, `PRAYER_LOG_UPDATED_EVENT`, `PrayerName`, `PrayerStatus` from `@/services/prayerTracker`.
- Produces: `usePrayerLog(dateKey: string): { statuses: Partial<Record<PrayerName, PrayerStatus>>; setStatus: (p: PrayerName, s: PrayerStatus) => Promise<void>; clearStatus: (p: PrayerName) => Promise<void> }`. Re-reads on mount and on any `PRAYER_LOG_UPDATED` event matching `dateKey`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/hooks/usePrayerLog.test.ts
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePrayerLog } from "@/hooks/usePrayerLog";

describe("usePrayerLog", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("loads empty then reflects a set status", async () => {
    const { result } = renderHook(() => usePrayerLog("2026-06-19"));
    await waitFor(() => expect(result.current.statuses).toEqual({}));

    await act(async () => {
      await result.current.setStatus("fajr", "prayed");
    });
    await waitFor(() => expect(result.current.statuses.fajr).toBe("prayed"));
  });

  it("clears a status", async () => {
    const { result } = renderHook(() => usePrayerLog("2026-06-19"));
    await act(async () => {
      await result.current.setStatus("asr", "late");
    });
    await waitFor(() => expect(result.current.statuses.asr).toBe("late"));
    await act(async () => {
      await result.current.clearStatus("asr");
    });
    await waitFor(() => expect(result.current.statuses.asr).toBeUndefined());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/hooks/usePrayerLog.test.ts`
Expected: FAIL — cannot find module `@/hooks/usePrayerLog`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/hooks/usePrayerLog.ts
import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  PRAYER_LOG_UPDATED_EVENT,
  clearPrayerStatus,
  getDayStatuses,
  setPrayerStatus,
  type PrayerName,
  type PrayerStatus,
} from "@/services/prayerTracker";

type DayStatuses = Partial<Record<PrayerName, PrayerStatus>>;

export function usePrayerLog(dateKey: string) {
  const [statuses, setStatuses] = useState<DayStatuses>({});

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getDayStatuses(dateKey).then((s) => {
        if (mounted) setStatuses(s);
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(
      PRAYER_LOG_UPDATED_EVENT,
      (payload: { dateKey?: string }) => {
        if (payload?.dateKey === dateKey) reload();
      },
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [dateKey]);

  const setStatus = useCallback(
    (p: PrayerName, s: PrayerStatus) => setPrayerStatus(dateKey, p, s),
    [dateKey],
  );
  const clearStatus = useCallback(
    (p: PrayerName) => clearPrayerStatus(dateKey, p),
    [dateKey],
  );

  return { statuses, setStatus, clearStatus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/hooks/usePrayerLog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/hooks/usePrayerLog.ts frontend/__tests__/hooks/usePrayerLog.test.ts
git commit -m "feat(tracking): add usePrayerLog hook"
```

---

### Task 3: `PrayerStatusDot` component

**Files:**
- Create: `frontend/components/tracking/PrayerStatusDot.tsx`
- Test: `frontend/__tests__/components/tracking/PrayerStatusDot.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `withOpacity`; `PrayerStatus` from `@/services/prayerTracker`.
- Produces: `PrayerStatusDot({ status, loggable }: { status?: PrayerStatus; loggable: boolean })`. Renders (all via `View`, no glyphs):
  - status `prayed` → filled emerald dot (`testID="dot-prayed"`)
  - status `late` → filled gold dot (`testID="dot-late"`)
  - status `missed` → filled red dot (`testID="dot-missed"`)
  - no status + `loggable` → hollow dashed ring (`testID="dot-loggable"`)
  - no status + not loggable → faint small dot (`testID="dot-upcoming"`)

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/tracking/PrayerStatusDot.test.tsx
import { render } from "@testing-library/react-native";
import PrayerStatusDot from "@/components/tracking/PrayerStatusDot";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("PrayerStatusDot", () => {
  it("renders a prayed dot", () => {
    const { getByTestId } = render(wrap(<PrayerStatusDot status="prayed" loggable />));
    expect(getByTestId("dot-prayed")).toBeTruthy();
  });
  it("renders late and missed dots", () => {
    expect(render(wrap(<PrayerStatusDot status="late" loggable />)).getByTestId("dot-late")).toBeTruthy();
    expect(render(wrap(<PrayerStatusDot status="missed" loggable />)).getByTestId("dot-missed")).toBeTruthy();
  });
  it("renders a dashed loggable ring when unlogged but loggable", () => {
    const { getByTestId } = render(wrap(<PrayerStatusDot loggable />));
    expect(getByTestId("dot-loggable")).toBeTruthy();
  });
  it("renders a faint upcoming dot when not loggable", () => {
    const { getByTestId } = render(wrap(<PrayerStatusDot loggable={false} />));
    expect(getByTestId("dot-upcoming")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/PrayerStatusDot.test.tsx`
Expected: FAIL — cannot find module `@/components/tracking/PrayerStatusDot`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/components/tracking/PrayerStatusDot.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerStatus } from "@/services/prayerTracker";

type Props = { status?: PrayerStatus; loggable: boolean };

export default function PrayerStatusDot({ status, loggable }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (status === "prayed") return <View testID="dot-prayed" style={[styles.dot, styles.prayed]} />;
  if (status === "late") return <View testID="dot-late" style={[styles.dot, styles.late]} />;
  if (status === "missed") return <View testID="dot-missed" style={[styles.dot, styles.missed]} />;
  if (loggable) return <View testID="dot-loggable" style={styles.loggable} />;
  return <View testID="dot-upcoming" style={styles.upcoming} />;
}

const createStyles = (theme: AppTheme) => {
  const { colors } = theme;
  return StyleSheet.create({
    dot: { width: 7, height: 7, borderRadius: 999 },
    prayed: { backgroundColor: colors.accentSecondary },
    late: { backgroundColor: colors.accent },
    missed: { backgroundColor: colors.danger },
    loggable: {
      width: 9,
      height: 9,
      borderRadius: 999,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: withOpacity(colors.white, 0.5),
    },
    upcoming: {
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.white, 0.25),
    },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/PrayerStatusDot.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/tracking/PrayerStatusDot.tsx frontend/__tests__/components/tracking/PrayerStatusDot.test.tsx
git commit -m "feat(tracking): add PrayerStatusDot indicator"
```

---

### Task 4: `PrayerLogSheet` bottom sheet

**Files:**
- Create: `frontend/components/tracking/PrayerLogSheet.tsx`
- Test: `frontend/__tests__/components/tracking/PrayerLogSheet.test.tsx`

**Interfaces:**
- Consumes: `@gorhom/bottom-sheet` (`BottomSheet`, `BottomSheetView`), `@/components/ui/SheetBackground`, `useTheme`, `withOpacity`, `PressableScale`, `Ionicons`, `useSafeAreaInsets`; `PrayerName`, `PrayerStatus` from `@/services/prayerTracker`.
- Produces: `PrayerLogSheet({ visible, prayerName, prayerLabel, currentStatus, onSelect, onClear, onClose })`:
  - `visible: boolean`, `prayerName: PrayerName | null`, `prayerLabel: string`, `currentStatus?: PrayerStatus`
  - `onSelect: (s: PrayerStatus) => void` — fired with `"prayed" | "late" | "missed"`
  - `onClear: () => void` — fired when "Clear" tapped (only show Clear if `currentStatus` set)
  - `onClose: () => void`
  - Renders a title `Log {prayerLabel}` and three option rows (Prayed / Late / Missed) each with a small colored `View` swatch (emerald/gold/red) + Ionicons check on the active one. Follow the mounted-through-close pattern from `QuranCopySheet.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/tracking/PrayerLogSheet.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import PrayerLogSheet from "@/components/tracking/PrayerLogSheet";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp };
});
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("PrayerLogSheet", () => {
  it("fires onSelect with the chosen status", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      wrap(
        <PrayerLogSheet
          visible
          prayerName="dhuhr"
          prayerLabel="Dhuhr"
          onSelect={onSelect}
          onClear={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );
    fireEvent.press(getByText("Late"));
    expect(onSelect).toHaveBeenCalledWith("late");
  });

  it("shows Clear only when a status is set and fires onClear", () => {
    const onClear = jest.fn();
    const { queryByText, rerender } = render(
      wrap(
        <PrayerLogSheet visible prayerName="fajr" prayerLabel="Fajr" onSelect={jest.fn()} onClear={onClear} onClose={jest.fn()} />,
      ),
    );
    expect(queryByText("Clear")).toBeNull();
    rerender(
      wrap(
        <PrayerLogSheet visible prayerName="fajr" prayerLabel="Fajr" currentStatus="prayed" onSelect={jest.fn()} onClear={onClear} onClose={jest.fn()} />,
      ),
    );
    fireEvent.press(queryByText("Clear")!);
    expect(onClear).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/PrayerLogSheet.test.tsx`
Expected: FAIL — cannot find module `@/components/tracking/PrayerLogSheet`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/components/tracking/PrayerLogSheet.tsx
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/PressableScale";
import SheetBackground from "@/components/ui/SheetBackground";
import { Headline, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";

function LogSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

type Props = {
  visible: boolean;
  prayerName: PrayerName | null;
  prayerLabel: string;
  currentStatus?: PrayerStatus;
  onSelect: (s: PrayerStatus) => void;
  onClear: () => void;
  onClose: () => void;
};

const OPTIONS: { status: PrayerStatus; label: string; token: keyof AppTheme["colors"] }[] = [
  { status: "prayed", label: "Prayed", token: "accentSecondary" },
  { status: "late", label: "Late", token: "accent" },
  { status: "missed", label: "Missed", token: "danger" },
];

export default function PrayerLogSheet({
  visible,
  prayerName,
  prayerLabel,
  currentStatus,
  onSelect,
  onClear,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  if (!mounted) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={visible ? 0 : -1}
      snapPoints={undefined}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      onChange={(i) => {
        if (i === -1) setMounted(false);
      }}
      backgroundComponent={LogSheetBackground}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Title3 style={styles.title}>Log {prayerLabel}</Title3>
        {OPTIONS.map((opt) => {
          const active = currentStatus === opt.status;
          const color = colors[opt.token];
          return (
            <PressableScale
              key={opt.status}
              onPress={() => prayerName && onSelect(opt.status)}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${prayerLabel} ${opt.label}`}
            >
              <View style={[styles.row, active && { borderColor: withOpacity(color, 0.5) }]}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
                <Headline style={styles.rowLabel}>{opt.label}</Headline>
                {active ? <Ionicons name="checkmark" size={18} color={color} /> : null}
              </View>
            </PressableScale>
          );
        })}
        {currentStatus ? (
          <PressableScale onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear log">
            <View style={styles.clearRow}>
              <Ionicons name="close-circle-outline" size={18} color={withOpacity(colors.white, 0.7)} />
              <Headline color={withOpacity(colors.white, 0.7)} style={styles.rowLabel}>Clear</Headline>
            </View>
          </PressableScale>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
    title: { marginBottom: spacing.sm },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.08),
    },
    swatch: { width: 14, height: 14, borderRadius: 999 },
    rowLabel: { flex: 1 },
    clearRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
  });
};
```

If `Title3` is not exported from `@/components/ui/Text`, use `Title2`; verify the export list in that file before writing and use whichever title styles exist (the file exports `LargeTitle`, `Title2`, `Headline`, `Caption` at minimum — confirm and pick the closest title size).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/tracking/PrayerLogSheet.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/tracking/PrayerLogSheet.tsx frontend/__tests__/components/tracking/PrayerLogSheet.test.tsx
git commit -m "feat(tracking): add PrayerLogSheet"
```

---

### Task 5: Extend `PrayerArc` with a logging mode

**Files:**
- Modify: `frontend/components/PrayerArc.tsx`
- Test: `frontend/__tests__/components/PrayerArc.logging.test.tsx`

**Interfaces:**
- Consumes: `PrayerStatusDot` (Task 3), `prayerNameForArcLabel` (Task 1); `PrayerName`, `PrayerStatus` from `@/services/prayerTracker`.
- Produces: three new optional props on `PrayerArc`:
  - `logging?: boolean` (default `false`)
  - `statuses?: Partial<Record<PrayerName, PrayerStatus>>`
  - `onPressPrayer?: (name: PrayerName, label: string) => void`
  When `logging` is true, each prayer column renders a `PrayerStatusDot` below its time. A column is loggable when its `PrayerName` is non-null (not Sunrise) AND its arc state is `passed` or `next`; loggable columns wrap in a `Pressable` calling `onPressPrayer`. Backward compatible: with `logging` false (default) the column markup is unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/PrayerArc.logging.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import PrayerArc from "@/components/PrayerArc";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const TIMES = [
  { label: "Fajr", time: "5:12 AM" },
  { label: "Sunrise", time: "6:40 AM" },
  { label: "Dhuhr", time: "1:01 PM" },
  { label: "Asr", time: "3:42 PM" },
  { label: "Maghrib", time: "6:30 PM" },
  { label: "Isha", time: "8:01 PM" },
] as any;

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("PrayerArc logging mode", () => {
  it("renders status dots for logged prayers", () => {
    const { getByTestId } = render(
      wrap(
        <PrayerArc
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={{ label: "Asr", time: "3:42 PM" }}
          live={false}
          logging
          statuses={{ fajr: "prayed", dhuhr: "late" }}
        />,
      ),
    );
    expect(getByTestId("dot-prayed")).toBeTruthy();
    expect(getByTestId("dot-late")).toBeTruthy();
  });

  it("calls onPressPrayer for a loggable (non-sunrise, passed) column", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      wrap(
        <PrayerArc
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={{ label: "Asr", time: "3:42 PM" }}
          live
          logging
          statuses={{}}
          onPressPrayer={onPress}
        />,
      ),
    );
    fireEvent.press(getByLabelText("Log Fajr"));
    expect(onPress).toHaveBeenCalledWith("fajr", "Fajr");
  });

  it("does not crash and renders nothing loggable for Sunrise", () => {
    const { queryByLabelText } = render(
      wrap(
        <PrayerArc loading={false} prayerTimes={TIMES} nextPrayer={null} live={false} logging statuses={{}} onPressPrayer={jest.fn()} />,
      ),
    );
    expect(queryByLabelText("Log Sunrise")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/PrayerArc.logging.test.tsx`
Expected: FAIL — props not supported / dots not rendered.

- [ ] **Step 3: Implement the logging extension**

Read `frontend/components/PrayerArc.tsx` first. In the column-rendering block (the `prayers.map((p) => { ... return (<View style={styles.col}> ... </View>) })`):

1. Add the three props to `PrayerArcProps` and the destructured signature (with `logging = false`).
2. Add imports:
```tsx
import { Pressable } from "react-native";
import PrayerStatusDot from "@/components/tracking/PrayerStatusDot";
import { prayerNameForArcLabel } from "@/utils/prayerLabel";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";
```
3. Inside the `.map`, after computing `state`, derive:
```tsx
const name = prayerNameForArcLabel(p.label);
const loggable = logging && name != null && (state === "passed" || state === "next");
const status = name ? statuses?.[name] : undefined;
```
4. Wrap the existing column content. When `logging` is true, render the dot under the time and make loggable columns pressable:
```tsx
const column = (
  <View style={styles.col}>
    <Caption color={nameColor} numberOfLines={1} style={styles.name}>{p.label}</Caption>
    <Caption color={timeColor} numberOfLines={1} style={styles.time}>{p.time ? shortTime(p.time) : "—"}</Caption>
    {logging && name ? <PrayerStatusDot status={status} loggable={loggable} /> : null}
  </View>
);
return loggable && onPressPrayer ? (
  <Pressable
    key={p.label}
    onPress={() => onPressPrayer(name!, p.label)}
    accessibilityRole="button"
    accessibilityLabel={`Log ${p.label}`}
    style={{ flex: 1 }}
  >
    {column}
  </Pressable>
) : (
  <View key={p.label} style={{ flex: 1 }}>{column}</View>
);
```
(Keep the existing non-logging behavior intact — when `logging` is false, render the column exactly as before. The cleanest way is to keep the original `return <View key={p.label} style={styles.col}>…</View>` for the non-logging path and only branch into the new markup when `logging`.)
5. Add a small `gap`/center style so the dot sits under the time without shifting the arc layout (reuse `styles.col` which already centers; the dot is tiny).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/PrayerArc.logging.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the existing PrayerArc/Home tests to confirm no regression**

Run: `npm test -- --runTestsByPath __tests__/screens/screen-contracts.test.tsx`
Expected: PASS (logging defaults off; existing arc usage unchanged).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/PrayerArc.tsx frontend/__tests__/components/PrayerArc.logging.test.tsx
git commit -m "feat(tracking): add logging mode to PrayerArc"
```

---

### Task 6: Wire logging into Home

**Files:**
- Modify: `frontend/app/(tabs)/index.tsx`
- Test: `frontend/__tests__/screens/home-prayer-logging.test.tsx`

**Interfaces:**
- Consumes: `usePrayerLog` (Task 2), `PrayerLogSheet` (Task 4), `dateKeyFromDate`, `PrayerArc` logging props (Task 5); `PrayerName`, `PrayerStatus`.
- Produces: Home renders its existing `PrayerArc` with `logging`, today's `statuses`, and an `onPressPrayer` that opens `PrayerLogSheet`; selecting a status calls `setStatus`, Clear calls `clearStatus`, both close the sheet.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/screens/home-prayer-logging.test.tsx
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Home from "@/app/(tabs)/index";
import { ThemeProvider } from "@/context/ThemeContext";
import { getDayStatuses } from "@/services/prayerTracker";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp };
});
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
// Provide deterministic prayer times so the arc renders passed prayers.
jest.mock("@/hooks/useHomePrayerTimes", () => ({
  useHomePrayerTimes: () => ({
    prayerTimes: [
      { label: "Fajr", time: "5:12 AM" },
      { label: "Dhuhr", time: "1:01 PM" },
      { label: "Asr", time: "3:42 PM" },
      { label: "Maghrib", time: "6:30 PM" },
      { label: "Isha", time: "8:01 PM" },
    ],
    nextPrayer: { label: "Isha", time: "8:01 PM" },
    nextDayFajr: null, timeLeft: "1h", loading: false, refreshing: false,
    banner: "", locationLabel: "Tunis", refresh: jest.fn(),
  }),
}));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Home prayer logging", () => {
  beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

  it("logs a prayer from the arc and persists it", async () => {
    const { getByLabelText, getByText } = render(wrap(<Home />));
    fireEvent.press(getByLabelText("Log Fajr"));
    fireEvent.press(getByText("Prayed"));
    await waitFor(async () => {
      const today = new Intl.DateTimeFormat("en-CA").format(new Date()); // YYYY-MM-DD
      expect((await getDayStatuses(today)).fajr).toBe("prayed");
    });
  });
});
```

(Note: `en-CA` yields `YYYY-MM-DD`; this matches `dateKeyFromDate` only when the test runs in a timezone without date rollover — acceptable for CI which runs UTC. If the suite proves flaky, assert via the hook state instead.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/screens/home-prayer-logging.test.tsx`
Expected: FAIL — no "Log Fajr" pressable yet.

- [ ] **Step 3: Implement Home wiring**

Read `frontend/app/(tabs)/index.tsx`. Add imports for `usePrayerLog`, `PrayerLogSheet`, `dateKeyFromDate`, and the `PrayerName`/`PrayerStatus` types. Inside `Home`:

```tsx
const todayKey = dateKeyFromDate(new Date());
const { statuses, setStatus, clearStatus } = usePrayerLog(todayKey);
const [sheet, setSheet] = useState<{ name: PrayerName; label: string } | null>(null);
```

Pass logging props to the existing `<PrayerArc ... />` in the `arcSlot`:
```tsx
<PrayerArc
  loading={loading}
  prayerTimes={prayerTimes}
  nextPrayer={nextPrayer}
  logging
  statuses={statuses}
  onPressPrayer={(name, label) => setSheet({ name, label })}
/>
```

Render the sheet near the end of the screen (outside the ScrollView, inside the `Screen`):
```tsx
<PrayerLogSheet
  visible={sheet !== null}
  prayerName={sheet?.name ?? null}
  prayerLabel={sheet?.label ?? ""}
  currentStatus={sheet ? statuses[sheet.name] : undefined}
  onSelect={(s) => { if (sheet) setStatus(sheet.name, s); setSheet(null); }}
  onClear={() => { if (sheet) clearStatus(sheet.name); setSheet(null); }}
  onClose={() => setSheet(null)}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/screens/home-prayer-logging.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(tabs)/index.tsx frontend/__tests__/screens/home-prayer-logging.test.tsx
git commit -m "feat(tracking): log prayers from the Home arc"
```

---

### Task 7: Wire logging into the Calendar day detail

**Files:**
- Modify: `frontend/components/calendar/DayDetailPanel.tsx`
- Modify: `frontend/app/(tabs)/Calendar.tsx` (only if the panel needs the selected `Date` passed through — read first)
- Test: `frontend/__tests__/components/calendar/DayDetailPanel.logging.test.tsx`

**Interfaces:**
- Consumes: `usePrayerLog`, `PrayerLogSheet`, `dateKeyFromDate`, `PrayerArc` logging props.
- Produces: `DayDetailPanel` enables `logging` on the `PrayerArc` it already renders for the selected `date`, wiring `usePrayerLog(dateKeyFromDate(date))` and its own `PrayerLogSheet`. Works for any past date.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/calendar/DayDetailPanel.logging.test.tsx
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DayDetailPanel from "@/components/calendar/DayDetailPanel";
import { ThemeProvider } from "@/context/ThemeContext";
import { getDayStatuses } from "@/services/prayerTracker";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp };
});
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const TIMES = [
  { label: "Fajr", time: "5:12 AM" }, { label: "Dhuhr", time: "1:01 PM" },
  { label: "Asr", time: "3:42 PM" }, { label: "Maghrib", time: "6:30 PM" }, { label: "Isha", time: "8:01 PM" },
] as any;
const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("DayDetailPanel logging", () => {
  beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

  it("logs a prayer for a past date", async () => {
    const past = new Date(2025, 5, 16); // 2025-06-16, local
    const { getByLabelText, getByText } = render(
      wrap(
        <DayDetailPanel
          date={past} isToday={false} holiday={null} loading={false}
          prayerTimes={TIMES} error={null} onRetry={jest.fn()} onOpenSettings={jest.fn()}
          nextPrayer={null} timeLeft=""
        />,
      ),
    );
    fireEvent.press(getByLabelText("Log Maghrib"));
    fireEvent.press(getByText("Missed"));
    await waitFor(async () => {
      expect((await getDayStatuses("2025-06-16")).maghrib).toBe("missed");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/calendar/DayDetailPanel.logging.test.tsx`
Expected: FAIL — no logging wired.

- [ ] **Step 3: Implement DayDetailPanel wiring**

Read `frontend/components/calendar/DayDetailPanel.tsx`. It already renders a `PrayerArc` for the day (in `live={false}` mode). Add:
```tsx
const dayKey = dateKeyFromDate(date);
const { statuses, setStatus, clearStatus } = usePrayerLog(dayKey);
const [sheet, setSheet] = useState<{ name: PrayerName; label: string } | null>(null);
```
Pass `logging statuses={statuses} onPressPrayer={(name, label) => setSheet({ name, label })}` to that `PrayerArc`, and render a `PrayerLogSheet` at the end of the panel's returned tree (same wiring as Home in Task 6). Because the arc here is `live={false}`, all five prayers report `state === "passed"` (or `upcoming`) — confirm that past-day columns are loggable; if `live={false}` makes every column `upcoming` (not loggable), pass an extra prop path: the arc's loggable rule must treat a non-live arc's columns as loggable. Adjust the Task-5 `loggable` rule to: `logging && name != null && (!live || state === "passed" || state === "next")`. Update the Task-5 test expectations if you change that rule, and re-run Task 5's test.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/calendar/DayDetailPanel.logging.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the broader screen suite + verify**

Run: `npm run verify`
Expected: lint clean, typecheck clean, full suite (incl. all new Phase-2 suites) passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/PrayerArc.tsx frontend/components/calendar/DayDetailPanel.tsx frontend/__tests__/components/calendar/DayDetailPanel.logging.test.tsx
git commit -m "feat(tracking): log prayers per day in the Calendar detail"
```

---

## Self-Review

**Spec coverage (Phase 2 = prayer logging UI):**
- Logging folded into the arc (status dot per prayer, tap to log) → Tasks 3, 5. ✓
- 3-state sheet (Prayed/Late/Missed) + clear → Task 4. ✓
- Home today logging → Task 6. ✓
- Calendar any-past-date logging via DayDetailPanel → Task 7. ✓
- Sunrise excluded from logging → Tasks 1, 5. ✓
- Sync via `PRAYER_LOG_UPDATED` → Task 2. ✓
- **Deferred to Phase 3 (intentional):** streak chip on the arc header, "View tracker & habits →" nav, habit checklist on Calendar/Home, the Tracker screen, display font, reminder service.

**Placeholder scan:** Every code step has complete code; commands have expected output. The one conditional ("verify `Title3` export"; "adjust `loggable` rule for non-live arc") is a concrete instruction with the exact change to make, not a vague TODO.

**Type consistency:** `PrayerName`/`PrayerStatus` from `@/services/prayerTracker` used throughout. `prayerNameForArcLabel` (Task 1) feeds Task 5's loggable rule. `usePrayerLog` (Task 2) shape `{ statuses, setStatus, clearStatus }` consumed identically in Tasks 6 and 7. `PrayerLogSheet` props (Task 4) match the call sites in Tasks 6/7. `PrayerArc` new props (Task 5) match the call sites.
