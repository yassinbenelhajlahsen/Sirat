# Quran Liquid Glass Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Quran feature into the app's Liquid Glass language — flowing reader, persistent glass header, surah banners, glass mini player, and a unified swipe-up glass sheet family — with zero behavior changes.

**Architecture:** Pure visual/UX restyle on top of existing primitives (`GlassSurface`, typed `Text`, `Screen`, `Aurora`, `motion.ts`, `useHaptics`, `@gorhom/bottom-sheet`). Two new shared components are extracted (`SheetBackground`, `SurahBanner`). All data/services/hooks/context and Arabic-rendering internals are untouched; existing contract tests are updated to the new UI and act as the regression net.

**Tech Stack:** Expo SDK 54 / React Native 0.81, Expo Router, `expo-glass-effect`, `@gorhom/bottom-sheet`, `react-native-gesture-handler`, Jest (`jest-expo`) + `@testing-library/react-native` v13.

## Global Constraints

(Every task implicitly includes these. Verbatim from the spec.)

- **No behavior, logic, audio, or Arabic-rendering changes.** Restyle only. Preserve every handler, timing, accessibility label, and state.
- **No invented content.** Use only data fields that already exist (no "Meccan", verse counts, or basmala unless already rendered).
- All themed UI uses `useTheme()` + `createStyles(theme)` — **never static color constants**. Transparency via `withOpacity(hex, alpha)`.
- All glass goes through **`GlassSurface`** (already gated on `isGlassEffectAPIAvailable()`). **Never animate glass opacity** (parent or child) — animate gradient overlays / non-opacity props only.
- All Quran modals use **`@gorhom/bottom-sheet`** (the `components/mosques/MosqueSheet.tsx` pattern), with `enablePanDownToClose`.
- Imports use the `@/` path alias.
- Haptics via **`useHaptics`** (gated by setting + Reduce Motion). Respect Reduce Motion for entrance/press animations (fall back to plain fade/none).
- Safe areas per CLAUDE.md: scrollable screens are full-bleed; apply `useSafeAreaInsets()` as content padding with `contentInsetAdjustmentBehavior="never"`. Exactly one `SafeAreaProvider` (root). Tests mocking `react-native-safe-area-context` must keep `useSafeAreaInsets: () => ({ top:0, bottom:0, left:0, right:0 })`.
- Support all three themes (`default`, `dark`, `light`). Glass over the light theme uses dark tints (handled by `theme.materials`).
- `npm run verify` (lint + typecheck + test) must be green. Update `__tests__/README.md` when suites change.

**Testing approach for this restyle:** New extracted components get TDD render tests. Existing components with contract tests (`quran-ayah-card`, `quran-navigator-tabs`, `quran-navigator-modal`, `quran-display-settings-modal`, `screen-contracts`) get their tests updated to the new UI first (red), then the restyle makes them green. Components without standalone tests and heavy context (mini player, completion card, copy toast) are gated on `npm run verify` green (regression) + a manual on-device visual checkpoint. Run a single file with: `npm test -- --runTestsByPath <path>` (from `frontend/`).

**All commands run from `/Users/yassin/work/Sirat/frontend`.**

---

### Task 1: Extract shared `SheetBackground`

Factor the glass + animated-gradient sheet background out of `MosqueSheet` into a reusable component so the Quran sheets (navigator, bookmark, display, copy) share one implementation.

**Files:**
- Create: `frontend/components/ui/SheetBackground.tsx`
- Create: `frontend/__tests__/components/sheet-background.contract.test.tsx`
- Modify: `frontend/components/mosques/MosqueSheet.tsx` (replace its inline `SheetBackground` with the shared one)

**Interfaces:**
- Produces: `export default function SheetBackground(props: BottomSheetBackgroundProps & { fadeToSolidFrom?: number }): JSX.Element` — renders a static `GlassView` (`glassEffectStyle="regular"`) on iOS-with-glass, a solid `withOpacity(primaryDeep, 0.82)` `View` fallback otherwise, plus an `Animated.View` gradient overlay (`primaryDeep → primary`) whose opacity interpolates on `animatedIndex` (default fade range `[1, 2] → [0, 1]`; `fadeToSolidFrom` overrides the lower bound). Consumes `useTheme()`. Accepts the standard `@gorhom/bottom-sheet` `backgroundComponent` props (`style`, `animatedIndex`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/sheet-background.contract.test.tsx
import { render } from "@testing-library/react-native";
import Animated from "react-native-reanimated";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});

