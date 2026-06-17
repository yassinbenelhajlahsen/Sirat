# Visual Refresh — Plan 1: Foundations + App Shell + Home (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared design-language foundation, the new 5-tab Liquid-Glass app shell, and the refreshed flagship Home screen — the first shippable slice of the Sirat visual refresh.

**Architecture:** Extend `constants/theme.ts` with a richer token system (type ramp, radii, glass materials) and refresh the flagship `default` palette. Add shared UI primitives (`GlassSurface`, typed `Text`, `Screen`), a `useHaptics` hook, and pure motion constants. Replace the hand-rolled 6-tab bar with a custom `GlassTabBar` (5 visible tabs; Settings moves to a Home header gear). Restyle Home using the new primitives. All changes are visual — no behavior/logic changes. Glass is rendered with `expo-glass-effect` on iOS, gated by `isGlassEffectAPIAvailable()`, with a solid-translucent fallback on Android / iOS ≤ 25.

**Tech Stack:** Expo SDK 54.0.12, React Native 0.81.4, expo-router 6, `expo-glass-effect` (new), RN `Animated` (motion), `expo-haptics`, react-native-svg (already installed), Ionicons. Tests: jest + jest-expo + @testing-library/react-native. Verify: `npm run verify` from `frontend/`.

**Source of truth:** `plans/2026-06-16-visual-refresh-liquid-glass-design.md`. Read it before starting.

---

## Conventions & ground rules (read once)

