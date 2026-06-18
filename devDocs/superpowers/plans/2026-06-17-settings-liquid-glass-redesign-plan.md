# Settings Liquid-Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Settings screen and the components it owns onto the established liquid-glass design language, replacing bad interaction patterns (dropdown library, fake notification switch, no close affordance, missing About content) with real fixes.

**Architecture:** Introduce small, focused settings primitives (`SettingsSection`, `SettingsRow`, `ThemePicker`, `PickerDialog`) plus an isolated `utils/appLinks.ts` for About-row actions. The Settings screen composes them on the shared `Screen` scaffold. One shared glass `PickerDialog` replaces both `react-native-dropdown-picker` (method) and the hand-rolled `CitySearchModal` (city). `NotificationSettings` is restyled in place and its fake master Switch becomes an informational row. All prayer/permission/notification/app-icon logic is preserved unchanged.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript. Tests: Jest (`jest-expo` preset) + `@testing-library/react-native`. Icons: `@expo/vector-icons` (Ionicons). Glass: `expo-glass-effect` via `GlassSurface`.

## Global Constraints

- Imports use the `@/` path alias (maps to `frontend/` root). Run all commands from `frontend/`.
- All themed UI uses `useTheme()` + `createStyles(theme)`; colors via theme tokens + `withOpacity(hex, alpha)`. Never static color constants.
- All glass via `GlassSurface` (tiers `chrome`/`card`/`row`). Never hand-roll glass. **Never animate the opacity of a `GlassView`/glass parent** (stops it rendering).
- Text via the ramp components in `@/components/ui/Text` (`LargeTitle`, `Title3`, `Headline`, `Body`, `Caption`, `Footnote`, …). No ad-hoc `fontSize`.
- Press feedback via `@/components/PressableScale`; haptics via `@/hooks/useHaptics` (`"selection"` for taps/selects, `"light"` for the location toggle).
- Settings is a modal route (`app/_layout.tsx`: `presentation: "modal"`, `headerShown: false`). Keep that registration unchanged.
- **Preserve verbatim** (asserted by `__tests__/screens/screen-contracts.test.tsx`): the title text `Settings`; the location row `accessibilityLabel="Use my location"` as a `Switch` that emits `valueChange`; the granted-location subtitle `Using live location. Turn this off to choose a fixed city.`; the denied subtitle `Enable to use your current location. Turn off for manual city mode.`
- **Preserve verbatim** (asserted by `__tests__/components/notification-settings.contract.test.tsx`): master control `accessibilityLabel="Open system settings to change notifications"`; prayer row labels `"<Prayer> alert"`; sound option labels `"System default sound option"` / `"Adhan sound option"`; `"Preview Adhan"`.
- Do not change: `usePrayerSettingsState`, `useSettingsPermissions`, `services/appIcon`, notification scheduling/preferences logic, AsyncStorage keys, calculation-method ids (`-1 = Auto`).
- External values (final): App Store ID `6753838183`; website `https://sirat.dev`; privacy `https://sirat.dev/privacy`; feedback email `yassinbenelhajlahsen@gmail.com`.
- After each task: `npm run verify` should stay green by the end of the plan. Frontend Jest uses Babel (no `--experimental-vm-modules`); use static imports + top-level `jest.mock()`.

## File Structure

**Create**
- `frontend/utils/appLinks.ts` — version string + About-row actions (Linking/Share/Constants). Pure, isolated, unit-tested.
- `frontend/components/settings/SettingsSection.tsx` — section label + glass card group.
- `frontend/components/settings/SettingsRow.tsx` — generic row (icon tile, title/subtitle, trailing slot, optional press+haptics).
- `frontend/components/settings/ThemePicker.tsx` — 3-up theme swatch picker.
- `frontend/components/settings/PickerDialog.tsx` — shared glass centered picker (optional search, checkable list). Engine for method + city.
- Tests for each of the above under `frontend/__tests__/...`.

**Modify**
- `frontend/app/Settings.tsx` — full rebuild on `Screen` + the new primitives.
- `frontend/components/NotificationSettings.tsx` + `frontend/utils/notifications/styles.ts` — restyle to grouped glass + reframe master row.
- `frontend/__tests__/components/notification-settings.contract.test.tsx` — master control is now a button row.
- `frontend/__tests__/screens/screen-contracts.test.tsx` — drop dropdown/CitySearchModal/useSettingsDropdowns mocks; stub `PickerDialog`.
- `frontend/package.json` — remove `react-native-dropdown-picker`.
- `frontend/__tests__/README.md` — note suite changes.

**Delete**
- `frontend/components/CitySearchModal.tsx` — replaced by `PickerDialog`.
- `frontend/hooks/useSettingsDropdowns.ts` — dropdown state no longer needed.

---

### Task 1: `utils/appLinks.ts` (About-row actions + version)

**Files:**
- Create: `frontend/utils/appLinks.ts`
- Test: `frontend/__tests__/utils/appLinks.test.ts`

