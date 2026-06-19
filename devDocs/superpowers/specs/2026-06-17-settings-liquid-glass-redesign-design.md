# Settings — Liquid Glass Redesign (Design Spec)

**Date:** 2026-06-17
**Status:** Approved design — ready for implementation planning
**Scope:** Full redesign of the Settings screen (`app/Settings.tsx`) and the components it owns, onto the established liquid-glass design language. This is a visual **and UX** pass — bad interaction patterns are replaced, not reskinned.

Builds on: `2026-06-16-visual-refresh-liquid-glass-design.md` (foundations: tokens, `GlassSurface`, Text ramp, `Screen`, motion, haptics) and the redesigned Home / Calendar / Qibla screens.

---

## 1. Goal

Bring Settings in line with the rest of the app: grouped glass cards, the iOS type ramp, real materials, haptics, and calm motion — while **fixing the interaction patterns that are actually bad**, not just repainting them. Behavior of prayer-time calculation, permissions, and notification scheduling is preserved.

## 2. Problems in the current screen (diagnosis)

- **`react-native-dropdown-picker`** drives both Theme and Calculation Method — a heavy third-party lib stacked with `zIndex: 3200/3000/2900` + `elevation` hacks, `listMode="SCROLLVIEW"`, and manual scale animations. Fragile and un-iOS.
- **Theme is a text dropdown** — themes are inherently visual, but the user can't see them before choosing.
- **No glass / no shared primitives** — hand-rolled `LinearGradient` + `withOpacity(primaryDeep, 0.4)` cards with gold borders. Doesn't use `Screen`, `GlassSurface`, the Text ramp, `useHaptics`, or `PressableScale`.
- **Loose, ungrouped sections** float directly on the gradient — no iOS-style inset grouped cards.
- **The notifications "master switch" never switches** — it always opens System Settings. A toggle that doesn't toggle misleads.
- **No close affordance** — Settings is a `presentation: "modal"` sheet with `headerShown: false`; the only way out is an undiscoverable swipe-down.
- **Fragile `maxHeight: 170` animation** gates the manual-city block.
- **Thin About** — a single "Visit our site" link; no version, privacy, rate, share, or feedback.

## 3. Locked decisions

| # | Area | Decision |
|---|------|----------|
| 01 | Scaffold | Adopt shared `<Screen safeArea={false}>` + full-bleed `ScrollView` with insets-as-padding (per CLAUDE.md scrollable rule). |
| 02 | Grouping | iOS-style **grouped glass cards**: an uppercase gold section label above a `GlassSurface tier="card"` containing hairline-divided rows. |
| 03 | Theme picker | Replace dropdown with a **3-up visual swatch picker** (Default / Dark / Light), each a mini gradient preview + accent dot; gold ring marks the active theme. |
| 04 | Method picker | Replace dropdown with a **tap-row → centered glass picker dialog** (checkable list, no search; 6 methods). |
| 05 | City picker | Reskin `CitySearchModal` onto the **same shared glass picker dialog** (search enabled). Drop the per-call `cityModalColors` light-mode override. |
| 06 | Notifications master | Reframe the fake Switch into a **row**: "Notifications · Managed in System Settings", trailing status (On/Off) + chevron; tap opens System Settings. |
| 07 | Close affordance | Add a **glass ✕ chip** (Tier-1, 40×40, top-right) calling `router.back()`. Native sheet drag-dismiss remains. |
| 08 | About | Add **Rate · Share · Privacy Policy · Send Feedback · Visit website** rows + a muted **version footer**, all via already-installed libs. |
| 09 | Icons | **Ionicons** via `@expo/vector-icons` (matches the rest of the redesign; no emoji, no new icon system). |
| 10 | Dependency | Remove `react-native-dropdown-picker` usage entirely (Settings is its only consumer) and drop the dependency. |

## 4. Information architecture

Modal sheet, top-down:

1. **Header** — grabber (visual) · eyebrow "PREFERENCES" + `LargeTitle` "Settings" · glass ✕ close chip (right).
2. **APPEARANCE** card
   - Theme swatch picker (3-up).
   - "Match app icon to theme" row — iOS-only, shown only when the live icon ≠ selected theme; trailing "Apply" (preserves current opt-in behavior; iOS shows its own confirm alert).
