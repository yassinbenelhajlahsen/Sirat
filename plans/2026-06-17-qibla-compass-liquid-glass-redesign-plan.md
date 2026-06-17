# Qibla Compass — Liquid Glass Redesign + Lift — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Qibla screen onto the liquid-glass design system and replace the bare rotating-arrow compass with an SVG instrument dial (true-north cardinals, Kaaba marker at the real bearing, bearing + distance readout, calm-bloom aligned state).

**Architecture:** A new presentational `CompassDial` component owns the whole compass visual (SVG ticks/cardinals, 🕋 marker, fixed pointer, glass ring, readout, heading-driven rotation, aligned bloom + ripple). `useQibla` gains one additive output, `distanceKm` (haversine). `Qibla.tsx` keeps its existing state machine but is restyled with `Screen` / typed `Text` / `GlassSurface` / `useHaptics`, and delegates the compass to `CompassDial`.

**Tech Stack:** Expo 54 / React Native 0.81, TypeScript, `react-native-svg` 15.12.1 (dial), `react-native-reanimated` 4.1.1 (rotation), RN `Animated` (ripple), Jest + `@testing-library/react-native`.

**Spec:** `plans/2026-06-17-qibla-compass-liquid-glass-redesign.md`

## Global Constraints

- All commands run from `frontend/`. Verify gate: `npm run verify` (lint + typecheck + test).
- Theming: every themed style uses `useTheme()` + `createStyles(theme)`; **no static color literals**. Transparency via `withOpacity(hex, alpha)`.
- Imports use the `@/` alias (maps to `frontend/`).
- **Never animate a `GlassView`/`GlassSurface`'s opacity** (parent or child) — it stops rendering. Animate sibling/overlay `View`s (glow, halo, ripple) instead.
- Every glass mount goes through `GlassSurface` (already gates on `isGlassEffectAPIAvailable()` with a solid fallback).
- **Preserve these exact strings** (existing contract tests assert them): `"Finding direction..."`, `"Calibrating compass..."`, `"Adjusting"`, `"Aligned"`, ``Accuracy ±{n}°``, `"Compass not available."`, `"Move your phone in a figure eight to improve compass accuracy."`, and all permission-gate titles/messages/accessibility labels.
- **Preserve behavior:** alignment tolerance is the hook's existing ±2°; the alignment haptic fires **once per alignment** (rising-edge guard), now as `success` not `impactAsync(Light)`.
- Kaaba constants: `KAABA_LAT = 21.4225`, `KAABA_LON = 39.8262` (reuse, do not redefine elsewhere).
- Commit messages via HEREDOC, no co-author trailer, conventional-commit style (`feat(qibla): …`).

---

## File Structure

- **Create** `frontend/components/qibla/CompassDial.tsx` — the entire compass visual (SVG dial, marker, pointer, glass ring, readout, rotation, aligned bloom/ripple). Pure props in; no data fetching.
- **Create** `frontend/__tests__/components/compass-dial.contract.test.tsx` — CompassDial label/marker contract.
- **Modify** `frontend/hooks/useQibla.ts` — add `distanceKm` (haversine), expose on `UseQiblaResult`.
- **Modify** `frontend/__tests__/hooks/useQibla.test.ts` — assert `distanceKm`.
- **Modify** `frontend/app/(tabs)/Qibla.tsx` — adopt `Screen`/typed `Text`/`GlassSurface`/`useHaptics`; render `CompassDial`; restyle gate.
- **Modify** `frontend/__tests__/screens/qibla.contract.test.tsx` — update mocks (haptics → `notificationAsync`/`Success`; mock `CompassDial`) and the aligned-haptic assertion.
- **Delete** `frontend/assets/images/qibla-compass-svgrepo-com.png` — superseded by the SVG dial (Task 5, after confirming no other refs).

---

## Task 1: Add `distanceKm` to `useQibla`