**Interfaces:**
- Consumes: `expo-constants`, react-native `Linking` + `Share`.
- Produces:
  - `getAppVersion(): string`
  - `openWebsite(): Promise<void>`
  - `openPrivacy(): Promise<void>`
  - `shareApp(): Promise<void>`
  - `sendFeedback(): Promise<void>`
  - `rateApp(): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/utils/appLinks.test.ts
import { Linking, Share } from "react-native";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.3" } },
}));

import {
  getAppVersion,
  openWebsite,
  openPrivacy,
  shareApp,
  sendFeedback,
  rateApp,
} from "@/utils/appLinks";

describe("appLinks", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the app version from expo config", () => {
    expect(getAppVersion()).toBe("1.2.3");
  });

  it("opens the website", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await openWebsite();
    expect(spy).toHaveBeenCalledWith("https://sirat.dev");
  });

  it("opens the privacy policy", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await openPrivacy();
    expect(spy).toHaveBeenCalledWith("https://sirat.dev/privacy");
  });

  it("shares the app with the store url", async () => {
    const spy = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: "sharedAction" } as never);
    await shareApp();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        url: "https://apps.apple.com/app/id6753838183",
      }),
    );
  });

  it("opens a mailto for feedback", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await sendFeedback();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatch(
      /^mailto:yassinbenelhajlahsen@gmail\.com\?subject=/,
    );
  });

  it("opens the App Store review deep link", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await rateApp();
    expect(spy).toHaveBeenCalledWith(
      "itms-apps://apps.apple.com/app/id6753838183?action=write-review",
    );
  });

  it("never throws when a link fails", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));
    await expect(openWebsite()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/utils/appLinks.test.ts`
Expected: FAIL — cannot find module `@/utils/appLinks`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/utils/appLinks.ts
import Constants from "expo-constants";
import { Linking, Share } from "react-native";

const APP_STORE_ID = "6753838183";

export const APP_LINKS = {
  website: "https://sirat.dev",
  privacy: "https://sirat.dev/privacy",
  feedbackEmail: "yassinbenelhajlahsen@gmail.com",
  appStoreUrl: `https://apps.apple.com/app/id${APP_STORE_ID}`,
  reviewUrl: `itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
} as const;

async function open(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // best-effort: never surface a link failure to the UI
  }
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "—";
}

export function openWebsite(): Promise<void> {
  return open(APP_LINKS.website);
}

export function openPrivacy(): Promise<void> {
  return open(APP_LINKS.privacy);
}

export async function shareApp(): Promise<void> {
  try {
    await Share.share({
      message:
        "Sirat — your companion for prayer, Qur'an, qibla and more. https://sirat.dev",
      url: APP_LINKS.appStoreUrl,
    });
  } catch {
    // user cancelled or share unavailable — ignore
  }
}

export function sendFeedback(): Promise<void> {
  const subject = encodeURIComponent("Sirat Feedback");
  return open(`mailto:${APP_LINKS.feedbackEmail}?subject=${subject}`);
}

export function rateApp(): Promise<void> {
  return open(APP_LINKS.reviewUrl);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/utils/appLinks.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add utils/appLinks.ts __tests__/utils/appLinks.test.ts
git commit -m "feat(settings): add appLinks helper for about-row actions"
```

---

### Task 2: `SettingsSection` (label + glass card group)

**Files:**
- Create: `frontend/components/settings/SettingsSection.tsx`
- Test: `frontend/__tests__/components/settings-section.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `GlassSurface`, `Caption`.
- Produces: `default SettingsSection(props: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> })`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/settings-section.test.tsx
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import SettingsSection from "@/components/settings/SettingsSection";

describe("SettingsSection", () => {
  it("renders an uppercased label and its children", () => {
    const { getByText } = render(
      <SettingsSection label="Appearance">
        <Text>child-content</Text>
      </SettingsSection>,
    );
    expect(getByText("APPEARANCE")).toBeTruthy();
    expect(getByText("child-content")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/settings-section.test.tsx`
Expected: FAIL — cannot find module `@/components/settings/SettingsSection`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/components/settings/SettingsSection.tsx
import { ReactNode, useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SettingsSection({ label, children, style }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.wrap, style]}>
      <Caption color={withOpacity(theme.colors.accent, 0.95)} style={styles.label}>
        {label.toUpperCase()}
      </Caption>
      <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
        {children}
      </GlassSurface>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { marginTop: theme.spacing.xl },
    label: {
      letterSpacing: 1,
      marginLeft: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    card: { overflow: "hidden" },
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/settings-section.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/settings/SettingsSection.tsx __tests__/components/settings-section.test.tsx
git commit -m "feat(settings): add SettingsSection glass group"
```

---

### Task 3: `SettingsRow` (generic settings row)

**Files:**
- Create: `frontend/components/settings/SettingsRow.tsx`
- Test: `frontend/__tests__/components/settings-row.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useHaptics`, `PressableScale`, `Ionicons`, `Body`, `Subhead`, `Footnote`.
- Produces:
```ts
type SettingsRowProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;       // overrides value/chevron when provided
  showChevron?: boolean;
  onPress?: () => void;       // wraps row in PressableScale + haptics("selection")
  disabled?: boolean;
  first?: boolean;            // suppress the top hairline divider
  accessibilityLabel?: string;
};
export default function SettingsRow(props: SettingsRowProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/settings-row.test.tsx
import { fireEvent, render } from "@testing-library/react-native";

const mockHaptic = jest.fn();

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});
jest.mock("@/hooks/useHaptics", () => ({ useHaptics: () => mockHaptic }));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import SettingsRow from "@/components/settings/SettingsRow";

