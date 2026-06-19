# Mosques Map-First Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Mosques tab as one map-first screen — a full-bleed interactive map with a draggable `@gorhom/bottom-sheet` listing up to 10 nearby mosques (Peek/Half/Full, default Half) — fusing today's list + the separate `MosqueMap` screen into one, and adding a derived compass-direction signal.

**Architecture:** New pure `utils/geo.ts` (distance + bearing/cardinal, unit-tested). New focused components under `components/mosques/` (`MosqueMarker`, `MosqueRow`, `MosqueSheet`). `app/(tabs)/Mosques.tsx` rewritten as the map host that wires data + sheet + markers + map↔list sync. `app/MosqueMap.tsx` deleted. `GestureHandlerRootView` added at the app root.

**Tech Stack:** Expo SDK 54, RN 0.81, `react-native-maps` 1.20, `@gorhom/bottom-sheet` 5.2.14, `react-native-reanimated` 4.1, `react-native-gesture-handler` 2.28, `react-native-svg`, jest-expo.

**Source of truth for design:** `plans/2026-06-17-mosques-map-first-redesign-design.md`. Read it.

**Verify command:** `npm run verify` from `frontend/` (lint + typecheck + jest). Run before every commit.

**Conventions (already in the codebase — follow them):**
- `@/` path alias → `frontend/` root.
- Theming: `useTheme()` + `createStyles(theme)` factory; `withOpacity(hex, alpha)`; never static colors.
- Glass: `GlassSurface` (`tier="chrome"|"card"|"row"`, `radius`, `style`) — reads `theme.materials[tier]` (`.fill`, `.border`); renders `GlassView` on iOS 26 else translucent `View`.
- Typed text: `Caption`, `Headline`, `Title2`, `LargeTitle`, … from `@/components/ui/Text` (`color`, `style` props).
- Tokens: `theme.radii` = `{chip:10,row:14,card:18,cardLg:20,hero:24,heroLg:26,pill:999}`; `theme.spacing` = `{xs:4,sm:8,md:12,lg:16,xl:20,xxl:24,…}`.
- Reference components for look/motion: `components/PrayerArc.tsx`, `components/DuaResultCard.tsx`.
- Haptics: `useHaptics()` → `haptic("selection"|"light"|"medium"|…)`.
- **Never animate glass opacity.** Behavior parity: directions/caching/gate/search-this-area behave exactly as today.

---

## Task 1: Pure geometry helpers (`utils/geo.ts`)

**Files:**
- Create: `frontend/utils/geo.ts`
- Test: `frontend/__tests__/utils/geo.test.ts`

Pure functions, no React. `distanceKm` + `formatDistanceLabel` are **moved** from `app/(tabs)/Mosques.tsx` (lines ~79–105) verbatim; `formatDistanceShort`, `bearingDeg`, `cardinal` are new. Strict TDD.

- [ ] **Step 1: Write the failing test** — `frontend/__tests__/utils/geo.test.ts`

```ts
import {
  distanceKm,
  formatDistanceLabel,
  formatDistanceShort,
  bearingDeg,
  cardinal,
} from "@/utils/geo";

describe("geo", () => {
  // Chicago-ish reference points
  const a = { lat: 41.881, lng: -87.623 };

  it("distanceKm is ~0 for the same point and positive otherwise", () => {
    expect(distanceKm(a.lat, a.lng, a.lat, a.lng)).toBeCloseTo(0, 5);
    expect(distanceKm(41.88, -87.62, 41.89, -87.63)).toBeGreaterThan(0);
  });

  it("formatDistanceLabel keeps imperial 'away' phrasing", () => {
    expect(formatDistanceLabel(0.05)).toMatch(/ft away$/);   // very close → feet
    expect(formatDistanceLabel(1)).toMatch(/mi away$/);       // ~0.6 mi
    expect(formatDistanceLabel(NaN)).toBe("");
  });

  it("formatDistanceShort drops the 'away' suffix", () => {
    expect(formatDistanceShort(1)).toMatch(/mi$/);
    expect(formatDistanceShort(1)).not.toMatch(/away/);
    expect(formatDistanceShort(0.05)).toMatch(/ft$/);
  });

  it("bearingDeg returns 0..360 with cardinal directions correct", () => {
    // due north: same lng, higher lat
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 0);
    // due east: same lat, higher lng
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 0);
    // due south
    expect(bearingDeg(1, 0, 0, 0)).toBeCloseTo(180, 0);
    // due west
    expect(bearingDeg(0, 1, 0, 0)).toBeCloseTo(270, 0);
  });

  it("cardinal maps degrees to the 8-point compass", () => {
    expect(cardinal(0)).toBe("N");
    expect(cardinal(45)).toBe("NE");
    expect(cardinal(90)).toBe("E");
    expect(cardinal(135)).toBe("SE");
    expect(cardinal(180)).toBe("S");
    expect(cardinal(225)).toBe("SW");
    expect(cardinal(270)).toBe("W");
    expect(cardinal(315)).toBe("NW");
    expect(cardinal(359)).toBe("N");   // wraps
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- --runTestsByPath __tests__/utils/geo.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `frontend/utils/geo.ts`**

```ts
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;
const EARTH_RADIUS_KM = 6371;