**Files:**
- Modify: `frontend/hooks/useQibla.ts`
- Test: `frontend/__tests__/hooks/useQibla.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `UseQiblaResult` gains `distanceKm: number | null` — the great-circle distance (km) from the user's position to the Kaaba; `null` until/unless a position is read.

- [ ] **Step 1: Write the failing tests**

In `frontend/__tests__/hooks/useQibla.test.ts`, add two tests inside the `describe("hooks/useQibla", …)` block (the existing `beforeEach` already mocks granted permission and coords `{ latitude: 40.7128, longitude: -74.006 }`):

```tsx
it("computes distanceKm to the Kaaba on the happy path", async () => {
  const { result } = renderHook(() => useQibla());

  await waitFor(() => {
    expect(result.current.distanceKm).not.toBeNull();
  });

  // New York City → Makkah great-circle ≈ 10,300 km
  expect(result.current.distanceKm as number).toBeGreaterThan(10000);
  expect(result.current.distanceKm as number).toBeLessThan(10600);
});

it("leaves distanceKm null when permission is denied", async () => {
  mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });

  const { result } = renderHook(() => useQibla());

  await waitFor(() => {
    expect(result.current.error).toBe("Location permission denied.");
  });

  expect(result.current.distanceKm).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --runTestsByPath __tests__/hooks/useQibla.test.ts`
Expected: FAIL — `result.current.distanceKm` is `undefined` (property does not exist).

- [ ] **Step 3: Implement `distanceKm`**

In `frontend/hooks/useQibla.ts`:

Add a haversine helper next to `computeBearing` (reuse the existing `toRad`):

```ts
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

Add `distanceKm` to the result type:

```ts
export type UseQiblaResult = {
  rotation: number | null;
  heading: number | null;
  qiblaAngle: number | null;
  distanceKm: number | null;
  accuracy: number | null;
  error: string | null;
  isAligned: boolean;
};
```

Add state and compute it where the position is read (the existing position `useEffect`):

```ts
const [distanceKm, setDistanceKm] = useState<number | null>(null);
```

Inside the position effect, right after `setQiblaAngle(...)`:

```ts
setQiblaAngle(computeBearing(coords.latitude, coords.longitude, KAABA_LAT, KAABA_LON));
setDistanceKm(haversineKm(coords.latitude, coords.longitude, KAABA_LAT, KAABA_LON));
```

Add `distanceKm` to the returned object:

```ts
return { rotation, heading, qiblaAngle, distanceKm, accuracy, error, isAligned };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/hooks/useQibla.test.ts`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/hooks/useQibla.ts frontend/__tests__/hooks/useQibla.test.ts
git commit -F - <<'EOF'
feat(qibla): add distanceKm (haversine) to useQibla
EOF
```

---

## Task 2: `CompassDial` component

**Files:**
- Create: `frontend/components/qibla/CompassDial.tsx`
- Test: `frontend/__tests__/components/compass-dial.contract.test.tsx`

**Interfaces:**
- Consumes: `useQibla` output fields (`heading`, `qiblaAngle`, `rotation`, `distanceKm`, `isAligned`) — passed as props by the screen (Task 3).
- Produces:

```ts
export type CompassDialProps = {
  heading: number;      // smoothed device heading (deg)
  qiblaAngle: number;   // absolute bearing to the Kaaba (deg from true north)
  rotation: number;     // qiblaAngle - heading; 0 = aligned
  distanceKm: number | null;
  isAligned: boolean;
};
export default function CompassDial(props: CompassDialProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/components/compass-dial.contract.test.tsx`:

```tsx
import React from "react";
import { render } from "@testing-library/react-native";

import CompassDial from "@/components/qibla/CompassDial";

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => {
    const { defaultTheme } = require("@/constants/theme");
    return { theme: defaultTheme };
  },
}));