- All commands run from `frontend/`.
- Verify command: `npm run verify` (lint + typecheck + jest). Single test file: `npm test -- --runTestsByPath <path>`.
- **Glass risk rules (from spec §10):** never animate the `opacity` of a `GlassView` or any ancestor; gate every glass mount on `isGlassEffectAPIAvailable()`; QA glass on a real device, not Expo Go.
- **Backward compatibility:** existing screens (Quran/Qibla/Mosques/Calendar/Settings) are NOT in this plan. Do not change the shape of existing `theme.typography` (numeric) keys or existing `AppColors` field meanings — only **add** new tokens, so unmodified screens keep compiling.
- Commit after every task (frequent commits). Commit straight to `main` (user preference; no feature branch).
- Icons stay **Ionicons** (cross-platform, already used) for parity with Android. The SF-Symbols swap from the spec is deferred to a later polish plan — note this is an intentional Plan-1 deviation.
- Motion uses RN `Animated` (the codebase's proven, test-stable API), not Reanimated, in Plan 1. Reanimated shared-element transitions are deferred. The calm feel comes from the spring/timing constants.

---

## File Structure

**Create:**
- `frontend/constants/motion.ts` — pure motion constants (spring/timing/scale/stagger).
- `frontend/utils/greeting.ts` — `getGreeting(date)` time-based greeting.
- `frontend/hooks/useHaptics.ts` — `useHaptics()` → `(event) => void`, wraps `expo-haptics`.
- `frontend/components/ui/GlassSurface.tsx` — glass-or-fallback surface, `tier` prop.
- `frontend/components/ui/Text.tsx` — typed text components reading `theme.type`.
- `frontend/components/ui/Screen.tsx` — gradient + safe-area scaffold.
- `frontend/components/navigation/GlassTabBar.tsx` — custom 5-tab glass pill.
- Test files: `__tests__/utils/greeting.test.ts`, `__tests__/constants/motion.test.ts`, `__tests__/hooks/useHaptics.test.ts`, `__tests__/components/glass-surface.contract.test.tsx`, `__tests__/components/ui-text.contract.test.tsx`, `__tests__/navigation/glass-tab-bar.contract.test.tsx`.

**Modify:**
- `frontend/constants/theme.ts` — add `radii`, extend `spacing`, add `type` ramp, add `materials` + `accentSecondary`; refresh `default` palette anchors.
- `frontend/test/setup/jest.setup.ts` — global mocks for `expo-glass-effect` and full `expo-haptics`.
- `frontend/app.config.js` — `ios.infoPlist.UIDesignRequiresCompatibility = true`.
- `frontend/app/(tabs)/_layout.tsx` — 5 visible tabs reordered, Settings hidden, custom `tabBar`, calm tab animation.
- `frontend/app/_layout.tsx:377` — root `Stack` animation `"none"` → `"fade"`.
- `frontend/app/(tabs)/index.tsx` — Home restyle.
- `frontend/__tests__/navigation/tabs-layout.contract.test.tsx` — route order update.
- `frontend/__tests__/navigation/navigation-contracts.test.tsx` — route order + Stack animation update.
- `frontend/__tests__/screens/screen-contracts.test.tsx` — Home assertions + haptics mock update.
- `frontend/__tests__/README.md` — list new suites.

---

# PHASE 1 — Foundations

### Task 1: Test infra — mock `expo-glass-effect` and full `expo-haptics`

**Files:**
- Modify: `frontend/test/setup/jest.setup.ts`

- [ ] **Step 1: Add global mocks** — append after the `expo-notifications` mock block (after line 38):

```ts
jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GlassView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    GlassContainer: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    isGlassEffectAvailable: jest.fn(() => true),
    isGlassEffectAPIAvailable: jest.fn(() => true),
    isLiquidGlassAvailable: jest.fn(() => true),
  };
});

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
```

- [ ] **Step 2: Verify the suite still loads** — Run: `npm test -- --runTestsByPath __tests__/context/ThemeContext.test.tsx`
Expected: PASS (mocks don't affect this suite; confirms setup file has no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add test/setup/jest.setup.ts
git commit -m "test: mock expo-glass-effect and full expo-haptics in jest setup"
```

---

### Task 2: `getGreeting` time-based greeting util (TDD)

**Files:**
- Create: `frontend/utils/greeting.ts`
- Test: `frontend/__tests__/utils/greeting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/utils/greeting.test.ts
import { getGreeting } from "@/utils/greeting";

const at = (hour: number) => new Date(2026, 5, 16, hour, 0, 0);

describe("getGreeting", () => {
  it("returns morning before noon", () => {
    expect(getGreeting(at(0))).toBe("Good morning");
    expect(getGreeting(at(11))).toBe("Good morning");
  });
  it("returns afternoon from noon to 17:59", () => {
    expect(getGreeting(at(12))).toBe("Good afternoon");
    expect(getGreeting(at(17))).toBe("Good afternoon");
  });
  it("returns evening from 18:00 onward", () => {
    expect(getGreeting(at(18))).toBe("Good evening");
    expect(getGreeting(at(23))).toBe("Good evening");
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — Run: `npm test -- --runTestsByPath __tests__/utils/greeting.test.ts`
Expected: FAIL — cannot find module `@/utils/greeting`.

- [ ] **Step 3: Implement**

```ts
// utils/greeting.ts
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
```

- [ ] **Step 4: Run it, verify PASS** — Run: `npm test -- --runTestsByPath __tests__/utils/greeting.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/greeting.ts __tests__/utils/greeting.test.ts
git commit -m "feat: add time-based getGreeting util"
```

---

### Task 3: Motion constants (TDD)

**Files:**
- Create: `frontend/constants/motion.ts`
- Test: `frontend/__tests__/constants/motion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/constants/motion.test.ts
import {
  SPRING_GENTLE, SPRING_PRESS, PRESS_SCALE,
  TIMING_ENTER, TIMING_EXIT, BREATH_HALF_CYCLE, STAGGER_MS,
} from "@/constants/motion";

describe("motion constants", () => {
  it("uses a gentle, low-bounce press scale", () => {
    expect(PRESS_SCALE).toBe(0.97);
    expect(SPRING_PRESS).toEqual({ speed: 18, bounciness: 4 });
    expect(SPRING_GENTLE).toEqual({ speed: 14, bounciness: 3 });
  });
  it("uses calm timings", () => {
    expect(TIMING_ENTER).toBe(480);
    expect(TIMING_EXIT).toBe(320);
    expect(BREATH_HALF_CYCLE).toBe(2300);
    expect(STAGGER_MS).toBe(70);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — Run: `npm test -- --runTestsByPath __tests__/constants/motion.test.ts` → Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// constants/motion.ts
// Calm-premium motion constants (RN Animated). Pure data — no Reanimated import.
export const PRESS_SCALE = 0.97;
export const SPRING_PRESS = { speed: 18, bounciness: 4 } as const;
export const SPRING_GENTLE = { speed: 14, bounciness: 3 } as const;
export const TIMING_ENTER = 480;
export const TIMING_EXIT = 320;
export const BREATH_HALF_CYCLE = 2300; // ms for one direction of the breathing loop
export const STAGGER_MS = 70;
```

- [ ] **Step 4: Run it, verify PASS** → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add constants/motion.ts __tests__/constants/motion.test.ts
git commit -m "feat: add calm-premium motion constants"
```

---

### Task 4: Token system expansion + flagship `default` palette refresh

**Files:**
- Modify: `frontend/constants/theme.ts`

Existing `AppColors`, `spacing`, `typography`, the three color objects, `themeMap`, `withOpacity` stay. We **add** tokens and refresh `default` values.

- [ ] **Step 1: Add `accentSecondary` to the `AppColors` type** — in the `AppColors` type, after `accentMuted: string;` add:

```ts
  accentSecondary: string;
```

- [ ] **Step 2: Add `accentSecondary` to all three palettes** so every theme satisfies the type:
  - In `ACCENT_COLORS` (shared) it's easiest to NOT put it (it differs per theme). Instead add it to each color object:
  - `defaultColors`: add `accentSecondary: "#3FB984",`
  - `darkColors`: add `accentSecondary: "#33D29B",`
  - `lightColors`: add `accentSecondary: "#2E7D5B",`

- [ ] **Step 3: Refresh the flagship `default` canvas anchors** — replace these fields inside `defaultColors`:

```ts
  primary: "#102A1C",
  primaryDeep: "#0B1810",
  primaryDark: "#0A150E",
  primaryLift: "#15402A",
```
And refresh the gold accent — in `ACCENT_COLORS` change `accent` from `"#DABA69"` to:

```ts
  accent: "#E8C77A",
```
(Leave `darkColors`/`lightColors` other fields unchanged in Plan 1; full B/light refresh is a later plan. `darkColors`/`lightColors` keep `accent` via the shared `ACCENT_COLORS` for now — acceptable; later plans override per spec.)

- [ ] **Step 4: Extend `spacing`** — replace the `spacing` object:

```ts
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40,
} as const;
```

- [ ] **Step 5: Add `radii`** — after the `spacing` block:

```ts
export const radii = {
  chip: 10, row: 14, card: 18, cardLg: 20, hero: 24, heroLg: 26, pill: 999,
} as const;
```

- [ ] **Step 6: Add the `type` ramp** — after `typography`:

```ts
export type TypeStyleName =
  | "largeTitle" | "title1" | "title2" | "title3"
  | "headline" | "body" | "callout" | "subhead" | "footnote" | "caption";

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontFamily: "SFProDisplay-Regular" | "SFProDisplay-Semibold" | "SFProDisplay-Bold";
};

export const type: Record<TypeStyleName, TypeStyle> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontFamily: "SFProDisplay-Bold" },
  title1: { fontSize: 28, lineHeight: 34, fontFamily: "SFProDisplay-Bold" },
  title2: { fontSize: 22, lineHeight: 28, fontFamily: "SFProDisplay-Bold" },
  title3: { fontSize: 20, lineHeight: 25, fontFamily: "SFProDisplay-Semibold" },
  headline: { fontSize: 17, lineHeight: 22, fontFamily: "SFProDisplay-Semibold" },
  body: { fontSize: 17, lineHeight: 24, fontFamily: "SFProDisplay-Regular" },
  callout: { fontSize: 16, lineHeight: 21, fontFamily: "SFProDisplay-Regular" },
  subhead: { fontSize: 15, lineHeight: 20, fontFamily: "SFProDisplay-Regular" },
  footnote: { fontSize: 13, lineHeight: 18, fontFamily: "SFProDisplay-Regular" },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: "SFProDisplay-Regular" },
};
```

- [ ] **Step 7: Add the `materials` (glass tiers) builder** — after `type`:

```ts
export type GlassTier = { fill: string; border: string; blur: number };
export type Materials = { chrome: GlassTier; card: GlassTier; row: GlassTier };

export function buildMaterials(colors: AppColors, isLight: boolean): Materials {
  // On dark themes glass is a light film; on light themes a dark tint.
  const tintBase = isLight ? colors.black : colors.white;
  return {
    chrome: { fill: withOpacity(tintBase, isLight ? 0.06 : 0.1), border: withOpacity(tintBase, isLight ? 0.1 : 0.18), blur: 26 },
    card:   { fill: withOpacity(tintBase, isLight ? 0.05 : 0.07), border: withOpacity(tintBase, isLight ? 0.08 : 0.13), blur: 18 },
    row:    { fill: withOpacity(tintBase, isLight ? 0.04 : 0.05), border: withOpacity(tintBase, isLight ? 0.07 : 0.09), blur: 0 },
  };
}
```
(`withOpacity` is defined lower in the file but hoisted as a `const` arrow — to be safe, **move the `withOpacity` definition above `buildMaterials`**, or convert it to a `function` declaration so it hoists. Simplest: change `export const withOpacity = (...) => {...}` to `export function withOpacity(...) {...}` so it hoists above `buildMaterials`.)

- [ ] **Step 8: Wire new tokens into `AppTheme` and the three themes** — update the `AppTheme` type:

```ts
export type AppTheme = {
  name: ThemeName;
  colors: AppColors;
  spacing: typeof spacing;
  typography: typeof typography;
  type: typeof type;
  radii: typeof radii;
  materials: Materials;
};
```
Then add `type`, `radii`, `materials` to each theme object:

```ts
export const defaultTheme: AppTheme = {
  name: "default", colors: defaultColors, spacing, typography, type, radii,
  materials: buildMaterials(defaultColors, false),
};
export const darkTheme: AppTheme = {
  name: "dark", colors: darkColors, spacing, typography, type, radii,
  materials: buildMaterials(darkColors, false),
};
export const lightTheme: AppTheme = {
  name: "light", colors: lightColors, spacing, typography, type, radii,
  materials: buildMaterials(lightColors, true),
};
```

- [ ] **Step 9: Typecheck** — Run: `npm run typecheck`
Expected: PASS (no consumer breaks — only additive token changes; `withOpacity` now a hoisted function).

- [ ] **Step 10: Run theme + Home contract tests** — Run: `npm test -- --runTestsByPath __tests__/context/ThemeContext.test.tsx`
Expected: PASS (test compares against the same `defaultTheme` export, so refreshed values stay in sync).

- [ ] **Step 11: Commit**

```bash
git add constants/theme.ts
git commit -m "feat(theme): add type ramp, radii, glass materials; refresh default palette"
```

---

### Task 5: `GlassSurface` primitive (TDD on fallback selection)

**Files:**
- Create: `frontend/components/ui/GlassSurface.tsx`
- Test: `frontend/__tests__/components/glass-surface.contract.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/glass-surface.contract.test.tsx
import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import { isGlassEffectAPIAvailable } from "expo-glass-effect";
import GlassSurface from "@/components/ui/GlassSurface";

const mockApiAvailable = isGlassEffectAPIAvailable as jest.Mock;

describe("GlassSurface", () => {
  it("renders children and uses the glass node when the API is available", () => {
    mockApiAvailable.mockReturnValue(true);
    const { getByTestId, getByText } = render(
      <GlassSurface tier="card" testID="surface"><Text>hi</Text></GlassSurface>,
    );
    expect(getByText("hi")).toBeTruthy();
    expect(getByTestId("surface")).toBeTruthy();
  });

  it("falls back to a solid surface when the glass API is unavailable", () => {
    mockApiAvailable.mockReturnValue(false);
    const { getByTestId } = render(
      <GlassSurface tier="card" testID="surface-fallback"><Text>hi</Text></GlassSurface>,
    );
    const node = getByTestId("surface-fallback");
    const flat = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style)
      : node.props.style;
    // Fallback must paint its own background for contrast.
    expect(flat.backgroundColor).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — Run: `npm test -- --runTestsByPath __tests__/components/glass-surface.contract.test.tsx` → Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```tsx
// components/ui/GlassSurface.tsx
import { ReactNode } from "react";
import { Platform, StyleProp, View, ViewProps, ViewStyle } from "react-native";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";

import { useTheme } from "@/context/ThemeContext";

type Tier = "chrome" | "card" | "row";

type GlassSurfaceProps = ViewProps & {
  tier?: Tier;
  /** radius applied to the surface; defaults to theme.radii.card */
  radius?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function GlassSurface({
  tier = "card",
  radius,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const m = theme.materials[tier];
  const r = radius ?? theme.radii.card;

  // Real Liquid Glass only on iOS when the API is present (spec §10 crash guard).
  const useGlass = Platform.OS === "ios" && isGlassEffectAPIAvailable();

  const shared: ViewStyle = {
    borderRadius: r,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: m.border,
    overflow: "hidden",
  };

  if (useGlass) {
    return (
      <GlassView
        glassEffectStyle={tier === "chrome" ? "clear" : "regular"}
        style={[shared, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  // Fallback: solid translucent fill (Android / iOS <= 25 / Reduce Transparency).
  return (
    <View style={[shared, { backgroundColor: m.fill }, style]} {...rest}>
      {children}
    </View>
  );
}
```

- [ ] **Step 4: Run it, verify PASS** → Expected: PASS (test toggles `isGlassEffectAPIAvailable`; Platform.OS is `ios` under jest-expo, so the glass branch renders the mocked `GlassView`, the fallback branch renders the `View` with `backgroundColor`).

- [ ] **Step 5: Typecheck** — Run: `npm run typecheck` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ui/GlassSurface.tsx __tests__/components/glass-surface.contract.test.tsx
git commit -m "feat(ui): add GlassSurface primitive with gated glass + solid fallback"
```

---

### Task 6: `useHaptics` hook (TDD)

**Files:**
- Create: `frontend/hooks/useHaptics.ts`
- Test: `frontend/__tests__/hooks/useHaptics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/hooks/useHaptics.test.ts
import { renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useHaptics } from "@/hooks/useHaptics";

describe("useHaptics", () => {
  it("maps each event to the right expo-haptics call", () => {
    const { result } = renderHook(() => useHaptics());
    const haptic = result.current;

    haptic("selection");
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

    haptic("light");
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

    haptic("medium");
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

    haptic("success");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);

    haptic("error");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it("never throws if a native call rejects", () => {
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error("no haptics"));
    const { result } = renderHook(() => useHaptics());
    expect(() => result.current("selection")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — Run: `npm test -- --runTestsByPath __tests__/hooks/useHaptics.test.ts` → Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// hooks/useHaptics.ts
import { useCallback } from "react";
import * as Haptics from "expo-haptics";

export type HapticEvent = "selection" | "light" | "medium" | "success" | "error";

export function useHaptics() {
  return useCallback((event: HapticEvent) => {
    try {
      switch (event) {
        case "selection": void Haptics.selectionAsync(); break;
        case "light": void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
        case "medium": void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
        case "success": void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
        case "error": void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
      }
    } catch {
      // Haptics are best-effort; never block the UI.
    }
  }, []);
}
```

- [ ] **Step 4: Run it, verify PASS** → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useHaptics.ts __tests__/hooks/useHaptics.test.ts
git commit -m "feat(hooks): add useHaptics with meaning-based haptic mapping"
```

---

### Task 7: Typed `Text` components

**Files:**
- Create: `frontend/components/ui/Text.tsx`
- Test: `frontend/__tests__/components/ui-text.contract.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/ui-text.contract.test.tsx
import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import { LargeTitle, Body, Caption } from "@/components/ui/Text";

describe("typed Text", () => {
  it("renders content and applies the ramp font size", () => {
    const { getByText } = render(<LargeTitle>Hello</LargeTitle>);
    const node = getByText("Hello");
    const flat = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.flat())
      : node.props.style;
    expect(flat.fontSize).toBe(34);
  });
  it("renders Body and Caption", () => {
    const { getByText } = render(<><Body>b</Body><Caption>c</Caption></>);
    expect(getByText("b")).toBeTruthy();
    expect(getByText("c")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, verify it fails** → `npm test -- --runTestsByPath __tests__/components/ui-text.contract.test.tsx` → Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// components/ui/Text.tsx
import { Text as RNText, TextProps, StyleProp, TextStyle } from "react-native";
import type { TypeStyleName } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppTextProps = TextProps & {
  variant: TypeStyleName;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function AppText({ variant, color, style, ...rest }: AppTextProps) {
  const { theme } = useTheme();
  const t = theme.type[variant];
  return (
    <RNText
      allowFontScaling={false}
      style={[
        { fontSize: t.fontSize, lineHeight: t.lineHeight, fontFamily: t.fontFamily, color: color ?? theme.colors.white },
        style,
      ]}
      {...rest}
    />
  );
}

const make = (variant: TypeStyleName) =>
  function Variant(props: Omit<AppTextProps, "variant">) {
    return <AppText variant={variant} {...props} />;
  };

export const LargeTitle = make("largeTitle");
export const Title1 = make("title1");
export const Title2 = make("title2");
export const Title3 = make("title3");
export const Headline = make("headline");
export const Body = make("body");
export const Callout = make("callout");
export const Subhead = make("subhead");
export const Footnote = make("footnote");
export const Caption = make("caption");
```

- [ ] **Step 4: Run it, verify PASS** → Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add components/ui/Text.tsx __tests__/components/ui-text.contract.test.tsx
git commit -m "feat(ui): add typed Text components bound to the type ramp"
```

---

### Task 8: `Screen` scaffold (gradient + safe area)

**Files:**
- Create: `frontend/components/ui/Screen.tsx`

This wraps the repeated `LinearGradient` + `SafeAreaView` + subtle pattern used across screens. Home will adopt it.

- [ ] **Step 1: Implement**

```tsx
// components/ui/Screen.tsx
import { ReactNode } from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/context/ThemeContext";

type ScreenProps = {
  children: ReactNode;
  /** when false, content is not wrapped in SafeAreaView (e.g., full-bleed maps) */
  safeArea?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Screen({ children, safeArea = true, style }: ScreenProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const inner = <View style={[styles.fill, style]}>{children}</View>;

  return (
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={styles.pattern}
        pointerEvents="none"
      />
      {safeArea ? <SafeAreaView style={styles.fill}>{inner}</SafeAreaView> : inner}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pattern: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.04, resizeMode: "repeat", width: "100%", height: "100%",
  },
});
```

- [ ] **Step 2: Typecheck** — Run: `npm run typecheck` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Screen.tsx
git commit -m "feat(ui): add Screen scaffold (gradient + safe area + pattern)"
```

---

# PHASE 2 — App Shell

### Task 9: Install `expo-glass-effect` + iOS 26 opt-out config

**Files:**
- Modify: `frontend/app.config.js`
- (Dependency) `frontend/package.json` / `package-lock.json`

- [ ] **Step 1: Install the package** — Run: `npx expo install expo-glass-effect`
Expected: adds `expo-glass-effect` to `dependencies` (autolinked; no config plugin entry required).

- [ ] **Step 2: Opt out of the blanket iOS 26 auto-restyle** — in `app.config.js`, inside `ios.infoPlist`, add:

```js
        UIDesignRequiresCompatibility: true,
```
(Keep all existing infoPlist keys. This is the spec §5.5 stopgap so unfinished screens aren't auto-restyled on iOS 26 during migration.)

- [ ] **Step 3: Check the EAS build image** — Run: `cat eas.json`
If an iOS build profile pins an `"image"`, ensure it is an Xcode-26-capable image (SDK 54 EAS default is Xcode 26). If no image is pinned, no change needed. Note findings in the commit message.

- [ ] **Step 4: Typecheck** — Run: `npm run typecheck` → Expected: PASS (config is JS; this just confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add app.config.js package.json package-lock.json
git commit -m "build: add expo-glass-effect and opt out of iOS 26 auto-restyle during migration"
```

---

### Task 10: `GlassTabBar` component

**Files:**
- Create: `frontend/components/navigation/GlassTabBar.tsx`
- Test: `frontend/__tests__/navigation/glass-tab-bar.contract.test.tsx`

The custom tab bar receives React Navigation `BottomTabBarProps`. It renders a glass pill with **only** the visible routes (everything except `Settings`), in declared order, with a gold active bubble. Tapping navigates; the active tab fires a selection haptic.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/navigation/glass-tab-bar.contract.test.tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import GlassTabBar from "@/components/navigation/GlassTabBar";

const makeProps = (index: number, navigate: jest.Mock) => ({
  state: {
    index,
    routes: [
      { key: "index", name: "index" },
      { key: "Quran", name: "Quran" },
      { key: "Qibla", name: "Qibla" },
      { key: "Mosques", name: "Mosques" },
      { key: "Calendar", name: "Calendar" },
      { key: "Settings", name: "Settings" },
    ],
  },
  descriptors: {},
  navigation: { navigate, emit: () => ({ defaultPrevented: false }) },
} as any);

describe("GlassTabBar", () => {
  it("renders a button per visible tab and hides Settings", () => {
    const { getByLabelText, queryByLabelText } = render(
      <GlassTabBar {...makeProps(0, jest.fn())} />,
    );
    ["Home", "Quran", "Qibla", "Mosques", "Calendar"].forEach((t) =>
      expect(getByLabelText(t)).toBeTruthy(),
    );
    expect(queryByLabelText("Settings")).toBeNull();
  });

  it("navigates to the tapped route", () => {
    const navigate = jest.fn();
    const { getByLabelText } = render(<GlassTabBar {...makeProps(0, navigate)} />);
    fireEvent.press(getByLabelText("Quran"));
    expect(navigate).toHaveBeenCalledWith("Quran");
  });
});
```

- [ ] **Step 2: Run it, verify it fails** → `npm test -- --runTestsByPath __tests__/navigation/glass-tab-bar.contract.test.tsx` → Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```tsx
// components/navigation/GlassTabBar.tsx
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassSurface from "@/components/ui/GlassSurface";
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

const HIDDEN = new Set(["Settings"]);

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: { on: "home", off: "home-outline", label: "Home" },
  Quran: { on: "book", off: "book-outline", label: "Quran" },
  Qibla: { on: "compass", off: "compass-outline", label: "Qibla" },
  Mosques: { on: "location", off: "location-outline", label: "Mosques" },
  Calendar: { on: "today", off: "today-outline", label: "Calendar" },
};

export default function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();

  const visible = state.routes.filter((r) => !HIDDEN.has(r.name));

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 14) + 6 }]} pointerEvents="box-none">
      <GlassSurface tier="chrome" radius={theme.radii.pill} style={styles.pill}>
        {visible.map((route) => {
          const meta = ICONS[route.name];
          if (!meta) return null;
          const activeIndex = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === activeIndex;

          const onPress = () => {
            haptic("selection");
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true } as any);
            if (!focused && !(event as any)?.defaultPrevented) navigation.navigate(route.name as never);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              onPress={onPress}
              style={styles.item}
            >
              <View style={[styles.bubble, focused && { backgroundColor: colors.accent }]}>
                <Ionicons
                  name={focused ? meta.on : meta.off}
                  size={22}
                  color={focused ? colors.onAccent : withOpacity(colors.white, 0.6)}
                />
              </View>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14 },
  pill: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  item: { alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44 },
  bubble: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
```

- [ ] **Step 4: Run it, verify PASS** → Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add components/navigation/GlassTabBar.tsx __tests__/navigation/glass-tab-bar.contract.test.tsx
git commit -m "feat(nav): add GlassTabBar (5 visible tabs, glass pill, haptic selection)"
```

---

### Task 11: Rewire `(tabs)/_layout.tsx` to 5 visible tabs + custom bar

**Files:**
- Modify: `frontend/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace the file** with the reordered tabs, Settings hidden from the bar, the custom `tabBar`, and a calm cross-fade:

```tsx
import { Tabs } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import GlassTabBar from "@/components/navigation/GlassTabBar";
import { useTheme } from "@/context/ThemeContext";

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <SafeAreaProvider>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          animation: "fade",
          sceneStyle: { backgroundColor: theme.colors.primaryDark },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="Quran" options={{ title: "Quran" }} />
        <Tabs.Screen name="Qibla" options={{ title: "Qibla" }} />
        <Tabs.Screen name="Mosques" options={{ title: "Mosques" }} />
        <Tabs.Screen name="Calendar" options={{ title: "Calendar" }} />
        {/* Declared so the route stays linkable from the Home gear; hidden from the bar by GlassTabBar. */}
        <Tabs.Screen name="Settings" options={{ title: "Settings" }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Update `tabs-layout.contract.test.tsx`** — the route order changed and Settings is last. Replace the `routeNames` expectation (lines ~63-70) with:

```ts
    expect(routeNames).toEqual([
      "index",
      "Quran",
      "Qibla",
      "Mosques",
      "Calendar",
      "Settings",
    ]);
```
The per-screen `options` assertion (`title` is a string, `tabBarIcon` is a function) no longer holds — icons now live in `GlassTabBar`, not per-screen. Replace that `forEach` block (lines ~72-79) with a title-only check:

```ts
    tabScreenMock.mock.calls.forEach(([props]) => {
      expect(props.options).toEqual(
        expect.objectContaining({ title: expect.any(String) }),
      );
    });
```

- [ ] **Step 3: Update `navigation-contracts.test.tsx`** — same route-order change (lines ~239-246):

```ts
    expect(routeNames).toEqual([
      "index",
      "Quran",
      "Qibla",
      "Mosques",
      "Calendar",
      "Settings",
    ]);
```

- [ ] **Step 4: Run both navigation suites** — Run: `npm test -- --runTestsByPath __tests__/navigation/tabs-layout.contract.test.tsx __tests__/navigation/navigation-contracts.test.tsx`
Expected: the tabs-layout suite PASSES; navigation-contracts still FAILS on the root-stack `animation: "none"` assertion (fixed in Task 12). That failure is expected here.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add "app/(tabs)/_layout.tsx" __tests__/navigation/tabs-layout.contract.test.tsx __tests__/navigation/navigation-contracts.test.tsx
git commit -m "feat(nav): 5-tab layout with custom GlassTabBar; Settings off the bar"
```

---

### Task 12: Calm root-stack transition

**Files:**
- Modify: `frontend/app/_layout.tsx:377`
- Modify: `frontend/__tests__/navigation/navigation-contracts.test.tsx:261-266`

- [ ] **Step 1: Change the Stack animation** — at `app/_layout.tsx` line 377, replace:

```tsx
            <Stack screenOptions={{ headerShown: false, animation: "none" }}>
```
with:

```tsx
            <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 280 }}>
```
(MosqueMap keeps its own explicit `animation: "fade", animationDuration: 300` override.)

- [ ] **Step 2: Update the navigation-contracts assertion** — in `navigation-contracts.test.tsx` (the root-stack test, ~lines 261-266) replace the `screenOptions` expectation with:

```ts
    expect(stackProps.screenOptions).toEqual(
      expect.objectContaining({
        headerShown: false,
        animation: "fade",
        animationDuration: 280,
      }),
    );
```

- [ ] **Step 3: Run the suite** — Run: `npm test -- --runTestsByPath __tests__/navigation/navigation-contracts.test.tsx` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx __tests__/navigation/navigation-contracts.test.tsx
git commit -m "feat(nav): calm fade transition on the root stack"
```

---

# PHASE 3 — Home

### Task 13: Restyle Home (`(tabs)/index.tsx`)

**Files:**
- Modify: `frontend/app/(tabs)/index.tsx`
- Modify: `frontend/__tests__/screens/screen-contracts.test.tsx`

Preserve all existing hooks/logic exactly (`useHomePrayerTimes`, `useDuaInteraction`, `useKeyboardAutoScroll`, `useModalTransition`, the tomorrow-completion branch and its `accessibilityLabel="View tomorrow prayer times"`). Only presentation changes: `Screen` scaffold, time-based greeting headline, header gear → Settings, a glass hero next-prayer card with a breathing accent badge, the prayer list wrapped in a glass card, and the du'ā action preserved.

- [ ] **Step 1: Write/adjust the failing test first** — in `screen-contracts.test.tsx`:
  - Update the expo-haptics mock (lines ~170-173) to the full surface so Home's `useHaptics` works:

```ts
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
```
  - Replace the Home "renders the prayer and dua sections contract" test (lines ~740-749) with assertions on the new, stable elements (the greeting is time-based, so assert the location, next-prayer name, dua, list, and the gear instead of `"Prayer Times"`):

```ts
    it("renders the prayer and dua sections contract", () => {
      const { getByText, getByTestId, getByLabelText } = render(<Home />);

      expect(getByText("Chicago, US")).toBeTruthy();
      expect(getByText("Dhuhr")).toBeTruthy();          // hero next-prayer name
      expect(getByText("DuaCardMock")).toBeTruthy();
      expect(getByTestId("prayer-times-list")).toHaveTextContent("loading:false count:1");
      expect(getByLabelText("Open settings")).toBeTruthy();
    });

    it("opens settings from the header gear", () => {
      const { getByLabelText } = render(<Home />);
      fireEvent.press(getByLabelText("Open settings"));
      expect(mockPush).toHaveBeenCalledWith("/Settings");
    });
```
(The existing "navigates to tomorrow prayer details" test is unchanged and must still pass.)

- [ ] **Step 2: Run it, verify it fails** — Run: `npm test -- --runTestsByPath __tests__/screens/screen-contracts.test.tsx`
Expected: FAIL — Home still renders "Prayer Times" and has no "Open settings" gear yet.

- [ ] **Step 3: Replace `app/(tabs)/index.tsx`** with the restyled screen (logic block unchanged from the current file; presentation rebuilt on the new primitives):

```tsx
// app/(tabs)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline, LargeTitle, Title2 } from "@/components/ui/Text";
import Screen from "@/components/ui/Screen";
import { BREATH_HALF_CYCLE } from "@/constants/motion";
import { getGreeting } from "@/utils/greeting";
import DuaCard from "../../components/DuaCard";
import DuaResultCard from "../../components/DuaResultCard";
import PrayerTimesList from "../../components/PrayerTimesList";
import PressableScale from "../../components/PressableScale";
import { useDuaInteraction } from "../../hooks/useDuaInteraction";
import { useHomePrayerTimes } from "../../hooks/useHomePrayerTimes";
import { useKeyboardAutoScroll } from "../../hooks/useKeyboardAutoScroll";
import useModalTransition from "../../hooks/useModalTransition";

export default function Home() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const router = useRouter();
  const {
    prayerTimes, nextPrayer, nextDayFajr, timeLeft,
    loading, refreshing, banner, locationLabel, refresh,
  } = useHomePrayerTimes();
  const { selectedDua, duaLoading, duaSwapAnim, submitDua, closeDua } = useDuaInteraction();
  const { scrollViewRef, keyboardHeight, onDuaSectionLayout, onScrollViewLayout } = useKeyboardAutoScroll();

  const handleSubmitDua = useCallback(async (userRequest: string) => {
    await submitDua(userRequest);
    setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 400);
  }, [submitDua, scrollViewRef]);

  const hasPrayerSummary = !!(nextPrayer || nextDayFajr);
  const { shouldRender: shouldRenderPrayerSummary, cardAnimatedStyle: prayerSummaryAnimatedStyle } =
    useModalTransition(hasPrayerSummary);

  const onRefresh = async () => { await refresh(); };

  const today = new Date();
  const greeting = getGreeting(today);
  const islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric", month: "long", year: "numeric",
  }).format(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowParam = encodeURIComponent(tomorrow.toISOString());

  // Breathing pulse on the hero badge (scale only — never animate opacity of glass; spec §10).
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: BREATH_HALF_CYCLE, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: BREATH_HALF_CYCLE, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  const duaCardAnimatedStyle = {
    opacity: duaSwapAnim,
    transform: [
      { translateY: duaSwapAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: duaSwapAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  };

  return (
    <Screen>
      <ScrollView
        ref={scrollViewRef}
        onLayout={onScrollViewLayout}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} title="Refreshing…" titleColor={colors.accent} />
        }
      >
        {!!banner && (
          <GlassSurface tier="row" radius={theme.radii.row} style={styles.bannerCard}>
            <Headline color={colors.accent}>{banner}</Headline>
          </GlassSurface>
        )}

        {/* Header: greeting + location + settings gear */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Caption color={colors.accent} style={styles.eyebrow}>{islamicDate}</Caption>
            <LargeTitle>{greeting}</LargeTitle>
            {locationLabel ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={withOpacity(colors.white, 0.6)} />
                <Headline color={withOpacity(colors.white, 0.7)} style={styles.locationText}>{locationLabel}</Headline>
              </View>
            ) : null}
          </View>
          <PressableScale
            onPress={() => router.push("/Settings")}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <GlassSurface tier="chrome" radius={22} style={styles.gear}>
              <Ionicons name="settings-outline" size={20} color={withOpacity(colors.white, 0.85)} />
            </GlassSurface>
          </PressableScale>
        </View>

        {/* Hero next-prayer card */}
        {(loading || shouldRenderPrayerSummary || hasPrayerSummary) && (
          <View style={styles.heroSlot}>
            {shouldRenderPrayerSummary ? (
              <Animated.View style={prayerSummaryAnimatedStyle}>
                {nextPrayer ? (
                  <GlassSurface tier="card" radius={theme.radii.heroLg} style={styles.heroCard}>
                    <View style={styles.heroTextCol}>
                      <Caption color={withOpacity(colors.white, 0.55)} style={styles.heroLabel}>UP NEXT</Caption>
                      <Title2>{nextPrayer.label}</Title2>
                      <Headline color={colors.accent}>{nextPrayer.time}</Headline>
                    </View>
                    <Animated.View style={[styles.heroBadge, { transform: [{ scale: breathScale }] }]}>
                      <Caption color={colors.onAccent} style={styles.heroBadgeText}>in {timeLeft}</Caption>
                    </Animated.View>
                  </GlassSurface>
                ) : nextDayFajr ? (
                  <PressableScale
                    onPress={() =>
                      router.push({
                        pathname: "../[date]",
                        params: { date: tomorrowParam, month: tomorrow.getMonth().toString(), year: tomorrow.getFullYear().toString() },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel="View tomorrow prayer times"
                  >
                    <GlassSurface tier="card" radius={theme.radii.heroLg} style={styles.heroCard}>
                      <View style={styles.heroTextCol}>
                        <Title2 color={colors.accent}>Finished all prayers!</Title2>
                        <Headline color={withOpacity(colors.white, 0.85)}>Tap to see tomorrow&apos;s prayer times</Headline>
                      </View>
                    </GlassSurface>
                  </PressableScale>
                ) : null}
              </Animated.View>
            ) : null}
          </View>
        )}

        {/* Prayer list (glass container) */}
        <GlassSurface tier="card" radius={theme.radii.cardLg} style={styles.listCard}>
          <PrayerTimesList loading={loading} prayerTimes={prayerTimes} />
        </GlassSurface>

        {/* Dua section (logic unchanged) */}
        <View style={styles.duaSection} onLayout={onDuaSectionLayout}>
          <Animated.View style={duaCardAnimatedStyle}>
            {selectedDua ? <DuaResultCard dua={selectedDua} onClose={closeDua} /> : <DuaCard onSubmit={handleSubmitDua} loading={duaLoading} />}
          </Animated.View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    scrollContent: { padding: spacing.xl, paddingBottom: 120 },
    bannerCard: { padding: spacing.md, marginBottom: spacing.lg },
    headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: spacing.sm },
    headerText: { flex: 1, paddingRight: spacing.md },
    eyebrow: { letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.xs },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.sm },
    locationText: {},
    gear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    heroSlot: { marginTop: spacing.xl },
    heroCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: spacing.xl,
      shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 12 },
    },
    heroTextCol: { gap: 4 },
    heroLabel: { letterSpacing: 0.5 },
    heroBadge: {
      backgroundColor: colors.accent, borderRadius: theme.radii.pill,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center",
    },
    heroBadgeText: { fontFamily: "SFProDisplay-Bold" },
    listCard: { marginTop: spacing.lg, padding: spacing.lg, minHeight: 320, justifyContent: "center" },
    duaSection: { position: "relative", marginTop: spacing.lg },
  });
};
```

- [ ] **Step 4: Run the screen-contracts suite, verify PASS** — Run: `npm test -- --runTestsByPath __tests__/screens/screen-contracts.test.tsx`
Expected: PASS (location, "Dhuhr", DuaCardMock, list count, gear present; gear routes to `/Settings`; tomorrow-completion branch still works).

- [ ] **Step 5: Typecheck + lint** — Run: `npm run typecheck && npm run lint` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/index.tsx" __tests__/screens/screen-contracts.test.tsx
git commit -m "feat(home): restyle Home with greeting, header gear, glass hero + list"
```

---

### Task 14: Docs + full verify + device QA

**Files:**
- Modify: `frontend/__tests__/README.md`

- [ ] **Step 1: Document new suites** — add entries to `__tests__/README.md` for: `utils/greeting.test.ts`, `constants/motion.test.ts`, `hooks/useHaptics.test.ts`, `components/glass-surface.contract.test.tsx`, `components/ui-text.contract.test.tsx`, `navigation/glass-tab-bar.contract.test.tsx`. Match the file's existing format.

- [ ] **Step 2: Full verify** — Run: `npm run verify`
Expected: lint + typecheck + all jest suites PASS.

- [ ] **Step 3: On-device QA (manual — REQUIRED, cannot be automated; spec §10/§11).** Build a dev client (`npx expo run:ios` on an iOS 26 device/sim with Xcode 26) and confirm:
  - Glass tab bar + Home hero/gear render as real Liquid Glass on iOS 26; the breathing badge pulses smoothly; no glass "disappears" (opacity bug).
  - On an older iOS sim and on Android, the fallback solid surfaces render with correct contrast (no transparent/broken chrome).
  - Tab switching cross-fades; tapping a tab gives a selection haptic; the gear opens Settings.
  - **Do not validate the glass look in Expo Go** (spec §10 — Expo Go ≠ device build).

- [ ] **Step 4: Commit**

```bash
git add __tests__/README.md
git commit -m "docs(tests): list Plan 1 visual-refresh suites"
```

---

## Self-Review

**1. Spec coverage (phases 1–3):**
- §4.1 default palette refresh → Task 4. (B/light full refresh correctly deferred.)
- §4.2 type ramp → Task 4 (`type`) + Task 7 (typed Text). (Old numeric `typography` kept for back-compat — documented.)
- §4.3 materials/glass tiers → Task 4 (`buildMaterials`) + Task 5 (`GlassSurface`).
- §4.4 continuous corners → `borderCurve: "continuous"` in GlassSurface; `radii` in Task 4.
- §4.5 spacing → Task 4.
- §4.6 motion → Task 3 (constants) + Task 13 (breathing) + Task 11/12 (transitions). Reanimated shared-element deferred — documented.
- §4.7 haptics → Task 6 + used in GlassTabBar/Home.
- §4.8 icons → Ionicons retained; SF Symbols deferred — documented.
- §5.4 navigation (5 tabs, Settings→gear) → Tasks 10–13.
- §5.5 native/config → Task 9.
- Home (§6) → Task 13.

**2. Placeholder scan:** none — every code/test step shows complete content; no "TBD/handle edge cases/similar to".

**3. Type consistency:** `GlassSurface` `tier` ∈ {chrome,card,row} matches `Materials` keys; `TypeStyleName` used by both `theme.type` and `Text.tsx`; `HapticEvent` matches `useHaptics` switch; route names match across `_layout`, `GlassTabBar`, and both nav contract tests (`index,Quran,Qibla,Mosques,Calendar,Settings`); `BREATH_HALF_CYCLE` defined in Task 3, used in Task 13.

**Scoping deviations from spec (intentional, documented):** Ionicons instead of SF Symbols; RN Animated instead of Reanimated; `PrayerTimesList` row-level active-highlight deferred (Home hero carries the next-prayer emphasis); old numeric `typography` kept alongside new `type` ramp until later plans migrate screens. None block a shippable, coherent Home + nav slice.