export function distanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) *
      Math.cos(toRad(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return EARTH_RADIUS_KM * c;
}

export function formatDistanceLabel(km: number): string {
  if (!Number.isFinite(km)) return "";
  const miles = km * 0.621371;
  if (miles < 0.1) return `${Math.round(km * 3280.84)} ft away`;
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

export function formatDistanceShort(km: number): string {
  if (!Number.isFinite(km)) return "";
  const miles = km * 0.621371;
  if (miles < 0.1) return `${Math.round(km * 3280.84)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function bearingDeg(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const φ1 = toRad(fromLat);
  const φ2 = toRad(toLat);
  const Δλ = toRad(toLng - fromLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Cardinal = (typeof COMPASS)[number];

export function cardinal(deg: number): Cardinal {
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return COMPASS[idx];
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test -- --runTestsByPath __tests__/utils/geo.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add frontend/utils/geo.ts frontend/__tests__/utils/geo.test.ts && git commit -m "feat(mosques): add pure geo helpers (distance, bearing, cardinal)"`

---

## Task 2: Install `@gorhom/bottom-sheet`, root `GestureHandlerRootView`, test mocks

**Files:**
- Modify: `frontend/package.json` (+`package-lock.json`) — via installer
- Modify: `frontend/app/_layout.tsx`
- Modify: `frontend/test/setup/jest.setup.ts`

Infra task — keep the **entire existing suite green**. No screen changes yet.

- [ ] **Step 1: Install** — from `frontend/`: `npx expo install @gorhom/bottom-sheet` (uses Expo's SDK-compatible version; expect 5.2.x). Confirm `react-native-reanimated` and `react-native-gesture-handler` remain unchanged.

- [ ] **Step 2: Wrap the app root in `GestureHandlerRootView`** — in `frontend/app/_layout.tsx`, import:

```ts
import { GestureHandlerRootView } from "react-native-gesture-handler";
```

Wrap the **outermost** returned element of `RootLayoutContent` (currently `<SafeAreaProvider>`) so it becomes:

```tsx
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      {/* …unchanged… */}
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
```

Change nothing else in this file in this task. (The `MosqueMap` `Stack.Screen` is removed in Task 7.)

- [ ] **Step 3: Add global jest mocks** — append to `frontend/test/setup/jest.setup.ts` (mirrors the existing `expo-glass-effect` mock style):

```ts
// @gorhom/bottom-sheet renders as plain views/list in tests so screens that
// embed the sheet can be rendered and queried.
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View, FlatList } = require("react-native");
  const Passthrough = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  return {
    __esModule: true,
    default: React.forwardRef(({ children, ...props }: any, _ref: any) =>
      React.createElement(View, props, children),
    ),
    BottomSheetView: Passthrough,
    BottomSheetFlatList: ({ ListHeaderComponent, ...props }: any) =>
      React.createElement(
        View,
        null,
        ListHeaderComponent
          ? React.createElement(
              typeof ListHeaderComponent === "function"
                ? ListHeaderComponent
                : () => ListHeaderComponent,
            )
          : null,
        React.createElement(FlatList, props),
      ),
    useBottomSheet: () => ({
      snapToIndex: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
    }),
  };
});
```

If `react-native-gesture-handler` components throw under jest after the root wrap, also add at the **top** of the setup file: `require("react-native-gesture-handler/jestSetup");` (jest-expo usually covers this — only add if verify fails without it).

- [ ] **Step 4: Verify** — `npm run verify` → all suites green (lint + typecheck + jest). The only changes are an added dep, the root wrap, and additive test mocks.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "chore(mosques): add @gorhom/bottom-sheet, root GestureHandlerRootView, test mocks"`

---

## Task 3: `MosqueMarker` component

**Files:**
- Create: `frontend/components/mosques/MosqueMarker.tsx`

A themed `react-native-maps` `Marker` for a mosque pin, with a default and a **selected** (elevated) state. Extracted from the inline pin in today's `Mosques.tsx`/`MosqueMap.tsx` (`pinContainer` style: accent circle, `FontAwesome5 mosque` glyph, themed border + shadow).

- [ ] **Step 1: Implement** — props and behavior:

```tsx
import { FontAwesome5 } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Mosque } from "@/services/getNearbyMosques";

type Props = { mosque: Mosque; selected?: boolean; onPress?: () => void };

function MosqueMarkerBase({ mosque, selected = false, onPress }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <Marker
      identifier={mosque.id}
      coordinate={{ latitude: mosque.lat, longitude: mosque.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={selected}   // re-render only while selected animates in
      onPress={onPress}
    >
      <View
        style={[
          styles.pin,
          {
            backgroundColor: colors.accent,
            borderColor: withOpacity(colors.primaryMuted, 0.9),
          },
          selected && {
            transform: [{ scale: 1.25 }],
            borderColor: colors.white,
            shadowOpacity: 0.5,
          },
        ]}
      >
        <FontAwesome5 name="mosque" size={selected ? 18 : 16} color={colors.primaryMuted} solid />
      </View>
    </Marker>
  );
}

export default memo(MosqueMarkerBase);

const styles = StyleSheet.create({
  pin: {
    borderRadius: 30,
    padding: 5,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
```

(No callout — selection is handled in the sheet, per design §4.1/§4.7. Match the existing pin's exact colors if they differ from the above.)

- [ ] **Step 2: Verify** — `npm run verify` green (no new test required for this leaf component; it's covered indirectly by the screen test in Task 6).
- [ ] **Step 3: Commit** — `git add frontend/components/mosques/MosqueMarker.tsx && git commit -m "feat(mosques): add themed MosqueMarker (default + selected)"`

---

## Task 4: `MosqueRow` component + contract test

**Files:**
- Create: `frontend/components/mosques/MosqueRow.tsx`
- Test: `frontend/__tests__/components/mosque-row.contract.test.tsx`

A Tier-3 glass list row: glyph circle, name, address, a "distance · direction" pill, and a gold **Directions** chip. Match the row styling language of `DuaResultCard`/`PrayerArc` (glass fill `withOpacity(white,0.05)`, border `withOpacity(white,0.09)`, `borderRadius: theme.radii.row`, `borderCurve:"continuous"`).

**Component contract:**
```ts
type MosqueRowProps = {
  name: string;
  address: string;
  distanceLabel: string | null;   // e.g. "0.3 mi" (from formatDistanceShort)
  direction: string | null;       // e.g. "NE" (from cardinal)
  selected?: boolean;
  onPress: () => void;             // tap row (not chip) → select + recenter
  onDirections: () => void;        // tap chip → open maps
};
```
- Row uses `PressableScale` (`@/components/PressableScale`) for the body; the Directions chip is a separate `Pressable` so its press doesn't trigger row select.
- `selected` → accent-tinted fill (`withOpacity(colors.accent,0.08)`) + border (`withOpacity(colors.accent,0.4)`).
- Meta text renders `distanceLabel` and `direction` joined as `"0.3 mi · NE"` (omit the `· dir` if either is null).
- Accessibility: row `accessibilityRole="button"`, `accessibilityLabel={`Select ${name}`}`; chip `accessibilityLabel={`Directions to ${name}`}`.

- [ ] **Step 1: Write the failing test** — `frontend/__tests__/components/mosque-row.contract.test.tsx`

```tsx
import { fireEvent, render } from "@testing-library/react-native";
import MosqueRow from "@/components/mosques/MosqueRow";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
    FontAwesome5: ({ name }: { name: string }) => <Text>{`fa:${name}`}</Text>,
  };
});
jest.mock("@/components/PressableScale", () => {
  const { Pressable } = require("react-native");
  return ({ children, ...p }: any) => <Pressable {...p}>{children}</Pressable>;
});

const base = {
  name: "Masjid Al-Noor",
  address: "120 Cedar St",
  distanceLabel: "0.3 mi",
  direction: "NE",
};

it("renders name, address, and distance · direction", () => {
  const { getByText } = render(
    <MosqueRow {...base} onPress={jest.fn()} onDirections={jest.fn()} />,
  );
  expect(getByText("Masjid Al-Noor")).toBeTruthy();
  expect(getByText("120 Cedar St")).toBeTruthy();
  expect(getByText("0.3 mi · NE")).toBeTruthy();
});

it("wires row select and directions independently", () => {
  const onPress = jest.fn();
  const onDirections = jest.fn();
  const { getByLabelText } = render(
    <MosqueRow {...base} onPress={onPress} onDirections={onDirections} />,
  );
  fireEvent.press(getByLabelText("Directions to Masjid Al-Noor"));
  expect(onDirections).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
  fireEvent.press(getByLabelText("Select Masjid Al-Noor"));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- --runTestsByPath __tests__/components/mosque-row.contract.test.tsx` → FAIL (module not found).
- [ ] **Step 3: Implement `MosqueRow.tsx`** to satisfy the contract above, using `useTheme()`+`createStyles(theme)`, `GlassSurface tier="row"` or a plain glass `View` (match PrayerArc), the gold Directions chip (`backgroundColor: colors.accent`, `color: colors.onAccent`), and the `selected` styling. Build the meta string as: `[distanceLabel, direction].filter(Boolean).join(" · ")`.
- [ ] **Step 4: Run to verify it passes** — same command → PASS.
- [ ] **Step 5: Verify + Commit** — `npm run verify` green; `git add frontend/components/mosques/MosqueRow.tsx frontend/__tests__/components/mosque-row.contract.test.tsx && git commit -m "feat(mosques): add glass MosqueRow with distance·direction + directions chip"`

---

## Task 5: `MosqueSheet` component

**Files:**
- Create: `frontend/components/mosques/MosqueSheet.tsx`
- Test: `frontend/__tests__/components/mosque-sheet.contract.test.tsx`

The `@gorhom/bottom-sheet` host: snap points, glass background, header, and a `BottomSheetFlatList` of `MosqueRow`s (up to 10). Computes each row's distance + direction from the user location via `utils/geo.ts`.

**Component contract:**
```ts
type MosqueSheetProps = {
  mosques: Mosque[];                       // already-loaded list
  userLoc: { latitude: number; longitude: number } | null;
  selectedId: string | null;
  onSelect: (m: Mosque) => void;           // row tap → parent recenters + sets selected
  onDirections: (m: Mosque) => void;
  bottomInset: number;                     // clearance above the floating tab bar
};
```
Implementation notes:
- `import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";`
- `snapPoints = useMemo(() => ["18%", "50%", "92%"], [])`; `<BottomSheet index={1} snapPoints={snapPoints} bottomInset={bottomInset} enablePanDownToClose={false} backgroundStyle={...} handleIndicatorStyle={...}>`.
- `backgroundStyle`: `{ backgroundColor: theme.materials.chrome.fill, borderTopLeftRadius: 22, borderTopRightRadius: 22 }` plus a hairline top border via `borderColor: theme.materials.chrome.border`; `handleIndicatorStyle: { backgroundColor: withOpacity(colors.white, 0.3), width: 38 }`.
- Data: `const rows = useMemo(() => mosques.slice(0, 10), [mosques])`. (Showing up to 10 — design decision 04.)
- Header (`ListHeaderComponent`): a non-scrolling `View` with `Headline` "{rows.length} mosques nearby" and a dim `Caption` "Nearest {formatDistanceShort(min distance)}" when `userLoc` present.
- Each row: compute `const km = userLoc ? distanceKm(userLoc.latitude, userLoc.longitude, m.lat, m.lng) : null;` then `formatDistanceShort(km)` and `cardinal(bearingDeg(userLoc…, m.lat, m.lng))`. Sort rows by distance ascending when `userLoc` present (matches "Nearest" framing — today's API already returns near-sorted; sorting here is presentational).
- `keyExtractor={(m) => m.id}`. Pass `selected={m.id === selectedId}`.
- Respect Reduce Motion implicitly (gorhom default springs are fine). Do not animate opacity of the sheet background.

- [ ] **Step 1: Write the failing test** — `frontend/__tests__/components/mosque-sheet.contract.test.tsx` (gorhom is globally mocked in `jest.setup.ts`, so `BottomSheetFlatList` renders as a `FlatList` with the header):

```tsx
import { render } from "@testing-library/react-native";
import MosqueSheet from "@/components/mosques/MosqueSheet";
import type { Mosque } from "@/services/getNearbyMosques";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
    FontAwesome5: ({ name }: { name: string }) => <Text>{`fa:${name}`}</Text>,
  };
});
jest.mock("@/components/PressableScale", () => {
  const { Pressable } = require("react-native");
  return ({ children, ...p }: any) => <Pressable {...p}>{children}</Pressable>;
});

const mosques: Mosque[] = [
  { id: "1", name: "Masjid Al-Noor", address: "120 Cedar St", lat: 41.89, lng: -87.63 },
  { id: "2", name: "Islamic Center", address: "88 Maple Ave", lat: 41.90, lng: -87.64 },
];

it("renders the nearby count header and a row per mosque", () => {
  const { getByText } = render(
    <MosqueSheet
      mosques={mosques}
      userLoc={{ latitude: 41.881, longitude: -87.623 }}
      selectedId={null}
      onSelect={jest.fn()}
      onDirections={jest.fn()}
      bottomInset={80}
    />,
  );
  expect(getByText("2 mosques nearby")).toBeTruthy();
  expect(getByText("Masjid Al-Noor")).toBeTruthy();
  expect(getByText("Islamic Center")).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- --runTestsByPath __tests__/components/mosque-sheet.contract.test.tsx` → FAIL.
- [ ] **Step 3: Implement `MosqueSheet.tsx`** per the contract/notes above.
- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Verify + Commit** — `npm run verify` green; `git add frontend/components/mosques/MosqueSheet.tsx frontend/__tests__/components/mosque-sheet.contract.test.tsx && git commit -m "feat(mosques): add gorhom MosqueSheet (snap points, list, header)"`

---

## Task 6: Rewrite `app/(tabs)/Mosques.tsx` + update screen contract test

**Files:**
- Modify (rewrite): `frontend/app/(tabs)/Mosques.tsx`
- Modify: `frontend/__tests__/screens/nearby-mosques.contract.test.tsx`

The map host. **Preserve all data/permission logic** from today's file (location gate branches, `checkStatus`, `requestPermissionAndLoad`, cached-first → fresh fetch, error `Alert`s, `openDirections`). Replace the **presentation** (header + top-3 list + map-preview + `openFullMap`) with: full-bleed map + markers + `MosqueSheet` + search-this-area + recenter + map↔list sync. Distance/format helpers now come from `@/utils/geo` (remove the local copies).

**Structure:**
```tsx
// state additions
const mapRef = useRef<MapView>(null);
const sheetRef = useRef<BottomSheet>(null);   // optional, for programmatic snap
const [selectedId, setSelectedId] = useState<string | null>(null);
const [region, setRegion] = useState<Region | null>(null);
const [showSearchArea, setShowSearchArea] = useState(false);
const insets = useSafeAreaInsets();
const tabBarClearance = Math.max(insets.bottom, 14) + 6 + 64 + 8; // sheet bottomInset (above floating tab bar)
```
- **Map (background, full-bleed):** `<MapView ref={mapRef} style={StyleSheet.absoluteFill} customMapStyle={customMapStyle} userInterfaceStyle={theme.name==="light"?"light":"dark"} showsUserLocation initialRegion={...from location} onRegionChangeComplete={(r)=>{setRegion(r); setShowSearchArea(true);}} >` with `{mosques.slice(0,10).map(m => <MosqueMarker key={m.id} mosque={m} selected={m.id===selectedId} onPress={()=>onSelectMosque(m)} />)}`. (Render markers for the shown set.)
- **Sheet:** `<MosqueSheet mosques={mosques} userLoc={location} selectedId={selectedId} onSelect={onSelectMosque} onDirections={(m)=>openDirections(m.lat,m.lng)} bottomInset={tabBarClearance} />`.
- **`onSelectMosque(m)`** = `haptic("light"); setSelectedId(m.id); mapRef.current?.animateToRegion({ latitude:m.lat, longitude:m.lng, latitudeDelta:0.02, longitudeDelta:0.02 }, 350);` (tap pin → also `sheetRef.current?.snapToIndex(1)` so the focused card is visible).
- **Search-this-area chip:** floating glass chip (Tier-1 `GlassSurface`) near top center, visible when `showSearchArea`; on press → `setShowSearchArea(false)` + re-fetch `getNearbyMosques(region.latitude, region.longitude)` (reuse the existing fetch/setMosques + error handling pattern from today's `handleSearchThisArea` in `MosqueMap.tsx`).
- **Recenter button:** small Tier-1 glass circular button (Ionicons `locate`) anchored bottom-right above the sheet's Half line; on press → `animateToRegion` back to `location`.
- **Loading / fetchingFresh:** keep a small spinner overlay as today.
- **Location gate:** keep all branches and copy; render the gate as a centered Tier-2 `GlassSurface` card over a dimmed map/canvas (no functional change). Keep `InfoBanner` and CTAs.
- **Empty state:** when `!fetchingFresh && mosques.length===0`, the sheet header reads e.g. "No mosques nearby" and the body shows the existing empty message **"No mosques found near your current location."** (keep this exact string — the contract test asserts it).
- **Remove:** `openFullMap`, `openingMap`, the `MapPreview` `TouchableOpacity`, the top-3 `FlatList`, `router.push("../MosqueMap")`, and `SkeletonList`/`ShimmerCard` if unused (or keep a loading state inside the sheet). Keep `handleTabBarScroll`? Not needed for a map-first screen — drop the scroll wiring (no list scroll on the map background).
- **Imports:** add `MapView, { Region }` from `react-native-maps`, `BottomSheet` type from `@gorhom/bottom-sheet` (for the ref), `MosqueMarker`, `MosqueSheet`, `distanceKm`/`formatDistanceLabel` from `@/utils/geo`; remove the now-unused `Aurora`/`LinearGradient` usage for the main screen (the map is the background) — keep them only if still used by the gate.

**Screen contract test update** (`nearby-mosques.contract.test.tsx`): the data-flow assertions stay valid (mosque names still render in the sheet list; the empty + error strings are preserved). Update only the **rendering plumbing**:
- The global gorhom mock (Task 2) means no per-file gorhom mock is needed; ensure the existing `react-native-maps` mock still covers `MapView`/`Marker` (it does — keep it) and add `Region` is type-only.
- Keep `expo-location`, `getNearbyMosques`, theme, icons, safe-area, haptics mocks.
- The assertions `queryAllByText("Cached Masjid")`, `"Fresh Masjid"`, `"No mosques found near your current location."`, and the error `Alert.alert("Error","Failed to load nearby mosques.")` should all still pass. Adjust queries only if the new tree changes how text is wrapped (e.g. still `queryAllByText`).

- [ ] **Step 1: Update the screen contract test** for the new tree (keep the three data behaviors; remove any assertion that depended on the top-3 list / map-preview / navigation if present). Run it → expect FAIL against the old implementation (red).
- [ ] **Step 2: Rewrite `Mosques.tsx`** per the structure above; preserve data/permission logic verbatim where possible.
- [ ] **Step 3: Run the screen test** — `npm test -- --runTestsByPath __tests__/screens/nearby-mosques.contract.test.tsx` → PASS (cached→fresh, empty, error).
- [ ] **Step 4: Verify** — `npm run verify`. The two flow tests (`nearby-list-to-map`, `nearby-mosques-refresh`) may now fail — that is expected and fixed in Task 7. Confirm everything else is green and typecheck/lint pass.
- [ ] **Step 5: Commit** — `git add frontend/app/\(tabs\)/Mosques.tsx frontend/__tests__/screens/nearby-mosques.contract.test.tsx && git commit -m "feat(mosques): rewrite Mosques tab as map-first with bottom sheet"`

---

## Task 7: Retire `MosqueMap`, rework flow tests, docs, final verify

**Files:**
- Delete: `frontend/app/MosqueMap.tsx`
- Modify: `frontend/app/_layout.tsx` (remove the `MosqueMap` `Stack.Screen`)
- Modify/Delete: `frontend/__tests__/flows/nearby-list-to-map.flow.test.tsx`
- Modify: `frontend/__tests__/flows/nearby-mosques-refresh.flow.test.tsx`
- Modify: `frontend/__tests__/README.md`

- [ ] **Step 1: Delete the screen + route** — `git rm frontend/app/MosqueMap.tsx`. In `frontend/app/_layout.tsx` remove the block:
```tsx
<Stack.Screen
  name="MosqueMap"
  options={{ animation: "fade", animationDuration: 300 }}
/>
```
Search the repo for any remaining `MosqueMap` references (`grep -rn "MosqueMap" frontend --include="*.ts*"`) and remove them. `.expo/types/router.d.ts` is generated — leave it (regenerates on next `expo start`); ensure no hand-written code imports the route.

- [ ] **Step 2: Rework `nearby-list-to-map.flow.test.tsx`** — this asserted navigation from the list to the separate map screen, which no longer exists. Re-target it to the fused behavior: tapping a mosque row recenters/selects (assert `onSelect`/marker selected state via a spy on the maps mock or the sheet), OR if it only tested navigation, delete the file. If kept, rename to reflect new behavior (e.g. `nearby-select-recenter.flow.test.tsx`). Whatever you choose, it must pass and meaningfully test behavior (not mocks).

- [ ] **Step 3: Adapt `nearby-mosques-refresh.flow.test.tsx`** — point "refresh" at the in-screen **Search this area** affordance (find the chip by `accessibilityLabel`, press it, assert `getNearbyMosques` re-called with the panned region and the list updates). Keep its existing mock scaffolding.

- [ ] **Step 4: Update `__tests__/README.md`** — reflect: added `utils/geo.test.ts`, `components/mosque-row.contract`, `components/mosque-sheet.contract`; changed `screens/nearby-mosques.contract`; renamed/removed the list-to-map flow; changed the refresh flow.

- [ ] **Step 5: Final verify** — `npm run verify` → fully green (lint + typecheck + all jest). Also confirm `grep -rn "MosqueMap" frontend --include="*.ts*"` returns nothing (router.d.ts aside).
- [ ] **Step 6: Commit** — `git add -A && git commit -m "refactor(mosques): retire MosqueMap screen, rework mosque flow tests + docs"`

---

## Self-review (plan author)

- **Spec coverage:** map-first (T6), gorhom sheet + snap points + default Half (T5/T6), 10 mosques (T5), no drag-hint text (T5 handle-only), compass direction (T1/T4/T5), map↔list sync (T6), search-this-area (T6), recenter (T6), retire MosqueMap (T7), GestureHandlerRootView (T2), location-gate parity (T6), tests + README (T1,4,5,6,7). All covered.
- **Type consistency:** `Mosque` shape from `@/services/getNearbyMosques`; geo signatures used identically across T4/T5; `MosqueRow`/`MosqueSheet`/`MosqueMarker` prop names consistent.
- **Green-tree discipline:** T1–T5 are additive (suite stays green each commit). T6 rewrites the screen + its contract test together. T7 is the only window where the two flow tests are red (flagged in T6 Step 4) and is closed in the same plan. Final state green.
- **No placeholders:** geo code, test cases, gorhom config, sync handlers, mock code all concrete; styling defers to named tokens + reference components (PrayerArc/DuaResultCard) the implementer reads.