jest.mock("@/components/ui/GlassSurface", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: ({ children, ...p }: any) => <View {...p}>{children}</View> };
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  const Svg = ({ children, ...p }: any) => <View {...p}>{children}</View>;
  return {
    __esModule: true,
    default: Svg,
    Svg,
    G: Svg,
    Line: (p: any) => <View {...p} />,
    Circle: (p: any) => <View {...p} />,
    Text: ({ children, ...p }: any) => <Text {...p}>{children}</Text>,
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  function useSharedValue(initial: number) {
    const shared = { value: initial, get: () => shared.value };
    return shared;
  }
  return {
    __esModule: true,
    default: { View },
    useSharedValue,
    useAnimatedStyle: (updater: () => object) => updater(),
    withSpring: (value: number) => value,
  };
});

describe("components/CompassDial", () => {
  const base = {
    heading: 0,
    qiblaAngle: 117,
    rotation: 117,
    distanceKm: 4160,
    isAligned: false,
  };

  it("renders bearing, distance and cardinals while seeking", () => {
    const { getByText } = render(<CompassDial {...base} />);
    expect(getByText("117°")).toBeTruthy();
    expect(getByText("to Makkah")).toBeTruthy();
    expect(getByText("4,160 km")).toBeTruthy();
    expect(getByText("N")).toBeTruthy();
    expect(getByText("E")).toBeTruthy();
  });

  it("swaps the core to the aligned label and hides the bearing", () => {
    const { getByText, queryByText } = render(
      <CompassDial {...base} rotation={0} isAligned />,
    );
    expect(getByText("Facing Makkah")).toBeTruthy();
    expect(queryByText("117°")).toBeNull();
  });

  it("omits the distance line when distanceKm is null", () => {
    const { queryByText } = render(<CompassDial {...base} distanceKm={null} />);
    expect(queryByText(/km$/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/compass-dial.contract.test.tsx`
Expected: FAIL — cannot find module `@/components/qibla/CompassDial`.

- [ ] **Step 3: Implement `CompassDial`**

Create `frontend/components/qibla/CompassDial.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import ReAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Footnote, Title1, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

import type { CompassDialProps } from "./CompassDial.types";

const SIZE = 280;
const R = SIZE / 2;

// Unwrap a target angle so the spring takes the short way round (no 360 snap).
function minimalTarget(from: number, to: number) {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta;
}

function formatKm(km: number) {
  return Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function pointOnCircle(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: R + radius * Math.sin(rad), y: R - radius * Math.cos(rad) };
}

export default function CompassDial({
  heading,
  qiblaAngle,
  distanceKm,
  isAligned,
}: CompassDialProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // --- Reduce Motion ---
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // --- Dial rotation: rotate the whole card by -heading so N tracks true north ---
  const rot = useSharedValue(0);
  useEffect(() => {
    const target = minimalTarget(rot.get(), -heading);
    rot.value = reduceMotion
      ? target
      : withSpring(target, { stiffness: 180, damping: 20, mass: 0.9 });
  }, [heading, reduceMotion, rot]);
  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  // --- One-shot ripple on the aligned rising edge ---
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const prevAligned = useRef(false);
  useEffect(() => {
    if (isAligned && !prevAligned.current && !reduceMotion) {
      rippleScale.setValue(0.62);
      rippleOpacity.setValue(0.5);
      Animated.parallel([
        Animated.timing(rippleScale, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(rippleOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
    }
    prevAligned.current = isAligned;
  }, [isAligned, reduceMotion, rippleScale, rippleOpacity]);

  // --- Ticks (every 6°, major every 30°) ---
  const ticks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let a = 0; a < 360; a += 6) {
      const major = a % 30 === 0;
      const outer = pointOnCircle(a, R - 6);
      const inner = pointOnCircle(a, major ? R - 20 : R - 13);
      out.push({ x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y, major });
    }
    return out;
  }, []);

  const cardinals = useMemo(
    () => [
      { label: "N", angle: 0 },
      { label: "E", angle: 90 },
      { label: "S", angle: 180 },
      { label: "W", angle: 270 },
    ],
    [],
  );

  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel="Qibla compass">
      {/* aligned ripple (behind everything) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          { opacity: rippleOpacity, transform: [{ scale: rippleScale }] },
        ]}
      />

      {/* glass ring material */}
      <GlassSurface tier="card" radius={R} style={styles.ring} />

      {/* aligned gold ring overlay (a sibling View — never animate glass opacity) */}
      {isAligned ? <View pointerEvents="none" style={styles.ringAligned} /> : null}

      {/* rotating dial: ticks + cardinals + Kaaba marker */}
      <ReAnimated.View style={[styles.dialLayer, dialStyle]} pointerEvents="none">
        <Svg width={SIZE} height={SIZE}>
          <G>
            {ticks.map((t, i) => (
              <Line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.major ? withOpacity(colors.accent, 0.85) : withOpacity(colors.white, 0.4)}
                strokeWidth={t.major ? 2 : 1}
              />
            ))}
            {cardinals.map((c) => {
              const p = pointOnCircle(c.angle, R - 38);
              return (
                <SvgText
                  key={c.label}
                  x={p.x}
                  y={p.y + 5}
                  fontSize={15}
                  fontWeight="600"
                  textAnchor="middle"
                  fill={c.label === "N" ? colors.accent : withOpacity(colors.white, 0.45)}
                >
                  {c.label}
                </SvgText>
              );
            })}
          </G>
        </Svg>

        {/* Kaaba marker, placed at qiblaAngle within the (already -heading-rotated) layer */}
        <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${qiblaAngle}deg` }] }]}>
          <RNText style={styles.kaaba}>🕋</RNText>
        </View>
      </ReAnimated.View>

      {/* fixed top pointer (the direction you're facing) */}
      <View pointerEvents="none" style={styles.pointer} />

      {/* fixed core readout */}
      <View pointerEvents="none" style={styles.core}>
        {isAligned ? (
          <Title3>Facing Makkah</Title3>
        ) : (
          <>
            <Title1>{`${Math.round(qiblaAngle)}°`}</Title1>
            <Caption color={withOpacity(colors.white, 0.55)} style={styles.coreLabel}>
              to Makkah
            </Caption>
          </>
        )}
        {distanceKm != null ? (
          <Footnote color={colors.accent} style={styles.coreKm}>
            {`${formatKm(distanceKm)} km`}
          </Footnote>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors } = theme;
  return StyleSheet.create({
    root: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
    ring: {
      position: "absolute",
      width: SIZE,
      height: SIZE,
      borderRadius: R,
    },
    ringAligned: {
      position: "absolute",
      width: SIZE,
      height: SIZE,
      borderRadius: R,
      borderWidth: 1.5,
      borderColor: colors.accent,
      shadowColor: colors.accent,
      shadowOpacity: 0.55,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 0 },
    },
    dialLayer: { position: "absolute", width: SIZE, height: SIZE },
    ripple: {
      position: "absolute",
      width: SIZE,
      height: SIZE,
      borderRadius: R,
      borderWidth: 1.5,
      borderColor: withOpacity(colors.accent, 0.6),
    },
    kaaba: {
      position: "absolute",
      top: -2,
      left: R - 14,
      width: 28,
      fontSize: 26,
      textAlign: "center",
    },
    pointer: {
      position: "absolute",
      top: -14,
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 13,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: colors.accent,
    },
    core: { position: "absolute", alignItems: "center", justifyContent: "center", maxWidth: SIZE - 96 },
    coreLabel: { marginTop: 6, textTransform: "uppercase", letterSpacing: 1.2 },
    coreKm: { marginTop: 7 },
  });
};
```

Create `frontend/components/qibla/CompassDial.types.ts` (keeps the prop type importable without pulling in native deps — and matches the `Produces` block):

```ts
export type CompassDialProps = {
  heading: number;
  qiblaAngle: number;
  rotation: number;
  distanceKm: number | null;
  isAligned: boolean;
};
```

> Note: `rotation` is part of the public props (the screen passes it and future work may use it for fine-grained nudge hints), even though the current visual derives the marker position from `qiblaAngle` within the `-heading`-rotated layer. Keep it in the type.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/compass-dial.contract.test.tsx`
Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/qibla/CompassDial.tsx frontend/components/qibla/CompassDial.types.ts frontend/__tests__/components/compass-dial.contract.test.tsx
git commit -F - <<'EOF'
feat(qibla): SVG instrument CompassDial with bearing/distance readout
EOF
```

---

## Task 3: Migrate the live Qibla screen onto the design system

**Files:**
- Modify: `frontend/app/(tabs)/Qibla.tsx`
- Test: `frontend/__tests__/screens/qibla.contract.test.tsx`

**Interfaces:**
- Consumes: `useQibla()` (now incl. `distanceKm`), `CompassDial` (Task 2), `Screen`, typed `Text`, `GlassSurface`, `useHaptics`.
- Produces: the migrated screen. Gate branch logic unchanged (restyled in Task 4).

- [ ] **Step 1: Update the contract-test mocks and aligned-haptic assertion (failing test)**

In `frontend/__tests__/screens/qibla.contract.test.tsx`:

Replace the `expo-haptics` mock with one that exposes `notificationAsync` + `NotificationFeedbackType`:

```tsx
jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
}));
```

Mock `CompassDial` (the screen test stays focused on the state machine + chrome; the dial has its own test) — add near the other mocks:

```tsx
jest.mock("@/components/qibla/CompassDial", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: (p: object) => <View testID="compass-dial" {...p} /> };
});
```

Add `useSafeAreaInsets` to the `react-native-safe-area-context` mock (per CLAUDE.md convention), keeping the existing `SafeAreaView`:

```tsx
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
```

Update `primeQibla` so the mocked hook returns `distanceKm` (the screen now reads it):

```tsx
function primeQibla(overrides?: Partial<ReturnType<typeof useQibla>>) {
  mockUseQibla.mockReturnValue({
    rotation: null,
    heading: null,
    qiblaAngle: null,
    distanceKm: null,
    accuracy: null,
    error: null,
    isAligned: false,
    ...overrides,
  });
}
```

Change the aligned test's haptic assertion from `impactAsync(Light)` to `notificationAsync(Success)`:

```tsx
expect(mockHaptics.notificationAsync).toHaveBeenCalledWith(
  Haptics.NotificationFeedbackType.Success,
);
```

- [ ] **Step 2: Run the screen test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/screens/qibla.contract.test.tsx`
Expected: FAIL — the aligned test asserts `notificationAsync` (screen still calls `impactAsync`), and other branches may error once mocks change.

- [ ] **Step 3: Migrate `Qibla.tsx` (live branch + scaffolding + haptic)**

In `frontend/app/(tabs)/Qibla.tsx`:

Replace the imports block at the top with:

```tsx
import { withOpacity, type AppTheme } from "@/constants/theme";
import Screen from "@/components/ui/Screen";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline, LargeTitle, Body } from "@/components/ui/Text";
import CompassDial from "@/components/qibla/CompassDial";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import useQibla from "../../hooks/useQibla";
```

(Removed: `Aurora`, `LinearGradient`, `ImageSourcePropType`, `SafeAreaView`, `react-native-reanimated`, `expo-haptics`, the `arrowImg` require, and the `minimalTarget` helper — rotation now lives in `CompassDial`.)

In the component body, replace the reanimated rotation state and the inline haptic effect. Pull `distanceKm` from the hook and use `useHaptics`:

```tsx
const { rotation, heading, qiblaAngle, distanceKm, accuracy, error, isAligned } = useQibla();
const haptics = useHaptics();

const lastHapticAt = useRef(0);
const prevAligned = useRef(false);

useEffect(() => {
  const now = Date.now();
  if (isAligned && !prevAligned.current && now - lastHapticAt.current > 900) {
    haptics("success");
    lastHapticAt.current = now;
  }
  prevAligned.current = isAligned;
}, [isAligned, haptics]);
```

(Delete the old `rot` shared value, the `withSpring` rotation `useEffect`, and the `animatedStyle` `useAnimatedStyle`.)

Replace the **live** `return (...)` (the non-gate branch, currently the `LinearGradient` wrapping `SafeAreaView`/`compassCard`/arrow) with:

```tsx
return (
  <Screen>
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Caption color={withOpacity(colors.accent, 0.9)} style={styles.eyebrow}>
          Direction
        </Caption>
        <LargeTitle style={styles.title}>Qibla Compass</LargeTitle>
        <Body color={withOpacity(colors.white, 0.85)} style={styles.subtitle}>
          Keep your phone flat and turn until the Kaaba reaches the top.
        </Body>
      </View>

      <View style={styles.statusRow}>
        <GlassSurface tier="row" radius={theme.radii.pill} style={styles.statusPill}>
          <Ionicons name="compass-outline" size={15} color={withOpacity(colors.accent, 0.95)} />
          <Caption color={withOpacity(colors.white, 0.92)} style={styles.statusPillText}>
            {accuracy != null && accuracy >= 0
              ? `Accuracy ±${Math.round(accuracy)}°`
              : "Calibrating compass..."}
          </Caption>
        </GlassSurface>
        <GlassSurface
          tier="row"
          radius={theme.radii.pill}
          style={[styles.statusPill, isAligned ? styles.statusPillAligned : null]}
        >
          <Ionicons
            name={isAligned ? "checkmark-circle" : "navigate-outline"}
            size={15}
            color={isAligned ? colors.accentSecondary : withOpacity(colors.accent, 0.95)}
          />
          <Caption color={colors.white} style={styles.statusPillText}>
            {isAligned ? "Aligned" : "Adjusting"}
          </Caption>
        </GlassSurface>
      </View>

      <View style={styles.compassArea}>
        {error ? (
          <View style={styles.stateBlock}>
            <Ionicons name="warning-outline" size={28} color={colors.danger} style={styles.errorIcon} />
            <Body color={colors.danger} style={styles.errorText}>{error}</Body>
            <Caption color={colors.accentMuted} style={styles.helperText}>
              Move your phone in a figure eight to improve compass accuracy.
            </Caption>
          </View>
        ) : rotation == null || qiblaAngle == null || heading == null ? (
          <Headline color={colors.white}>Finding direction...</Headline>
        ) : (
          <CompassDial
            heading={heading}
            qiblaAngle={qiblaAngle}
            rotation={rotation}
            distanceKm={distanceKm}
            isAligned={isAligned}
          />
        )}
      </View>
    </View>
  </Screen>
);
```

Also wrap the **gate** branch's outer `LinearGradient`+`Aurora`+`SafeAreaView` in `<Screen>` (keep the inner `InfoBanner`/CTA markup exactly as-is for now — Task 4 restyles it). Replace the gate's opening `<LinearGradient …><Aurora /><SafeAreaView style={styles.safeArea}>` with `<Screen>` and its closing `</SafeAreaView></LinearGradient>` with `</Screen>`.

Update `createStyles`: delete `gradient`, `safeArea`, `compassCard`, `ring`, `ringAligned`, `arrow`, `loadingText`, `errorText`'s old font sizing assumptions, and the old `statusPillText`/`statusPill` `borderWidth/backgroundColor` that `GlassSurface` now provides. Keep/add:

```tsx
container: { flex: 1, padding: spacing.xl },
headerSection: { marginTop: spacing.xs, marginBottom: spacing.md },
eyebrow: { textTransform: "uppercase", letterSpacing: 1 },
title: {
  marginTop: spacing.xs,
  textShadowColor: withOpacity(colors.black, 0.35),
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
},
subtitle: { marginTop: spacing.xs },
statusRow: { flexDirection: "row", gap: spacing.sm + 2, marginBottom: spacing.md, flexWrap: "wrap" },
statusPill: {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm + 2,
  paddingVertical: spacing.xs + 2,
},
statusPillAligned: { borderColor: withOpacity(colors.accent, 0.6) },
statusPillText: {},
compassArea: { flex: 1, alignItems: "center", justifyContent: "center" },
stateBlock: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
errorIcon: { marginBottom: spacing.sm },
errorText: { textAlign: "center" },
helperText: { marginTop: spacing.md, textAlign: "center" },
```

(Leave the gate-only styles — `banner`, `bannerBody`, `bannerTitle`, `bannerText`, `row`, `ctaPrimary*`, `ctaSecondary*`, `gateContent`, `infoCard`, `infoText` — untouched; Task 4 handles them.)

- [ ] **Step 4: Run the screen test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/screens/qibla.contract.test.tsx`
Expected: PASS — all branches, including the aligned test now asserting `notificationAsync(Success)` and the loading/error/pill strings preserved.

- [ ] **Step 5: Typecheck + lint the touched files**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (Common catch: a leftover import of a removed symbol — remove it.)

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(tabs)/Qibla.tsx frontend/__tests__/screens/qibla.contract.test.tsx
git commit -F - <<'EOF'
feat(qibla): migrate live screen to Screen/glass/typed text + CompassDial
EOF
```

---

## Task 4: Restyle the permission gate with glass

**Files:**
- Modify: `frontend/app/(tabs)/Qibla.tsx` (gate branch only)
- Test: `frontend/__tests__/screens/qibla.contract.test.tsx` (existing gate tests are the regression guard — strings/labels unchanged)

**Interfaces:**
- Consumes: `GlassSurface`, typed `Text` (already imported in Task 3).
- Produces: glass-styled gate; **identical** titles, messages, accessibility labels, and CTA handlers.

- [ ] **Step 1: Confirm the existing gate tests pass before changes (baseline)**

Run: `npm test -- --runTestsByPath __tests__/screens/qibla.contract.test.tsx`
Expected: PASS (the three gate branches: services-off, denied, undetermined).

- [ ] **Step 2: Restyle the `InfoBanner` and info card**

In `Qibla.tsx`, change the `InfoBanner` component to render on a `GlassSurface` and use typed `Text`, keeping the same props, strings, and the `actions` slot:

```tsx
const InfoBanner = ({
  icon, title, message, actions, iconColor = colors.white,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actions?: React.ReactNode;
  iconColor?: string;
}) => (
  <GlassSurface tier="card" radius={theme.radii.card} style={styles.banner}>
    <Ionicons name={icon} size={20} color={iconColor} />
    <View style={styles.bannerBody}>
      <Headline color={colors.accent}>{title}</Headline>
      <Body color={withOpacity(colors.white, 0.95)} style={styles.bannerText}>{message}</Body>
      {actions}
    </View>
  </GlassSurface>
);
```

Convert the "Prayer Times still work…" info card to a `GlassSurface` (`tier="row"`), keeping its text:

```tsx
<GlassSurface tier="row" radius={theme.radii.row} style={styles.infoCard}>
  <Body color={withOpacity(colors.white, 0.9)} style={styles.infoText}>
    Prayer Times still work without location. You can use a manual city from the Settings tab.
  </Body>
</GlassSurface>
```

Update `createStyles`: drop the `backgroundColor`/`borderWidth`/`borderColor` from `banner` and `infoCard` (now supplied by `GlassSurface`); keep their layout props (`padding`, `flexDirection`, `marginTop`, etc.). Remove the now-unused `bannerTitle` text style.

- [ ] **Step 3: Run gate tests to verify they still pass**

Run: `npm test -- --runTestsByPath __tests__/screens/qibla.contract.test.tsx`
Expected: PASS — strings and accessibility labels unchanged, so all gate branches stay green.

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(tabs)/Qibla.tsx
git commit -F - <<'EOF'
feat(qibla): glass restyle the location permission gate
EOF
```

---

## Task 5: Remove the old arrow asset and run the full verify gate

**Files:**
- Delete: `frontend/assets/images/qibla-compass-svgrepo-com.png`
- Possibly modify: `frontend/__tests__/README.md` (if the suite list changed — a new `compass-dial.contract.test.tsx` was added)

**Interfaces:** none.

- [ ] **Step 1: Confirm the PNG is unreferenced**

Run: `cd frontend && grep -rn "qibla-compass-svgrepo-com" app components hooks __tests__ assets 2>/dev/null || echo "no references"`
Expected: `no references` (Task 3 removed the only `require`). If anything prints, stop and resolve it before deleting.

- [ ] **Step 2: Delete the asset**

```bash
git rm frontend/assets/images/qibla-compass-svgrepo-com.png
```

- [ ] **Step 3: Update the test index if needed**

Open `frontend/__tests__/README.md`. If it enumerates suites, add a line for `__tests__/components/compass-dial.contract.test.tsx` ("CompassDial contract — bearing/distance readout, cardinals, aligned swap"). If it does not enumerate suites, leave it.

- [ ] **Step 4: Run the full verify gate**

Run: `cd frontend && npm run verify`
Expected: lint clean, typecheck clean, all tests pass (incl. `useQibla`, `CompassDial`, and `Qibla` contract suites).

- [ ] **Step 5: Commit**

```bash
git add frontend/__tests__/README.md
git commit -F - <<'EOF'
chore(qibla): drop legacy arrow asset; document CompassDial test suite
EOF
```

---

## Self-Review

**Spec coverage** (spec → task):
- §3.02 Instrument dial / §5 dial structure → **Task 2**.
- §3.03 heading-rotated card, true-north cardinals, 🕋 at `qiblaAngle` → **Task 2** (`dialStyle` rotates by `-heading`; marker at `qiblaAngle`).
- §3.04 / §6.4 calm bloom + one-shot ripple → **Task 2** (`ringAligned` overlay + RN `Animated` ripple).
- §3.05 `success` haptic, once-per-alignment → **Task 3** (`useHaptics("success")` + `prevAligned`/`lastHapticAt` guard).
- §3.06 / §5.3 bearing + distance readout, seeking↔aligned swap, no overlap → **Task 2** (`core` with `maxWidth`, conditional render).
- §3.07 single functional subtitle, no blessing → **Task 3** (`subtitle` Body, same in both live states; no aligned-specific copy).
- §3.08 / §6 `Screen` scaffold, status pills, loading/error → **Task 3**.
- §7 additive `distanceKm` (haversine), null-safe → **Task 1**.
- §6.5 permission gate restyle, logic untouched → **Task 4**.
- §8 SVG dial + Reanimated rotation + RN `Animated` ripple + Reduce Motion → **Task 2**.
- §9 theming (no static colors), light-theme via tokens → **Tasks 2–4** (all styles via `createStyles`/tokens).
- §13 remove PNG asset → **Task 5**.
- §14 tests (`useQibla.test`, `qibla.contract`, README) → **Tasks 1, 3, 5**; new CompassDial suite → **Task 2**.

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code; test steps show full assertions and exact run commands.

**Type consistency:** `CompassDialProps` defined in `CompassDial.types.ts` (Task 2) is the same shape the screen passes (Task 3) and matches the `Produces` block. `UseQiblaResult.distanceKm: number | null` (Task 1) is consumed as `distanceKm` by the screen (Task 3) and `CompassDial` (Task 2). `useHaptics()(event)` and `Haptics.NotificationFeedbackType.Success` match the real `useHaptics`/`expo-haptics` APIs. Preserved strings match the existing contract-test assertions.

---

## Execution Handoff

(Filled in by the writing-plans skill below.)