describe("SettingsRow", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders title, subtitle, value and icon", () => {
    const { getByText } = render(
      <SettingsRow
        icon="compass-outline"
        title="Calculation Method"
        subtitle="How timings are computed"
        value="Auto"
      />,
    );
    expect(getByText("Calculation Method")).toBeTruthy();
    expect(getByText("How timings are computed")).toBeTruthy();
    expect(getByText("Auto")).toBeTruthy();
    expect(getByText("icon:compass-outline")).toBeTruthy();
  });

  it("fires onPress and a selection haptic when pressed", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <SettingsRow icon="star-outline" title="Rate Sirat" onPress={onPress} />,
    );
    fireEvent.press(getByLabelText("Rate Sirat"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockHaptic).toHaveBeenCalledWith("selection");
  });

  it("does not fire when disabled", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <SettingsRow
        icon="star-outline"
        title="Rate Sirat"
        onPress={onPress}
        disabled
      />,
    );
    fireEvent.press(getByLabelText("Rate Sirat"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/settings-row.test.tsx`
Expected: FAIL — cannot find module `@/components/settings/SettingsRow`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/components/settings/SettingsRow.tsx
import { ComponentProps, ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import PressableScale from "@/components/PressableScale";
import { Body, Footnote, Subhead } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

type SettingsRowProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  first?: boolean;
  accessibilityLabel?: string;
};

export default function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  trailing,
  showChevron,
  onPress,
  disabled,
  first,
  accessibilityLabel,
}: SettingsRowProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const haptics = useHaptics();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const content = (
    <View style={[styles.row, !first && styles.divider, disabled && styles.disabled]}>
      <View style={styles.iconTile}>
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.textBlock}>
        <Body color={colors.white}>{title}</Body>
        {subtitle ? (
          <Footnote color={withOpacity(colors.white, 0.55)} style={styles.subtitle}>
            {subtitle}
          </Footnote>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {trailing ??
          (value ? (
            <Subhead color={withOpacity(colors.white, 0.55)}>{value}</Subhead>
          ) : null)}
        {showChevron ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={withOpacity(colors.white, 0.35)}
            style={styles.chevron}
          />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableScale
      scaleTo={0.98}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={() => {
        if (disabled) return;
        haptics("selection");
        onPress();
      }}
    >
      {content}
    </PressableScale>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(colors.white, 0.08),
    },
    disabled: { opacity: 0.5 },
    iconTile: {
      width: 30,
      height: 30,
      borderRadius: 9,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.accent, 0.14),
    },
    textBlock: { flex: 1, minWidth: 0 },
    subtitle: { marginTop: 2 },
    trailing: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    chevron: { marginLeft: 2 },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/settings-row.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/settings/SettingsRow.tsx __tests__/components/settings-row.test.tsx
git commit -m "feat(settings): add SettingsRow primitive"
```

---

### Task 4: `ThemePicker` (visual swatch theme selector)

**Files:**
- Create: `frontend/components/settings/ThemePicker.tsx`
- Test: `frontend/__tests__/components/theme-picker.test.tsx`

**Interfaces:**
- Consumes: `useTheme` (`themeName`, `setTheme`), `useHaptics`, `themeMap`, `PressableScale`, `LinearGradient`, `Caption`.
- Produces: `default ThemePicker()` — no props.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/theme-picker.test.tsx
import { fireEvent, render } from "@testing-library/react-native";

const mockHaptic = jest.fn();
const mockSetTheme = jest.fn();

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({
      theme: defaultTheme,
      themeName: "default",
      setTheme: mockSetTheme,
    }),
  };
});
jest.mock("@/hooks/useHaptics", () => ({ useHaptics: () => mockHaptic }));
jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

import ThemePicker from "@/components/settings/ThemePicker";