3. **PRAYER TIMES** card
   - Calculation Method — row, trailing current value + chevron → opens picker dialog.
   - Use my location — row, trailing `Switch` (permission flow unchanged).
   - Manual city — row, **rendered only when location is off** (replaces the maxHeight animation), trailing current city + chevron → opens city picker.
4. **NOTIFICATIONS** card (`NotificationSettings`, restyled)
   - Master row (reframed, see §3-06). `ActivityIndicator` while loading preserved.
   - Per-prayer alert rows (Fajr/Dhuhr/Asr/Maghrib/Isha) — restyled glass toggle rows; revealed only when enabled (existing behavior).
   - Adhan sound segmented control (Silent / Beep / Adhan) + preview — restyled.
5. **ABOUT** card — Rate · Share · Privacy Policy · Send Feedback · Visit website rows.
6. **Footer** — "Sirat {version}", centered, muted.

## 5. New components & primitives

All themed via `useTheme()` + `createStyles(theme)`; all glass via `GlassSurface`; all text via the Text ramp.

### `components/settings/SettingsSection.tsx`
Group wrapper. Props: `{ label: string; children }`. Renders the uppercase gold section label (`Caption`, accent, letterSpacing) + a `GlassSurface tier="card" radius={radii.card}` containing children. Children rows self-divide with a top hairline (skip first).

### `components/settings/SettingsRow.tsx`
The workhorse row. Props:
```ts
type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;      // leading glyph (gold, in a tinted tile)
  title: string;
  subtitle?: string;
  onPress?: () => void;                        // wraps in PressableScale + haptics("selection")
  trailing?: ReactNode;                        // value text / chevron / Switch / pill
  value?: string;                              // convenience: muted value text
  showChevron?: boolean;
  disabled?: boolean;
  first?: boolean;                             // suppress top divider
  accessibilityLabel?: string;
};
```
Layout: 30×30 rounded gold-tinted icon tile · title (+optional subtitle) · trailing slot. Min height 56, `paddingVertical: spacing.md`, `paddingHorizontal: spacing.lg`. Pressable rows scale on press (`PressableScale`) and fire `haptics("selection")`.