import SheetBackground from "@/components/ui/SheetBackground";

describe("SheetBackground", () => {
  it("renders without crashing given bottom-sheet background props", () => {
    const animatedIndex = { value: 1 } as any;
    const tree = render(
      <SheetBackground
        animatedIndex={animatedIndex}
        animatedPosition={{ value: 0 } as any}
        style={{}}
        testID="sheet-bg"
      />,
    );
    expect(tree.getByTestId("sheet-bg")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/sheet-background.contract.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/SheetBackground'`.

- [ ] **Step 3: Implement `SheetBackground`**

Copy the glass+gradient logic currently inside `MosqueSheet.tsx`'s `SheetBackground` into the new file, generalized. Concretely:

```tsx
// frontend/components/ui/SheetBackground.tsx
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";

import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = BottomSheetBackgroundProps & {
  testID?: string;
  fadeToSolidFrom?: number;
};

export default function SheetBackground({
  style,
  animatedIndex,
  testID,
  fadeToSolidFrom = 1,
}: Props) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const glass = Platform.OS === "ios" && isGlassEffectAPIAvailable();

  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [fadeToSolidFrom, fadeToSolidFrom + 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[style, styles.bg, { borderColor: withOpacity(colors.white, 0.12) }]}
    >
      {glass ? (
        <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withOpacity(colors.primaryDeep, 0.82) },
          ]}
        />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
        <LinearGradient
          colors={[colors.primaryDeep, colors.primary]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    overflow: "hidden",
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/sheet-background.contract.test.tsx`
Expected: PASS.

- [ ] **Step 5: Migrate `MosqueSheet` to the shared component**

In `frontend/components/mosques/MosqueSheet.tsx`: delete its local `SheetBackground` function and import the shared one (`import SheetBackground from "@/components/ui/SheetBackground"`). Pass it to `backgroundComponent={SheetBackground}` (or a thin wrapper if Mosques needs a custom `fadeToSolidFrom`). Keep `handleIndicatorStyle`, `snapPoints`, and all sheet props identical.

- [ ] **Step 6: Verify no Mosques regression**

Run: `npm test` then `npm run typecheck`
Expected: full suite PASS, typecheck clean. (Confirms the Mosques sheet still renders and types line up.)

- [ ] **Step 7: Commit**

```bash
git add components/ui/SheetBackground.tsx components/mosques/MosqueSheet.tsx __tests__/components/sheet-background.contract.test.tsx
git commit -m "refactor(ui): extract shared SheetBackground for glass sheets"
```

---

### Task 2: `SurahBanner` component

Extract the surah-divider visual from `QuranAyahCard` into a focused, restyled component (Arabic + English name + ornamental gold rules).

**Files:**
- Create: `frontend/components/quran/SurahBanner.tsx`
- Create: `frontend/__tests__/components/surah-banner.contract.test.tsx`

**Interfaces:**
- Produces: `export default function SurahBanner(props: { arabicName: string; englishName?: string }): JSX.Element` — centered banner; renders `arabicName` (gold, large) and, if present, `englishName` (uppercase caption). No other fields.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/components/surah-banner.contract.test.tsx
import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});

import SurahBanner from "@/components/quran/SurahBanner";

describe("SurahBanner", () => {
  it("renders the arabic and english surah names", () => {
    const { getByText } = render(
      <SurahBanner arabicName="البقرة" englishName="Al-Baqarah" />,
    );
    expect(getByText("البقرة")).toBeTruthy();
    expect(getByText("Al-Baqarah")).toBeTruthy();
  });

  it("omits english line when not provided", () => {
    const { queryByText } = render(<SurahBanner arabicName="البقرة" />);
    expect(queryByText("Al-Baqarah")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/surah-banner.contract.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SurahBanner`**

```tsx
// frontend/components/quran/SurahBanner.tsx
import { StyleSheet, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Caption } from "@/components/ui/Text";

export default function SurahBanner({
  arabicName,
  englishName,
}: {
  arabicName: string;
  englishName?: string;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.banner}>
      <View style={styles.rule}>
        <View style={styles.line} />
        <Caption color={theme.colors.accent}>❖</Caption>
        <View style={styles.line} />
      </View>
      <Caption color={theme.colors.accent} style={styles.arabic}>
        {arabicName}
      </Caption>
      {englishName ? (
        <Caption color={withOpacity(theme.colors.white, 0.85)} style={styles.english}>
          {englishName.toUpperCase()}
        </Caption>
      ) : null}
      <View style={styles.rule}>
        <View style={styles.line} />
        <Caption color={theme.colors.accent}>❖</Caption>
        <View style={styles.line} />
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    banner: {
      alignItems: "center",
      marginVertical: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    rule: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      opacity: 0.6,
      alignSelf: "stretch",
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: withOpacity(theme.colors.accent, 0.5),
    },
    arabic: { fontSize: 28, fontWeight: "600", lineHeight: 38 },
    english: { letterSpacing: 1 },
  });
```

(If `Caption` cannot host a 28px Arabic line cleanly, use a plain themed `<Text>` for the Arabic name with the same color — still no static colors.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/surah-banner.contract.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/quran/SurahBanner.tsx __tests__/components/surah-banner.contract.test.tsx
git commit -m "feat(quran): add SurahBanner component"
```

---

### Task 3: Flowing ayah block (`QuranAyahCard`)

Remove the per-ayah box and top-right `surahTag` pill; add the inline gold ﴿n﴾ marker and flowing dividers; render the surah start via `SurahBanner`. Keep the bookmark badge, all interactions, and Arabic rendering verbatim.

**Files:**
- Modify: `frontend/components/quran/QuranAyahCard.tsx`
- Modify: `frontend/__tests__/components/quran-ayah-card.contract.test.tsx`

**Interfaces:**
- Consumes: `SurahBanner` from Task 2.
- Produces: `QuranAyahCard` props unchanged. The inline ayah-number marker carries `testID="ayah-number-marker"`.

- [ ] **Step 1: Update the contract test to the new UI (red)**

The existing test asserts `getByText("2:255")` (the removed pill). Replace that block. Keep the surah-header, visibility-flag, bookmark-icon, and double-tap assertions. Change the ayah-number assertion to the inline marker:

```tsx
// in quran-ayah-card.contract.test.tsx — replace the "2:255" expectation
expect(getByTestId("ayah-number-marker")).toHaveTextContent("255");
```

Add `getByTestId` to the destructured `render(...)` return where needed. The surah-header assertions (`getByText("سُورَةُ البَقَرَةِ")` / `getByText("The Cow")`) must still pass — `SurahBanner` renders `arabicName`/`englishName`, so ensure the card passes the same strings into `SurahBanner` that the test expects. If the current test expects `"سُورَةُ البَقَرَةِ"` but `SurahBanner` is fed `surahMeta.arabicName`, confirm the fixture's `arabicName` equals that string; adjust the fixture or the asserted text to match the real field, not an invented one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/quran-ayah-card.contract.test.tsx`
Expected: FAIL — no element with `testID="ayah-number-marker"` yet.

- [ ] **Step 3: Restyle `QuranAyahCard`**

In the render (`QuranAyahCard.tsx:96-165`):
- Replace the `isSurahStart` divider block (lines 98-109) with `{isSurahStart ? <SurahBanner arabicName={arabicName} englishName={englishName} /> : null}`.
- Remove the `surahTag` `<Text>` (lines 131-133).
- Append the inline marker to the Arabic line — render the ayah number after the Arabic text:

```tsx
<Text style={styles.ayahMarker} testID="ayah-number-marker" allowFontScaling={false}>
  {` ﴿${ayah.ayahNumber}﵀`}
</Text>
```

(`﴿` = ﴿, `﵀` = ﴾. Western digits — no new digit-conversion logic.)

In `createStyles` (`QuranAyahCard.tsx:170-301`):
- Delete `ayahCard`, `ayahCardBookmarked`, `surahTag` rules. Replace the wrapping `Pressable style={styles.ayahCard}` with a flowing block:

```tsx
ayahBlock: {
  paddingVertical: theme.spacing.md,
  paddingHorizontal: theme.spacing.xs,
},
ayahMarker: {
  color: theme.colors.accent,
  fontSize: 16,
},
```
- Add a divider rule and render a divider between ayahs (when **not** surah start) — or render it from the list in Task 4; keep it here for now:

```tsx
divider: {
  flexDirection: "row",
  alignItems: "center",
  gap: theme.spacing.md,
  opacity: 0.45,
  marginTop: theme.spacing.sm,
},
dividerLine: { flex: 1, height: 1, backgroundColor: withOpacity(theme.colors.white, 0.16) },
```
- **Keep** `bookmarkBadge` (lines 257-266), `holdScale` spring (50-66), double-tap logic (76-94), `isDoubleTapFeedbackVisible` feedback, `arabic`/`transliteration`/`translation` text styles (268-299) and their `allowFontScaling`/`includeFontPadding`/`textBreakStrategy` exactly. The bookmark badge stays pinned `top:13,left:13` relative to the (now box-less) block.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/quran-ayah-card.contract.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/quran/QuranAyahCard.tsx __tests__/components/quran-ayah-card.contract.test.tsx
git commit -m "feat(quran): flowing ayah surface with inline markers + SurahBanner"
```

---

### Task 4: Persistent glass header + full-bleed list

Replace the `"Quran"` title / `headerSubsection` / `capsuleBar` block with a thin glass header bar that overlays the full-bleed list and always shows the current surah + live `Ayah · Juzʾ`. Preserve all three controls and their handlers/states.

**Files:**
- Modify: `frontend/app/(tabs)/Quran.tsx` (header block ~1260-1361; list container ~1363+)
- Modify: `frontend/__tests__/screens/screen-contracts.test.tsx` (Quran section ~811-837)

**Interfaces:**
- Consumes: existing `currentSurahMeta`, `currentAyah`, `audioIconName`, `handleAudioButtonPress`, `stopAudio`, `isAudioLoading`, `offlinePillVisible`, `openNavigator`, `setDisplaySettingsOpen`.

- [ ] **Step 1: Update the screen contract test to the new header (red)**

The Quran test asserts `getByText("Quran")`. The new header shows the current surah name instead. Update it to assert the surah name the mocked `getSurahMeta`/`currentSurahMeta` yields (use the real mocked `englishName` — check the mock at `screen-contracts.test.tsx` ~138-149 and assert that exact string). Keep the `flash-list-mock` → `items:2` assertion and the play-button → audio-controller wiring assertion unchanged.

```tsx
// replace: expect(getByText("Quran")).toBeTruthy();
// with (use the mock's englishName, e.g. "Al-Fatihah"):
expect(getByText("Al-Fatihah")).toBeTruthy();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/screens/screen-contracts.test.tsx`
Expected: FAIL on the Quran header assertion (old "Quran" text gone / new name not yet rendered).

- [ ] **Step 3: Implement the glass header**

Replace the header JSX with an absolutely-positioned glass bar overlaying the list top. Use `GlassSurface tier="chrome"` for the bar and the control buttons; gold play button via `colors.accent`. Skeleton:

```tsx
<GlassSurface tier="chrome" radius={0} style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
  <View style={styles.headerText}>
    <View style={styles.headerTitleRow}>
      <Headline color={colors.white}>{currentSurahMeta?.englishName ?? ""}</Headline>
      <Text style={styles.headerArabic}>{currentSurahMeta?.arabicName ?? ""}</Text>
    </View>
    <Caption color={colors.accent}>
      Ayah {currentAyah.ayahNumber} · Juzʾ {currentAyah.juzNumber}
    </Caption>
  </View>
  <View style={styles.headerActions}>
    {offlinePillVisible ? (
      <View style={[styles.ctrl, styles.ctrlOffline]} accessibilityRole="text">
        <Ionicons name="cloud-offline-outline" size={18} color={colors.white} />
      </View>
    ) : (
      <PressableScale
        style={[styles.ctrl, styles.ctrlPlay, isAudioLoading && styles.ctrlDisabled]}
        onPress={handleAudioButtonPress}
        onLongPress={stopAudio}
        disabled={isAudioLoading}
        accessibilityRole="button"
        accessibilityLabel={audioAccessibilityLabel}
        hitSlop={8}
      >
        <Ionicons name={audioIconName} size={18} color={colors.onAccent} />
      </PressableScale>
    )}
    <PressableScale style={styles.ctrl} onPress={() => openNavigator("surah")} accessibilityRole="button" accessibilityLabel="Navigate">
      <Ionicons name="search" size={18} color={colors.white} />
    </PressableScale>
    <PressableScale style={styles.ctrl} onPress={() => setDisplaySettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Display settings">
      <Text style={styles.aa}>Aa</Text>
    </PressableScale>
  </View>
</GlassSurface>
```

Styles (add to the screen's `createStyles`):

```tsx
headerBar: {
  position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
  flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md,
  borderBottomWidth: 1, borderColor: withOpacity(theme.colors.white, 0.12),
},
headerTitleRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.sm },
headerArabic: { fontFamily: "SFProDisplay-Semibold", fontSize: 16, color: theme.colors.accent },
headerActions: { flexDirection: "row", gap: theme.spacing.sm },
ctrl: {
  width: 40, height: 40, borderRadius: theme.radii.pill, alignItems: "center", justifyContent: "center",
  backgroundColor: withOpacity(theme.colors.white, 0.1), borderWidth: 1, borderColor: withOpacity(theme.colors.white, 0.18),
},
ctrlPlay: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
ctrlOffline: { backgroundColor: withOpacity(theme.colors.white, 0.08) },
ctrlDisabled: { opacity: 0.5 },
aa: { fontFamily: "SFProDisplay-Bold", fontSize: 14, color: theme.colors.white },
```

- `openNavigator`'s default arg becomes `"surah"` (Task 6 changes the key type). Until Task 6 lands, leave `openNavigator("goto")` so this task compiles standalone, and switch it in Task 6.
- Give the FlashList top content padding so verses start below the overlaying bar: add `paddingTop: HEADER_HEIGHT + insets.top` to its `contentContainerStyle` (define `HEADER_HEIGHT` ≈ 64 constant). Ensure the screen is full-bleed (`Screen` / gradient already fills; no `SafeAreaView` around the scroll frame), `contentInsetAdjustmentBehavior="never"`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/screens/screen-contracts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/Quran.tsx __tests__/screens/screen-contracts.test.tsx
git commit -m "feat(quran): persistent glass header over full-bleed reader"
```

---

### Task 5: Mini player glass restyle

Restyle the docked mini player as a Tier-1 glass chrome bar with a gold play button and accent progress. Controls, audio state, and safe-area docking unchanged.

**Files:**
- Modify: `frontend/components/quran/QuranMiniPlayer.tsx`

- [ ] **Step 1: Restyle the container and controls**

Wrap the player body in `GlassSurface tier="chrome" radius={theme.radii.cardLg}`. Replace the opaque `primaryDeep@0.9` container background with the glass surface. Play button: `backgroundColor: colors.accent`, icon `colors.onAccent`, `shadowColor: withOpacity(colors.accent, 0.4)`. Stop button: `withOpacity(colors.white, 0.1)`. Progress track `withOpacity(colors.white, 0.18)` with `colors.accent` fill. Keep the `useSafeAreaInsets` bottom padding and all `useQuranAudioController` wiring.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 3: Full regression suite**

Run: `npm test`
Expected: PASS (screen-contracts play-button wiring still green; no behavior change).

- [ ] **Step 4: Manual visual checkpoint**

Note for the human reviewer: play a surah on device, confirm the glass bar docks above the tab bar and controls work.

- [ ] **Step 5: Commit**

```bash
git add components/quran/QuranMiniPlayer.tsx
git commit -m "feat(quran): glass mini player"
```

---

### Task 6: Navigator shell → bottom sheet + segmented control

Convert `NavigatorModal` from a centered `Modal` to a `@gorhom/bottom-sheet`, and change `NavigatorTabs` from 2 tabs (`goto`/`bookmarks`) to a 3-segment control (`surah`/`juz`/`bookmarks`). Rewire the key type across the navigator and `Quran.tsx`.

**Files:**
- Modify: `frontend/components/quran/navigator/NavigatorModal.tsx`
- Modify: `frontend/components/quran/navigator/NavigatorTabs.tsx`
- Modify: `frontend/app/(tabs)/Quran.tsx` (`NavigatorInitialTab` type ~95, navigator state ~376-378, `openNavigator` default ~683-685; `handleAyahDoubleTap` keeps `openNavigator("bookmarks")`)
- Modify: `frontend/__tests__/components/quran-navigator-tabs.contract.test.tsx`
- Modify: `frontend/__tests__/components/quran-navigator-modal.contract.test.tsx`

**Interfaces:**
- Produces: `export type NavigatorTabKey = "surah" | "juz" | "bookmarks"` (was `"goto" | "bookmarks"`). `NavigatorTabs` renders three segments and calls `onSelectTab(key)`.

- [ ] **Step 1: Update the tabs test to 3 segments (red)**

In `quran-navigator-tabs.contract.test.tsx`, change the expected labels/keys to `Sūrah` / `Juzʾ` / `Bookmarks` and assert a press on each calls `onSelectTab` with `"surah"`/`"juz"`/`"bookmarks"`. (Match the exact label strings you render.)

- [ ] **Step 2: Run tabs test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/quran-navigator-tabs.contract.test.tsx`
Expected: FAIL (old `Go To`/`Bookmarks` labels/keys).

- [ ] **Step 3: Implement the 3-segment control**

In `NavigatorTabs.tsx`: change `NavigatorTabKey` and `TAB_ITEMS` to `[{key:"surah",label:"Sūrah"},{key:"juz",label:"Juzʾ"},{key:"bookmarks",label:"Bookmarks"}]`. Restyle as a single pill container (`withOpacity(black,0.22)` track, `radii.pill`) with the active segment in `colors.accent` (text `colors.onAccent`) — mirror the active-state shadow already in the file (lines 86-93).

- [ ] **Step 4: Run tabs test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/quran-navigator-tabs.contract.test.tsx`
Expected: PASS.

- [ ] **Step 5: Convert `NavigatorModal` to a bottom sheet**

Replace `Modal` + `useModalTransition` + `modalOverlay`/`modalCard` with `BottomSheet` (`import BottomSheet from "@gorhom/bottom-sheet"`) using `backgroundComponent={SheetBackground}`, a large snap point (e.g. `snapPoints={["90%"]}`), `enablePanDownToClose`, and `onClose` mapped to `onChange`/`index===-1`. Keep the header ("Navigate" title + dismiss), the search field, `NavigatorTabs`, and a three-panel switch (`surah`/`juz`/`bookmarks`) rendering `SurahTab`, `JuzTab`, and `BookmarksTab` respectively. `JuzTab` is imported and rendered here now (it was previously toggled inside `SurahTab`). Default `selectedTab` becomes `"surah"`.

- [ ] **Step 6: Rewire the key type in `Quran.tsx`**

Change `NavigatorInitialTab` (line 95) to the new union, default `navigatorInitialTab` to `"surah"`, `openNavigator` default arg to `"surah"`, and update the header's navigate button to `openNavigator("surah")`. Leave `handleAyahDoubleTap`'s `openNavigator("bookmarks")` as-is (behavior contract).

- [ ] **Step 7: Update the navigator-modal test**

In `quran-navigator-modal.contract.test.tsx`, update any `goto` references to `surah`, and confirm visibility/selection/close assertions still hold (the global `@gorhom/bottom-sheet` mock renders the sheet as a `View`, so queries by text/label work). Selection callbacks (`onSelectSurah`/`onSelectAyah`/`onSelectJuz`/`onSelectBookmark`) and search-query props are unchanged.

- [ ] **Step 8: Run navigator-modal test + typecheck**

Run: `npm test -- --runTestsByPath __tests__/components/quran-navigator-modal.contract.test.tsx && npm run typecheck`
Expected: PASS + clean.

- [ ] **Step 9: Commit**

```bash
git add components/quran/navigator/NavigatorModal.tsx components/quran/navigator/NavigatorTabs.tsx app/\(tabs\)/Quran.tsx __tests__/components/quran-navigator-tabs.contract.test.tsx __tests__/components/quran-navigator-modal.contract.test.tsx
git commit -m "feat(quran): navigator as glass bottom sheet with Surah/Juz/Bookmarks segments"
```

---

### Task 7: Navigator content restyle (Sūrah grid · Juzʾ grid · Bookmarks rows)

Glass-restyle the three segment bodies and fix the swipe-to-delete gesture inside the sheet.

**Files:**
- Modify: `frontend/components/quran/navigator/SurahTab.tsx`
- Modify: `frontend/components/quran/navigator/JuzTab.tsx`
- Modify: `frontend/components/quran/navigator/BookmarksTab.tsx`

- [ ] **Step 1: Restyle `SurahTab`**

Remove the `showJuzGrid` toggle/state and any juz-grid rendering (juz is now its own segment in Task 6). Keep the search input (placeholder `"Search verses or 2:255"`), verse-match results section, and the responsive `numColumns`. Restyle each surah tile as a `row`-tier glass surface (`withOpacity(white,0.05)` fill, `withOpacity(white,0.1)` border, `radii.row`, `borderCurve:"continuous"`), showing number (gold), `englishName`, `arabicName` (gold), and `Surah {n} · {ayahCount} ayāt` (use existing fields). Keep `PressableScale` + `handleSelect`/`handleSelectAyah` wiring.

- [ ] **Step 2: Restyle `JuzTab`**

Restyle the 30-item grid buttons as `row`-tier glass tiles (`radii.row`, accent border) matching the surah tiles' material. Keep `handleSelectJuz` wiring and the 3-per-row layout.

- [ ] **Step 3: Restyle `BookmarksTab` + fix swipe gesture**

Restyle bookmark rows as `row`-tier glass (gold bookmark-glyph circle, title, `surah:ayah · Juzʾ`, optional note). Keep the `Swipeable` delete and its animations. Add `activeOffsetX={[-12, 12]}` (and `failOffsetY={[-12, 12]}` if needed) to the row's gesture so horizontal swipe-to-delete doesn't conflict with the sheet's vertical pan.

- [ ] **Step 4: Typecheck + lint + full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean + PASS (navigator-modal selection/search tests still green).

- [ ] **Step 5: Commit**

```bash
git add components/quran/navigator/SurahTab.tsx components/quran/navigator/JuzTab.tsx components/quran/navigator/BookmarksTab.tsx
git commit -m "feat(quran): glass navigator content (surah/juz grids, bookmark rows)"
```

---

### Task 8: Bookmark editor → glass sheet

Convert `QuranBookmarkModal` from a `Modal` + `KeyboardAvoidingView` to a `@gorhom/bottom-sheet` with glass background and the sheet's keyboard handling.

**Files:**
- Modify: `frontend/components/quran/QuranBookmarkModal.tsx`

- [ ] **Step 1: Convert to a bottom sheet**

Replace `Modal`/`useModalTransition`/`KeyboardAvoidingView` with `BottomSheet` (`backgroundComponent={SheetBackground}`, a content-sized snap e.g. `snapPoints={["55%"]}`, `enablePanDownToClose`, `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`). Keep header `"New Bookmark"` + `"Save this ayah for quick return"`, the title input (placeholder `defaultTitleFallback || "Bookmark title"`), note input (`"Add an optional note"`), and the gold Done button (`"Saving…"` while submitting). Restyle inputs as glass rows (`withOpacity(white,0.05)` fill, `radii.row`). All submit/validation logic (`handleSubmit`, `trimmedTitle`, `isDoneDisabled`) unchanged.

- [ ] **Step 2: Typecheck + lint + full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean + PASS.

- [ ] **Step 3: Commit**

```bash
git add components/quran/QuranBookmarkModal.tsx
git commit -m "feat(quran): bookmark editor as glass sheet"
```

---

### Task 9: Display Text + Copy sheets → glass

Move `QuranDisplaySettingsModal` and `QuranCopySheet` onto the shared glass sheet language.

**Files:**
- Modify: `frontend/components/quran/QuranDisplaySettingsModal.tsx`
- Modify: `frontend/components/quran/QuranCopySheet.tsx`
- Modify: `frontend/__tests__/components/quran-display-settings-modal.contract.test.tsx`

- [ ] **Step 1: Update the display-settings test if presentation assertions break (red, if needed)**

Run the existing test first: `npm test -- --runTestsByPath __tests__/components/quran-display-settings-modal.contract.test.tsx`. If it asserts modal-specific structure, update it to the sheet rendering while keeping the toggle assertions (`Arabic`/`English`/`Transliteration`, `useQuranDisplayModes` wiring). The labels and `Display Text` / `Select which text to show` strings stay.

- [ ] **Step 2: Convert `QuranDisplaySettingsModal`**

`BottomSheet` + `SheetBackground`, compact snap (`["40%"]`), `enablePanDownToClose`. Three toggle rows restyled as glass rows with a gold-filled check affordance. Toggle wiring via `useQuranDisplayModes` unchanged.

- [ ] **Step 3: Convert `QuranCopySheet`**

Replace its `Modal` slide-up with `BottomSheet` + `SheetBackground` (`["40%"]`, `enablePanDownToClose`). Keep handle, `{title}` ref, `Copy ayah text`, and conditional rows `Copy Arabic`/`Copy Transliteration`/`Copy English`/`Copy All` (gold-emphasized). `formatCopyText` + success haptic unchanged.

- [ ] **Step 4: Run display test + typecheck + lint + full suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add components/quran/QuranDisplaySettingsModal.tsx components/quran/QuranCopySheet.tsx __tests__/components/quran-display-settings-modal.contract.test.tsx
git commit -m "feat(quran): display settings + copy as glass sheets"
```

---

### Task 10: Completion card + Copy toast

Restyle the two small surfaces to the glass language.

**Files:**
- Modify: `frontend/components/quran/QuranCompletionCard.tsx`
- Modify: `frontend/components/CopyToast.tsx`

- [ ] **Step 1: Restyle `QuranCompletionCard`**

Wrap content in `GlassSurface tier="card" radius={theme.radii.card}`, accent ornament, type-ramp `Text`. Content/strings unchanged.

- [ ] **Step 2: Restyle `CopyToast`**

Restyle the toast as a small `GlassSurface tier="chrome"` pill with type-ramp text. Animation/visibility logic unchanged. (Shared component — visual-only change; affects anywhere it's used.)

- [ ] **Step 3: Typecheck + lint + full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean + PASS.

- [ ] **Step 4: Commit**

```bash
git add components/quran/QuranCompletionCard.tsx components/CopyToast.tsx
git commit -m "feat(quran): glass completion card + copy toast"
```

---

### Task 11: Motion/haptics polish, README, full verify

Add calm entrance/press motion and route haptics through `useHaptics`, then update docs and run the full gate.

**Files:**
- Modify: `frontend/app/(tabs)/Quran.tsx`, `frontend/components/quran/QuranAyahCard.tsx` (motion/haptics only)
- Modify: `frontend/__tests__/README.md`

- [ ] **Step 1: Apply motion + haptics presets**

Use `STAGGER_MS`/`TIMING_ENTER` for a subtle list/content entrance (respect Reduce Motion → fall back to no animation), `PRESS_SCALE`/`SPRING_PRESS` for press feedback (already largely present in `QuranAyahCard`). Replace direct `expo-haptics` calls in the Quran flow with `useHaptics` (`light` on bookmark/select/long-press, `success` on copy, `selection` on segment change), preserving the same felt events. **Do not animate any glass opacity.**

- [ ] **Step 2: Update `__tests__/README.md`**

Add the two new suites under the relevant phase lines:
```
- `shared components`
  - `components/sheet-background.contract.test.tsx`
- `quran user state persistence` (or the quran UI phase)
  - `components/surah-banner.contract.test.tsx`
```
(Match the existing section format.)

- [ ] **Step 3: Full verify**

Run: `npm run verify`
Expected: lint + typecheck + test all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/Quran.tsx components/quran/QuranAyahCard.tsx __tests__/README.md
git commit -m "feat(quran): motion + haptics polish; update test docs"
```

- [ ] **Step 5: On-device QA (manual, human reviewer)**

Per spec §12: verify all three themes; iOS 26 device (real glass), older iOS + Android (solid fallbacks); Reduce Motion + Reduce Transparency; AA contrast; and the behavior contract (double-tap routing, long-press copy, audio states, swipe-to-delete, scroll-anchoring, resume-on-open).

---

## Self-Review

**Spec coverage:**
- §4.1 flowing reader → Tasks 3, 4. §4.2 ayah block → Task 3. §4.3 surah banner → Tasks 2, 3. §4.4 persistent header → Task 4. §4.5 mini player → Task 5. §4.6 navigator → Tasks 6, 7. §4.7 bookmark editor → Task 8. §4.8 display settings + §4.9 copy → Task 9. §4.10 completion card + §4.11 copy toast → Task 10. §5 shared pieces → Tasks 1 (SheetBackground), 2 (SurahBanner). §6 motion/haptics → Task 11. §7 theming → Global Constraints + Task 11 QA. §8 behavior contract → preserved per-task + Task 11 QA. §12 testing → per-task + Task 11. No uncovered sections.

**Placeholder scan:** No "TBD/handle edge cases/similar to Task N". Restyle steps reference exact files/lines and show the changed code, styles, and test assertions. Where full-file code is impractical (1617-line `Quran.tsx`), the changed JSX + style objects + exact test edits are given.

**Type consistency:** `NavigatorTabKey`/`NavigatorInitialTab` changes from `"goto" | "bookmarks"` → `"surah" | "juz" | "bookmarks"` are applied consistently in Task 6 across `NavigatorTabs.tsx`, `NavigatorModal.tsx`, and `Quran.tsx`, with `openNavigator("bookmarks")` preserved. `SheetBackground` (Task 1) and `SurahBanner` (Tasks 2–3) signatures match their consumers. `testID="ayah-number-marker"` defined in Task 3 is the same id asserted in its test.

## Notes / risks

- **Task 4 + Task 6 coupling:** Task 4 temporarily uses `openNavigator("goto")` so it compiles before Task 6 changes the key type; Task 6 flips it to `"surah"`. Execute 4 before 6, or fold the one-line switch into 6.
- **`Quran.tsx` is large (1617 lines).** Tasks 4, 6, 11 each touch it; review diffs carefully and keep handler logic byte-for-byte where the spec says "unchanged."
- **Glass on theme toggle (#43743):** if a glass surface doesn't refresh on theme change, remount it via a `key={theme.name}` on the glass wrapper.