describe("ThemePicker", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the three themes", () => {
    const { getByLabelText } = render(<ThemePicker />);
    expect(getByLabelText("Default theme")).toBeTruthy();
    expect(getByLabelText("Dark theme")).toBeTruthy();
    expect(getByLabelText("Light theme")).toBeTruthy();
  });

  it("selecting a non-active theme calls setTheme with a haptic", () => {
    const { getByLabelText } = render(<ThemePicker />);
    fireEvent.press(getByLabelText("Dark theme"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(mockHaptic).toHaveBeenCalledWith("selection");
  });

  it("re-selecting the active theme is a no-op", () => {
    const { getByLabelText } = render(<ThemePicker />);
    fireEvent.press(getByLabelText("Default theme"));
    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it("marks the active theme via accessibility state", () => {
    const { getByLabelText } = render(<ThemePicker />);
    expect(getByLabelText("Default theme").props.accessibilityState.selected).toBe(true);
    expect(getByLabelText("Dark theme").props.accessibilityState.selected).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/theme-picker.test.tsx`
Expected: FAIL — cannot find module `@/components/settings/ThemePicker`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/components/settings/ThemePicker.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import PressableScale from "@/components/PressableScale";
import { Caption } from "@/components/ui/Text";
import {
  themeMap,
  withOpacity,
  type AppTheme,
  type ThemeName,
} from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

const THEMES: { name: ThemeName; label: string }[] = [
  { name: "default", label: "Default" },
  { name: "dark", label: "Dark" },
  { name: "light", label: "Light" },
];

export default function ThemePicker() {
  const { theme, themeName, setTheme } = useTheme();
  const haptics = useHaptics();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {THEMES.map((t) => {
        const active = themeName === t.name;
        const palette = themeMap[t.name].colors;
        return (
          <PressableScale
            key={t.name}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${t.label} theme`}
            onPress={() => {
              if (active) return;
              haptics("selection");
              void setTheme(t.name);
            }}
            style={[styles.card, active && styles.cardActive]}
          >
            <LinearGradient
              colors={[palette.primaryDeep, palette.primaryLift]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.swatch}
            >
              <View style={[styles.dot, { backgroundColor: palette.accent }]} />
            </LinearGradient>
            <Caption color={active ? theme.colors.accent : theme.colors.white}>
              {t.label}
            </Caption>
          </PressableScale>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
    card: {
      flex: 1,
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      borderWidth: 1.5,
      borderColor: withOpacity(colors.white, 0.1),
      backgroundColor: withOpacity(colors.white, 0.04),
    },
    cardActive: {
      borderColor: colors.accent,
      backgroundColor: withOpacity(colors.accent, 0.1),
    },
    swatch: {
      width: "100%",
      height: 54,
      borderRadius: theme.radii.chip,
      borderCurve: "continuous",
      overflow: "hidden",
      justifyContent: "flex-end",
      alignItems: "flex-end",
      padding: 7,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: withOpacity(colors.white, 0.6),
    },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/theme-picker.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/settings/ThemePicker.tsx __tests__/components/theme-picker.test.tsx
git commit -m "feat(settings): add ThemePicker swatch selector"
```

---

### Task 5: `PickerDialog` (shared glass picker for method + city)

**Files:**
- Create: `frontend/components/settings/PickerDialog.tsx`
- Test: `frontend/__tests__/components/picker-dialog.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useHaptics`, `GlassSurface`, `Ionicons`, `Title3`, `Footnote`, `Body`.
- Produces:
```ts
export type PickerItem<T extends string | number> = { label: string; value: T };
type PickerDialogProps<T extends string | number> = {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: PickerItem<T>[];
  selected?: T;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: T) => void;
  onClose: () => void;
};
export default function PickerDialog<T extends string | number>(props): JSX.Element | null;
```

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/picker-dialog.test.tsx
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockHaptic = jest.fn();

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});
jest.mock("@/hooks/useHaptics", () => ({ useHaptics: () => mockHaptic }));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import PickerDialog from "@/components/settings/PickerDialog";

const items = [
  { label: "Auto", value: -1 },
  { label: "Muslim World League (MWL)", value: 4 },
];

describe("PickerDialog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the title and items when visible", () => {
    const { getByText } = render(
      <PickerDialog
        visible
        title="Calculation Method"
        items={items}
        selected={-1}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText("Calculation Method")).toBeTruthy();
    expect(getByText("Auto")).toBeTruthy();
    expect(getByText("Muslim World League (MWL)")).toBeTruthy();
  });

  it("selecting an item fires onSelect with a haptic", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <PickerDialog
        visible
        title="Calculation Method"
        items={items}
        selected={-1}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    fireEvent.press(getByText("Muslim World League (MWL)"));
    expect(onSelect).toHaveBeenCalledWith(4);
    expect(mockHaptic).toHaveBeenCalledWith("selection");
  });

  it("hides the search field unless searchable", () => {
    const { queryByPlaceholderText } = render(
      <PickerDialog
        visible
        title="Calculation Method"
        items={items}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(queryByPlaceholderText("Search")).toBeNull();
  });

  it("filters items when searchable", async () => {
    const { getByPlaceholderText, queryByText } = render(
      <PickerDialog
        visible
        searchable
        title="Select city"
        items={[
          { label: "Mecca", value: "mecca" },
          { label: "Cairo", value: "cairo" },
        ]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    fireEvent.changeText(getByPlaceholderText("Search"), "cai");
    await waitFor(() => {
      expect(queryByText("Mecca")).toBeNull();
      expect(queryByText("Cairo")).toBeTruthy();
    });
  });

  it("returns null when not visible", () => {
    const { toJSON } = render(
      <PickerDialog
        visible={false}
        title="X"
        items={items}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/picker-dialog.test.tsx`
Expected: FAIL — cannot find module `@/components/settings/PickerDialog`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/components/settings/PickerDialog.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import GlassSurface from "@/components/ui/GlassSurface";
import { Body, Footnote, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

export type PickerItem<T extends string | number> = { label: string; value: T };

type Props<T extends string | number> = {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: PickerItem<T>[];
  selected?: T;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: T) => void;
  onClose: () => void;
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => setInset(e.endCoordinates?.height ?? 0);
    const onHide = () => setInset(0);
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s.remove();
      h.remove();
    };
  }, []);
  return inset;
}

function useDebounced<T>(value: T, delay = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function PickerDialog<T extends string | number>({
  visible,
  title,
  subtitle,
  items,
  selected,
  searchable = false,
  searchPlaceholder = "Search",
  onSelect,
  onClose,
}: Props<T>) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const haptics = useHaptics();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomInset = useKeyboardInset();

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 150);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, debounced]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.cardWrap, { marginBottom: bottomInset > 0 ? bottomInset * 0.4 : 0 }]}
          onPress={() => {}}
        >
          <GlassSurface tier="card" radius={theme.radii.cardLg} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Title3 color={colors.white}>{title}</Title3>
                {subtitle ? (
                  <Footnote color={withOpacity(colors.white, 0.6)} style={styles.subtitle}>
                    {subtitle}
                  </Footnote>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={withOpacity(colors.white, 0.7)} />
              </Pressable>
            </View>

            {searchable ? (
              <View style={styles.search}>
                <Ionicons name="search" size={18} color={withOpacity(colors.white, 0.5)} />
                <TextInput
                  ref={inputRef}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={withOpacity(colors.white, 0.5)}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={styles.searchInput}
                />
              </View>
            ) : null}

            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = item.value === selected;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      haptics("selection");
                      onSelect(item.value);
                    }}
                    style={({ pressed }) => [
                      styles.itemRow,
                      pressed && styles.itemPressed,
                    ]}
                  >
                    <Body color={isSelected ? colors.accent : colors.white}>
                      {item.label}
                    </Body>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={20} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: withOpacity(colors.black, 0.55),
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    cardWrap: { width: "100%", alignItems: "center" },
    card: { width: "100%", maxWidth: 480, maxHeight: Math.round(SCREEN_HEIGHT * 0.7) },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerText: { flex: 1, paddingRight: spacing.md },
    subtitle: { marginTop: 4 },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(colors.white, 0.12),
      backgroundColor: withOpacity(colors.white, 0.05),
    },
    searchInput: {
      flex: 1,
      color: colors.white,
      fontSize: 15,
      fontFamily: "SFProDisplay-Regular",
      paddingVertical: 4,
    },
    list: { flexGrow: 0 },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    itemPressed: { backgroundColor: withOpacity(colors.white, 0.06) },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: spacing.xl,
      backgroundColor: withOpacity(colors.white, 0.08),
    },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/picker-dialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/settings/PickerDialog.tsx __tests__/components/picker-dialog.test.tsx