### `components/settings/ThemePicker.tsx`
3-up swatch row. Reads `themeName` + `setTheme` from `useTheme()`. Each card: mini gradient preview (`primaryDeep → primaryLift` of that theme) + accent dot (that theme's `accent`) + label. Active card: gold ring (`accent` border) + tinted fill. Tap → `setTheme(name)` + `haptics("selection")`. Theme definitions sourced from `themeMap` so previews stay truthful if palettes change.

### `components/settings/PickerDialog.tsx`
Shared **centered glass picker** (replaces both the dropdown and the hand-rolled `CitySearchModal` card). Props:
```ts
type PickerDialogProps<T> = {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: { label: string; value: T }[];
  selected?: T;                  // shows a trailing checkmark
  searchable?: boolean;          // city: true, method: false
  onSelect: (value: T) => void;
  onClose: () => void;
};
```
RN `Modal` (transparent, fade) → dimmed backdrop → `GlassSurface tier="card" radius={radii.cardLg}` card (maxHeight ~70% screen). Header (title/subtitle + ✕). Optional debounced search (reuse the existing keyboard-inset + debounce logic from `CitySearchModal`). `FlatList` of rows; selected row shows an accent checkmark. `haptics("selection")` on select.
- **City picker:** `searchable`, items = `cityItems`.
- **Method picker:** not searchable, items = `methodItems`, `selected = method`.
`CitySearchModal` is reimplemented as a thin wrapper over `PickerDialog` (or replaced at the call site) preserving its public props so nothing else breaks.

### `utils/appLinks.ts`
About-row actions + version, isolated and unit-testable:
```ts
getAppVersion(): string                 // Constants.expoConfig?.version ?? "—"
openWebsite(): Promise<void>            // Linking → https://sirat.dev
openPrivacy(): Promise<void>            // Linking → https://sirat.dev/privacy
shareApp(): Promise<void>              // RN Share.share({ message, url })
sendFeedback(): Promise<void>          // Linking → mailto:<FEEDBACK_EMAIL>
rateApp(): Promise<void>               // Linking → APP_STORE_REVIEW_URL (graceful no-op if unset)
```
Targets live in a single `APP_LINKS` const block (website, privacy URL, feedback email, App Store id/url). All wrapped in try/catch (best-effort, never throw into the UI).

## 6. Changed / removed

**Changed**
- `app/Settings.tsx` — rebuilt on `Screen` + `SettingsSection`/`SettingsRow` + `ThemePicker` + pickers + restyled `NotificationSettings`. Removes all `DropDownPicker` usage, the `cityModalColors` override, and the inline `VisitSiteButton` (now an About row). Adds the close chip + version footer.
- `components/CitySearchModal.tsx` — reimplemented over `PickerDialog` (glass), same props.
- `components/NotificationSettings.tsx` + `utils/notifications/styles.ts` — restyle to the section/row/segment glass language; master Switch → reframed row. Notification logic (prefs, sound mode, preview, OS mirroring) unchanged.
- `hooks/useSettingsDropdowns.ts` — gutted: remove dropdown open/scale state and `methodScaleStyle`/`themeScaleStyle`. Keep only what survives (method/theme item lists move to where they're consumed; press feedback handled by `PressableScale`). Likely deleted and its remnants inlined; revisit in the plan.

**Removed**
- `react-native-dropdown-picker` import sites and the dependency from `frontend/package.json`.

**Unchanged (explicitly preserved)**
- `usePrayerSettingsState` (persistence, `settingsChanged` emit, `clearPrayerCache`), `useSettingsPermissions` (location/notif permission flow, AppState refresh, alerts), `appIcon` service behavior, all AsyncStorage keys, calculation-method ids (incl. `-1 = Auto`).

## 7. Motion & haptics

- **Entrance:** rely on the native modal slide-up. Avoid per-card opacity entrance on glass (animating a glass parent's opacity stops it rendering — foundations risk #41024). If any entrance flourish is added, it is **translateY-only** on non-glass wrappers.
- **Press:** `PressableScale` (scale → 0.97, gentle spring) on every interactive row, theme card, picker row, and the close chip.
- **Selection highlight:** theme ring / picker checkmark transitions are cheap (color/scale), never glass opacity.
- **Haptics** (`useHaptics`): `selection` on theme select, method/city select, row taps, and close; `light` on the location toggle; existing notification haptics retained.

## 8. External values

All resolved:
- **Feedback email:** `yassinbenelhajlahsen@gmail.com` (mailto target for Send Feedback).
- **Privacy URL:** `https://sirat.dev/privacy`.
- **Bundle identifier:** `com.yassinbenelhajlahsen.sirat`.
- **App Store ID:** `6753838183` ("Sirat — The Path to Your Deen"). Rate deep-link: `itms-apps://apps.apple.com/app/id6753838183?action=write-review` (https fallback if the scheme can't open). Still wrapped in try/catch so a failed open never throws into the UI.

## 9. Testing

- `npm run verify` (lint + typecheck + test) green.
- Update `frontend/__tests__/README.md` for added/removed suites.
- **Update** `notification-settings.contract.test.tsx` — the master control is no longer a `Switch` (role change to a button row).
- Verify `usePrayerSettingsState` / `useSettingsPermissions` tests still pass (logic untouched).
- Check `screen-contracts.test.tsx` — Settings mock surface (no `DropDownPicker`).
- New lightweight contract tests for `SettingsRow`, `ThemePicker`, `PickerDialog`, and `utils/appLinks`.
- Manual QA across **all 3 themes**; on-device glass + fallback (Android / older iOS / Reduce Transparency).

## 10. Out of scope

- No changes to prayer-time math, notification scheduling, permission logic, or theme palette values.
- No new themes, no new screens.
- No migration to `@gorhom/bottom-sheet` for the pickers (centered glass dialog chosen for consistency with the existing city picker and to avoid sheet-in-modal nesting).
- Other screens, the tab bar, and shared cards outside Settings.

## 11. Risks

- **Glass + modal:** `GlassSurface` already gates on `isGlassEffectAPIAvailable()` and falls back to translucent solid — safe inside the modal. Don't animate glass opacity.
- **Picker refactor blast radius:** mitigated — `CitySearchModal` has a single consumer (Settings). Keep its prop shape to be safe.
- **Notification contract test:** will need updating for the master-row change — expected, called out in §9.
- **External links:** Rate/Feedback depend on §8 inputs; guard with graceful no-ops so a missing value never ships a dead button.