git commit -m "feat(settings): add shared glass PickerDialog"
```

---

### Task 6: Restyle `NotificationSettings` + reframe master row

**Files:**
- Modify: `frontend/components/NotificationSettings.tsx`
- Modify: `frontend/utils/notifications/styles.ts`
- Modify: `frontend/__tests__/components/notification-settings.contract.test.tsx`

**Interfaces:**
- Consumes: `GlassSurface`, the existing notification hooks (unchanged).
- Produces: same default export `NotificationSettings`; master control becomes a `Pressable` button row (was a `Switch`).

- [ ] **Step 1: Update the contract test for the reframed master row (failing)**

In `frontend/__tests__/components/notification-settings.contract.test.tsx`, replace the test body of `"opens OS settings when the master toggle is used"` (the block that uses `fireEvent(..., "valueChange", false)`) with a press-based version:

```tsx
  it("opens OS settings when the master row is pressed", async () => {
    const openSettingsSpy = jest
      .spyOn(Linking, "openSettings")
      .mockResolvedValueOnce(undefined);
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />
    );

    fireEvent.press(
      getByLabelText("Open system settings to change notifications")
    );

    expect(pulseHeader).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(openSettingsSpy).toHaveBeenCalledTimes(1));
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/notification-settings.contract.test.tsx -t "opens OS settings"`
Expected: FAIL — `fireEvent.press` finds the element but the current `Switch` only handles `valueChange`, so `pulseHeader`/`openSettings` are not called.

- [ ] **Step 3: Reframe the master control in `NotificationSettings.tsx`**

Replace the master `Switch` block (the `{!loaded ? <ActivityIndicator/> : <Switch .../>}` inside the header `Animated.View`) with a pressable status row. Find this JSX:

```tsx
        {!loaded ? (
          <ActivityIndicator size="small" color={accentColor} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={async () => {
              // Do not flip locally. Always guide user to system settings.
              pulseHeader();
              try {
                await Linking.openSettings();
              } catch {
                // ignore
              }
            }}
            trackColor={{
              false: themeColors.grayDark,
              true: theme.name === "light" ? "#DABA69" : themeColors.accent,
            }}
            thumbColor={enabled ? "#FFFFFF" : themeColors.grayMuted}
            ios_backgroundColor={dividerColor}
            accessibilityLabel="Open system settings to change notifications"
          />
        )}
```

Replace it with:

```tsx
        {!loaded ? (
          <ActivityIndicator size="small" color={accentColor} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open system settings to change notifications"
            onPress={async () => {
              pulseHeader();
              try {
                await Linking.openSettings();
              } catch {
                // ignore
              }
            }}
            style={({ pressed }) => [
              styles.masterControl,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.masterStatus, { color: withOpacity(textColor, 0.6) }]}>
              {enabled ? "On" : "Off"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={withOpacity(textColor, 0.4)}
            />
          </Pressable>
        )}
```

Then update the header subtitle copy so the row reads as managed externally — change:

```tsx
            Controlled by your system settings.
```
to:
```tsx
            Managed in System Settings.
```

(`Pressable`, `Text`, and `Ionicons` are already imported; `Switch` import can be removed if now unused — verify and remove from the import list.)

- [ ] **Step 4: Add the master-row styles + glass grouping in `utils/notifications/styles.ts`**

Add these two styles to the `StyleSheet.create({ ... })` object (anywhere in the map):

```ts
    masterControl: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    masterStatus: {
      fontSize: 14,
      fontFamily: "SFProDisplay-Semibold",
    },
```

Then group the block as a glass card to match the other sections. In `NotificationSettings.tsx`, wrap the existing inner content of the reveal `Animated.View` (the `prayerSectionHeader` + prayer rows + `soundCard`) so the section reads as one card. Minimal approach that preserves the reveal animation: change the `cardContainer` style to carry the glass look by setting its background/border to the card material. Replace the `cardContainer` style with:

```ts
    cardContainer: {
      marginTop: 14,
      marginHorizontal: 20,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: theme.radii.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.materials.card.border,
      backgroundColor: theme.materials.card.fill,
      overflow: "hidden",
    },
```

(This keeps the `maxHeight` reveal animation intact — it animates the wrapper's height, not a `GlassView` opacity — while giving the grouped-card appearance consistent with `SettingsSection`.)

- [ ] **Step 5: Run the notification contract suite**

Run: `npm test -- --runTestsByPath __tests__/components/notification-settings.contract.test.tsx`
Expected: PASS (all 5 tests, including the reframed master-row test and the unchanged loading/prayer/sound tests).

- [ ] **Step 6: Commit**

```bash
git add components/NotificationSettings.tsx utils/notifications/styles.ts __tests__/components/notification-settings.contract.test.tsx
git commit -m "feat(settings): reframe notifications master row + glass grouping"
```

---

### Task 7: Rebuild `app/Settings.tsx` and remove dead pieces

**Files:**
- Modify (full rewrite): `frontend/app/Settings.tsx`
- Delete: `frontend/components/CitySearchModal.tsx`
- Delete: `frontend/hooks/useSettingsDropdowns.ts`
- Modify: `frontend/__tests__/screens/screen-contracts.test.tsx`

**Interfaces:**
- Consumes: `Screen`, `GlassSurface`, Text ramp, `PressableScale`, `SettingsSection`, `SettingsRow`, `ThemePicker`, `PickerDialog`, `NotificationSettings`, `usePrayerSettingsState`, `useSettingsPermissions`, `useTheme`, `useHaptics`, `appLinks`, `CALCULATION_METHODS`, `services/appIcon`.
- Produces: default `Settings` screen (route `/Settings`).

- [ ] **Step 1: Update `screen-contracts.test.tsx` mocks (will fail until rewrite lands)**

Make these edits in `frontend/__tests__/screens/screen-contracts.test.tsx`:

1. **Delete** the `react-native-dropdown-picker` mock block:
```tsx
jest.mock("react-native-dropdown-picker", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function DropDownPickerMock({ value }: { value?: string | number | null }) {
    return <Text testID="dropdown-picker">{String(value ?? "")}</Text>;
  };
});
```

2. **Delete** the `@/components/CitySearchModal` mock block:
```tsx
jest.mock("@/components/CitySearchModal", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function CitySearchModalMock({ visible }: { visible: boolean }) {
    return <Text>CitySearchModal:{visible ? "open" : "closed"}</Text>;
  };
});
```

3. **Delete** the `@/hooks/useSettingsDropdowns` mock block:
```tsx
jest.mock("@/hooks/useSettingsDropdowns", () => ({
  useSettingsDropdowns: jest.fn(),
}));
```

4. **Add** a stub mock for the new `PickerDialog` (place near the other component mocks):
```tsx
jest.mock("@/components/settings/PickerDialog", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View /> };
});
```

5. **Delete** the import line and the typed handle for `useSettingsDropdowns`:
```tsx
import { useSettingsDropdowns } from "@/hooks/useSettingsDropdowns";
```
```tsx
const mockUseSettingsDropdowns =
  useSettingsDropdowns as jest.MockedFunction<typeof useSettingsDropdowns>;
```

6. **Delete** the `buildDropdownState` factory and its `beforeEach` wiring line:
```tsx
const buildDropdownState = (overrides: Record<string, unknown> = {}) => ({ /* ... */ });
```
```tsx
    mockUseSettingsDropdowns.mockReturnValue(buildDropdownState() as any);
```

7. **Add** `back` to the router mock so the close chip has a handler. Change:
```tsx
    mockUseRouter.mockReturnValue({
      push: mockPush,
    } as any);
```
to:
```tsx
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
    } as any);
```

The existing `Settings` describe block (asserts `Settings`, the granted subtitle, `NotificationSettings:granted`, and the `valueChange` location wiring) stays unchanged.

- [ ] **Step 2: Run the Settings contract to confirm current screen still passes (baseline)**

Run: `npm test -- --runTestsByPath __tests__/screens/screen-contracts.test.tsx -t "Settings"`
Expected: At this point it may FAIL to compile because the old `Settings.tsx` still imports `react-native-dropdown-picker`/`CitySearchModal`/`useSettingsDropdowns` while the test no longer provides their mocks (dropdown-picker is un-mocked; the real module still exists so it resolves, but `useSettingsDropdowns` now returns `undefined` → the old screen throws). This is expected — proceed to the rewrite.

- [ ] **Step 3: Rewrite `app/Settings.tsx`**

Replace the entire file with:

```tsx
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassSurface from "@/components/ui/GlassSurface";
import Screen from "@/components/ui/Screen";
import { Caption, Footnote, LargeTitle } from "@/components/ui/Text";
import PressableScale from "@/components/PressableScale";
import NotificationSettings from "@/components/NotificationSettings";
import SettingsSection from "@/components/settings/SettingsSection";
import SettingsRow from "@/components/settings/SettingsRow";
import ThemePicker from "@/components/settings/ThemePicker";
import PickerDialog from "@/components/settings/PickerDialog";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { usePrayerSettingsState } from "@/hooks/usePrayerSettingsState";
import { useSettingsPermissions } from "@/hooks/useSettingsPermissions";
import CALCULATION_METHODS from "@/utils/calculationMethods";
import {
  getAppVersion,
  openPrivacy,
  openWebsite,
  rateApp,
  sendFeedback,
  shareApp,
} from "@/utils/appLinks";
import {
  alternateIconsSupported,
  applyIconForTheme,
  getActiveIconName,
  iconNameForTheme,
} from "@/services/appIcon";

const METHOD_ITEMS = CALCULATION_METHODS.map((m) => ({
  label: m.name,
  value: m.id,
}));

export default function Settings() {
  const { theme, themeName } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const haptics = useHaptics();

  const {
    useLocation,
    setUseLocation,
    method,
    setMethod,
    city,
    cityModalVisible,
    setCityModalVisible,
    cityItems,
    selectCityByKey,
  } = usePrayerSettingsState();
  const { permissionStatus, notifStatus, handleLocationToggle } =
    useSettingsPermissions({ useLocation, setUseLocation });

  const [methodModalVisible, setMethodModalVisible] = useState(false);

  // App-icon-per-theme: only offered when the live icon doesn't match the theme.
  const [iconSupported] = useState(alternateIconsSupported);
  const [activeIcon, setActiveIcon] = useState<string | null>(getActiveIconName);
  const [applyingIcon, setApplyingIcon] = useState(false);
  const iconNeedsMatch =
    iconSupported && iconNameForTheme(themeName) !== activeIcon;

  const handleMatchIcon = async () => {
    setApplyingIcon(true);
    try {
      await applyIconForTheme(themeName);
    } catch {
      Alert.alert(
        "Couldn't change icon",
        "The app icon couldn't be updated. Please try again.",
      );
    } finally {
      setActiveIcon(getActiveIconName());
      setApplyingIcon(false);
    }
  };

  const methodLabel =
    CALCULATION_METHODS.find((m) => m.id === method)?.name ?? "Auto";
  const cityLabel = city
    ? `${city.name}${city.country ? ", " + city.country : ""}`
    : "Select city";
  const locationSubtitle =
    permissionStatus === "granted"
      ? "Using live location. Turn this off to choose a fixed city."
      : "Enable to use your current location. Turn off for manual city mode.";

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.xxxl,
          },
        ]}
      >
        <View style={styles.grabber} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Caption color={withOpacity(colors.accent, 0.95)} style={styles.eyebrow}>
              PREFERENCES
            </Caption>
            <LargeTitle>Settings</LargeTitle>
          </View>
          <PressableScale
            onPress={() => {
              haptics("selection");
              router.back();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
          >
            <GlassSurface tier="chrome" radius={22} style={styles.closeChip}>
              <Ionicons name="close" size={20} color={withOpacity(colors.white, 0.85)} />
            </GlassSurface>
          </PressableScale>
        </View>

        {/* Appearance */}
        <SettingsSection label="Appearance">
          <ThemePicker />
          {iconNeedsMatch ? (
            <SettingsRow
              icon="phone-portrait-outline"
              title="Match app icon to theme"
              subtitle="Update your Home Screen icon to fit this theme."
              onPress={handleMatchIcon}
              disabled={applyingIcon}
              accessibilityLabel="Match app icon to theme"
              trailing={
                <Caption color={colors.accent} style={styles.applyText}>
                  {applyingIcon ? "…" : "Apply"}
                </Caption>
              }
            />
          ) : null}
        </SettingsSection>

        {/* Prayer Times */}
        <SettingsSection label="Prayer Times">
          <SettingsRow
            first
            icon="compass-outline"
            title="Calculation Method"
            value={methodLabel}
            showChevron
            onPress={() => {
              haptics("selection");
              setMethodModalVisible(true);
            }}
          />
          <SettingsRow
            icon="location-outline"
            title="Use my location"
            subtitle={locationSubtitle}
            trailing={
              <Switch
                accessibilityLabel="Use my location"
                value={useLocation}
                onValueChange={(val) => {
                  haptics("light");
                  void handleLocationToggle(val);
                }}
                trackColor={{
                  false: colors.grayDark,
                  true: theme.name === "light" ? "#DABA69" : colors.accent,
                }}
                thumbColor={useLocation ? "#FFFFFF" : colors.grayMuted}
              />
            }
          />
          {!useLocation ? (
            <SettingsRow
              icon="business-outline"
              title="Manual city"
              value={cityLabel}
              showChevron
              onPress={() => {
                haptics("selection");
                setCityModalVisible(true);
              }}
            />
          ) : null}
        </SettingsSection>

        {/* Notifications (owns its own glass card) */}
        <View style={styles.notifSlot}>
          <Caption color={withOpacity(colors.accent, 0.95)} style={styles.notifLabel}>
            NOTIFICATIONS
          </Caption>
          <NotificationSettings notifStatus={notifStatus} />
        </View>

        {/* About */}
        <SettingsSection label="About">
          <SettingsRow first icon="star-outline" title="Rate Sirat" showChevron onPress={rateApp} />
          <SettingsRow icon="share-outline" title="Share Sirat" showChevron onPress={shareApp} />
          <SettingsRow icon="shield-checkmark-outline" title="Privacy Policy" showChevron onPress={openPrivacy} />
          <SettingsRow icon="mail-outline" title="Send Feedback" showChevron onPress={sendFeedback} />
          <SettingsRow
            icon="globe-outline"
            title="Visit website"
            value="sirat.dev"
            showChevron
            onPress={openWebsite}
          />
        </SettingsSection>

        <Footnote color={withOpacity(colors.white, 0.4)} style={styles.version}>
          Sirat {getAppVersion()}
        </Footnote>
      </ScrollView>

      <PickerDialog
        visible={methodModalVisible}
        title="Calculation Method"
        subtitle="Authority used to compute prayer schedules."
        items={METHOD_ITEMS}
        selected={method}
        onSelect={(value) => {
          setMethod(value);
          setMethodModalVisible(false);
        }}
        onClose={() => setMethodModalVisible(false)}
      />
      <PickerDialog
        visible={cityModalVisible}
        searchable
        title="Select city"
        subtitle="Search from the supported cities list."
        items={cityItems}
        onSelect={(value) => selectCityByKey(value)}
        onClose={() => setCityModalVisible(false)}
      />
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    content: { paddingHorizontal: spacing.xl },
    grabber: {
      width: 38,
      height: 5,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.white, 0.28),
      alignSelf: "center",
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    headerText: { flex: 1, paddingRight: spacing.md },
    eyebrow: { letterSpacing: 1.4, marginBottom: spacing.xs },
    closeChip: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    applyText: { fontFamily: "SFProDisplay-Bold" },
    notifSlot: { marginTop: spacing.xl },
    notifLabel: { letterSpacing: 1, marginLeft: spacing.xs, marginBottom: spacing.sm },
    version: { textAlign: "center", marginTop: spacing.xl },
  });
};
```

- [ ] **Step 4: Delete the now-unused files**

```bash
git rm components/CitySearchModal.tsx hooks/useSettingsDropdowns.ts
```

- [ ] **Step 5: Run the screen contract suite**

Run: `npm test -- --runTestsByPath __tests__/screens/screen-contracts.test.tsx`
Expected: PASS — all screens, including the two Settings tests (`renders settings title and notifications contract`, `routes location toggle changes through permissions hook`).

- [ ] **Step 6: Commit**

```bash
git add app/Settings.tsx __tests__/screens/screen-contracts.test.tsx
git commit -m "feat(settings): rebuild Settings on glass primitives; drop dropdown lib + CitySearchModal"
```

---

### Task 8: Remove the dropdown dependency, update docs, full verify

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/__tests__/README.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: a clean dependency tree and green `npm run verify`.

- [ ] **Step 1: Confirm there are no remaining references**

Run: `grep -rn "dropdown-picker\|DropDownPicker\|CitySearchModal\|useSettingsDropdowns" app components hooks utils __tests__`
Expected: no matches (empty output).

- [ ] **Step 2: Remove the dependency**

Run: `npm uninstall react-native-dropdown-picker`
Expected: `react-native-dropdown-picker` removed from `package.json` `dependencies` and from `package-lock.json`.

- [ ] **Step 3: Update the tests README**

In `frontend/__tests__/README.md`, add entries noting the new suites and the changed contract:
- `__tests__/utils/appLinks.test.ts` — About-row link/share/version helpers.
- `__tests__/components/settings-section.test.tsx` — SettingsSection group.
- `__tests__/components/settings-row.test.tsx` — SettingsRow press/haptic/disabled behavior.
- `__tests__/components/theme-picker.test.tsx` — ThemePicker selection + active state.
- `__tests__/components/picker-dialog.test.tsx` — shared glass picker (search/select/checkmark).
- Note that `notification-settings.contract.test.tsx` now asserts a **button** master row (press), not a Switch, and that the dropdown-picker / CitySearchModal mocks were removed from `screen-contracts.test.tsx`.

- [ ] **Step 4: Run the full verification**

Run: `npm run verify`
Expected: lint clean, `tsc --noEmit` clean, all Jest suites pass.

If `tsc` flags an unused `spacing` (or any unused import) in a touched file, remove it and re-run. If lint flags the removed `Switch` import in `NotificationSettings.tsx`, remove that import.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json __tests__/README.md
git commit -m "chore(settings): drop react-native-dropdown-picker; update test docs"
```

---

## Self-Review

**1. Spec coverage**
- §3-01 scaffold → Task 7 (`Screen safeArea={false}` + insets padding). ✓
- §3-02 grouped glass cards → Tasks 2, 7. ✓
- §3-03 theme swatch picker → Task 4. ✓
- §3-04 method picker dialog → Tasks 5, 7. ✓
- §3-05 city picker on shared dialog + drop `cityModalColors` → Tasks 5, 7 (CitySearchModal deleted; Settings calls `PickerDialog` with no colors override). ✓
- §3-06 notifications master reframe → Task 6. ✓
- §3-07 close affordance → Task 7 (glass ✕ chip → `router.back()`). ✓
- §3-08 About rows + version footer → Tasks 1, 7. ✓
- §3-09 Ionicons → Tasks 3, 4, 5, 7. ✓
- §3-10 remove dropdown dependency → Task 8. ✓
- §6 changed/removed (`useSettingsDropdowns` deleted, `CitySearchModal` deleted) → Task 7. ✓
- §7 motion/haptics (PressableScale, haptics, no glass-opacity animation) → Tasks 3, 4, 7. ✓
- §9 testing (README, notification contract, screen contract, new component tests) → Tasks 1–8. ✓
- §8 external values (App Store ID, email, privacy, website) → Task 1. ✓

**2. Placeholder scan:** No `TBD`/`TODO`/"add error handling" — every code/test step has concrete content. ✓

**3. Type consistency:** `PickerItem<T>` and `PickerDialog` prop names match between Task 5 and Task 7 usage (`visible`, `title`, `subtitle`, `items`, `selected`, `searchable`, `onSelect`, `onClose`). `SettingsRow` props used in Task 7 (`first`, `icon`, `title`, `subtitle`, `value`, `trailing`, `showChevron`, `onPress`, `disabled`, `accessibilityLabel`) all exist in Task 3. `getAppVersion`/`rateApp`/`shareApp`/`openPrivacy`/`sendFeedback`/`openWebsite` names match between Task 1 and Task 7. `method` value type is `number`; `selectCityByKey(value: string)` — `cityItems` values are `string`; `METHOD_ITEMS` values are `number`; both satisfy `PickerDialog`'s `T extends string | number`. ✓

---

## Execution Handoff

Plan complete and saved to `devDocs/superpowers/plans/2026-06-17-settings-liquid-glass-redesign-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?
