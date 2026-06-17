# Quran Page — Liquid Glass Redesign (Design Spec)

**Date:** 2026-06-17
**Status:** Approved design — ready for implementation planning
**Parent spec:** `plans/2026-06-16-visual-refresh-liquid-glass-design.md` (§6 "Quran")
**Scope:** Visual/UX refresh of the Quran feature only. **No behavior, logic, data, audio, or Arabic-rendering changes.**

---

## 1. Goal

Bring the Quran page into the Liquid Glass design language already shipped on Home and Mosques, and give the *reader itself* a genuine qualitative lift (flowing verses, live glass header, surah banners, motion). Every other Quran surface adopts the glass language for **cohesion** — deliberately a polished version of what exists, not a reinvention. Pickers/modals are utility surfaces; novelty there would hurt usability.

## 2. Locked ambition

| # | Decision |
|---|----------|
| 01 | **Reader gets the lift**; navigator + all modals adopt the glass language for cohesion only. |
| 02 | Ayah presentation = **flowing reading surface** (no per-ayah boxes), hairline + ❖ dividers, inline gold ﴿n﴾ markers. No "currently reading" box. |
| 03 | **Persistent compact glass header** that always reflects the current scroll position (not a collapsing large-title; not "big for sūrah 1 only"). |
| 04 | All modals (navigator, bookmark editor, display settings, copy) become the **swipe-up liquid-glass bottom sheet** family — standardized on the project's `@gorhom/bottom-sheet` setup (the Mosques `MosqueSheet` pattern), with drag + pan-down-to-close. This replaces the current `Modal` + `useModalTransition` approach on the navigator/bookmark/display surfaces. |
| 05 | Home & Mosques are the **reference** — already migrated, untouched. |
| 06 | Restyle-only. No invented content (no "Meccan"/verse-count/basmala unless it already exists in the data/UI). |

## 3. Foundations reused (already built)

From `frontend/components/ui/` and `frontend/constants/`:

- **`GlassSurface`** (`tier="chrome" | "card" | "row"`, `radius`) — the only place glass logic lives; gates on `isGlassEffectAPIAvailable()`, falls back to translucent-solid.
- **Typed `Text`** — `LargeTitle`/`Title1-3`/`Headline`/`Body`/`Callout`/`Subhead`/`Footnote`/`Caption`.
- **`Screen`** — gradient + `Aurora` scaffold (`safeArea` prop).
- **`Aurora`** — per-theme radial blooms.
- **`theme`** — `colors`, `typography` ramp, `spacing` (incl. `xxxl`/`huge`), `radii` (`chip 10`/`row 14`/`card 18`/`cardLg 20`/`hero 24`/`heroLg 26`/`pill 999`), `materials` (chrome/card/row glass tiers, light/dark aware).
- **`constants/motion.ts`** — `PRESS_SCALE 0.97`, `SPRING_PRESS`, `SPRING_GENTLE`, `TIMING_ENTER 480`, `TIMING_EXIT 320`, `BREATH_HALF_CYCLE 2300`, `STAGGER_MS 70`.
- **`hooks/useHaptics.ts`** — `selection | light | medium | success | error` (gated by setting + Reduce Motion).
- **`PressableScale`** — standard press-scale wrapper.
- **Bottom sheet** — reuse the `@gorhom/bottom-sheet` setup from `components/mosques/MosqueSheet.tsx` (`SheetBackground` = static `GlassView`/solid fallback + animated gradient overlay; never animate glass opacity).

## 4. Per-surface design

### 4.1 Reader screen — `app/(tabs)/Quran.tsx`

- Full-bleed `Screen`/gradient + `Aurora` background. FlashList of all ayahs stays full-bleed; safe areas applied as padding (per CLAUDE.md scrollable-screen rule): `contentInsetAdjustmentBehavior="never"`, `paddingBottom: insets.bottom + tab/player clearance`. The persistent header carries `paddingTop: insets.top`.
- No per-ayah card backgrounds. Verses flow directly on the gradient.
- Between verses: a slim **divider** — `flex:1` hairline (`white@~0.16`) on each side of a small gold ❖ ornament (`accent`, low opacity). Reuses/relocates the spacing of today's `container marginBottom`.

### 4.2 Ayah block — `components/quran/QuranAyahCard.tsx`

Restyle only; **all interaction handlers, timings, and accessibility unchanged.**

- Remove `ayahCard` box (bg/border/shadow/radius) and the top-right `surahTag` pill. The ayah number is shown **inline** as a gold ﴿n﴾ marker at the end of the Arabic line (use the existing `ayah.ayahNumber`).
- Arabic / transliteration / translation `Text` blocks: keep current font sizes, line-heights, `allowFontScaling={false}`, `includeFontPadding={false}`, `textBreakStrategy`, RTL/`writingDirection`. (Hands-off rendering.)
- **Bookmark badge: kept exactly** — `Ionicons name="bookmark"` in `themeColors.danger`, in the dark circular badge, pinned top-left of the verse block (`bookmarkBadge` style preserved; only its parent changes from a card to a flowing block).
- Press feedback: keep `holdScale` spring + the brief double-tap feedback (`isDoubleTapFeedbackVisible`). With no card frame, feedback reads as a subtle scale/opacity on the block.
- Migrate the inline `Haptics`/raw spring usage toward `useHaptics`/`motion.ts` presets where trivial, without changing felt behavior.

### 4.3 Surah banner — extracted from `QuranAyahCard` surah-divider (`isSurahStart`)

- Restyle of the existing `surahDividerRow`. Centered banner: gold ❖ accent rule, **Arabic surah name** large (`accent`), **English surah name** below (uppercase, `Caption`/`Subhead`). Only `arabicName` + `englishName` — no added fields. Basmala intentionally omitted (not in current divider).
- Extract to a small `components/quran/SurahBanner.tsx` so the reader and the divider logic stay focused (improves the 301-line card file).

### 4.4 Persistent header — `Quran.tsx` header block

Replaces the current `"Quran"` title + `headerSubsection` + `capsuleBar`.

- A thin **Tier-1 glass bar** that **overlays** the top of the full-bleed list (absolute, high z-index) so it refracts the verses scrolling under it — the list gets top content padding ≈ header height + `insets.top` (this changes today's non-overlapping header-above-list layout). Always shows the **current** sūrah + position, driven by the existing `currentSurahMeta` / `currentAyah` scroll tracking:
  - Line 1: `englishName` + `arabicName` (gold).
  - Line 2 (gold): `Ayah {currentAyah.ayahNumber} · Juzʾ {currentAyah.juzNumber}`.
- Controls (right, glass chrome circular buttons), preserving today's actions and states:
  - **Play/pause** — gold/primary button; `audioIconName`, long-press `stopAudio`, disabled while `isAudioLoading`; **Offline** state (`offlinePillVisible`) restyled as a glass pill with `cloud-offline-outline`.
  - **Navigate** — opens the navigator (`openNavigator("goto")`). Icon replaces the old "Navigate" text capsule.
  - **Aa** — opens Display Text settings (`setDisplaySettingsOpen(true)`).
- No bookmark icon (bookmarks reached via the navigator).

### 4.5 Mini player — `components/quran/QuranMiniPlayer.tsx` (+ `QuranMiniPlayerPortal.tsx`)

- Tier-1 **glass chrome bar**, docked above the tab bar (keep `useSafeAreaInsets` bottom padding + portal positioning).
- Gold play/pause button (matches header), subtle `white@0.1` stop button, thin `accent` progress fill on a `white@0.18` track. Surah name + remaining time on the left.
- Same controls/state from `QuranAudioProvider`. Portal wrapper unchanged structurally.

### 4.6 Navigator — `components/quran/navigator/*`

Convert from centered `Modal` to a **swipe-up liquid-glass bottom sheet** (reuse `MosqueSheet`'s `SheetBackground`).

- Grab handle, "Navigate" title, search field (`white@0.05` glass row, magnifier icon, placeholder `"Search verses or 2:255"`).
- **Segmented control replaces the 2 tabs**: `Sūrah · Juzʾ · Bookmarks` (gold active segment, dark text). Juzʾ is promoted from the `showJuzGrid` toggle inside `SurahTab` to a peer segment that renders the existing `JuzTab` grid. Underlying selection handlers (`onSelectSurah/onSelectAyah/onSelectJuz/onSelectBookmark`) and both search-query states are reused unchanged.
- **Sūrah** segment: glass `row`-tier grid tiles — number (gold), `englishName`, `arabicName` (gold), `Surah {n} · {ayahCount} ayāt`. Keep the 2/3-column responsive `numColumns`. Verse-match results section retained.
- **Juzʾ** segment: existing 30-item grid as glass tiles.
- **Bookmarks** segment: glass `row` items (gold bookmark glyph circle, title, `surah:ayah · Juzʾ`, optional note). **Swipe-to-delete kept** — wire the `react-native-gesture-handler` Swipeable inside the sheet with `activeOffsetX` so horizontal row swipes don't fight the sheet's vertical drag.
- Sheet opens at a large snap point; `enablePanDownToClose`.

### 4.7 Bookmark editor — `components/quran/QuranBookmarkModal.tsx`

- Becomes a compact bottom sheet. Handle, **"New Bookmark"** + **"Save this ayah for quick return"**, title input (placeholder = existing `defaultTitleFallback || "Bookmark title"`), note input (`"Add an optional note"`), gold **Done** button (`"Saving…"` while submitting). Inputs as glass rows.
- Keyboard: replace `KeyboardAvoidingView` with the sheet's keyboard handling (`keyboardBehavior`/`keyboardBlurBehavior`). Submit/validation logic unchanged.

### 4.8 Display Text settings — `components/quran/QuranDisplaySettingsModal.tsx`

- Compact bottom sheet. Handle, **"Display Text"**, **"Select which text to show"**, three toggle rows: **Arabic · English · Transliteration** (existing `DISPLAY_MODE_OPTIONS`). Keep the checkbox semantics, restyled as glass rows with a gold-filled check affordance. Toggle wiring via `useQuranDisplayModes` unchanged.

### 4.9 Copy sheet — `components/quran/QuranCopySheet.tsx`

- Currently a `Modal`-based slide-up card; move it onto the same `@gorhom/bottom-sheet` + shared glass-sheet background as the rest. Handle, `{title}` (the `surah:ayah` ref), **"Copy ayah text"**, rows **Copy Arabic / Copy Transliteration / Copy English / Copy All** (conditional on enabled modes; "Copy All" emphasized in gold). `formatCopyText` + success haptic unchanged.

### 4.10 Completion card — `components/quran/QuranCompletionCard.tsx`

- Convert the ad-hoc `white@0.04` panel to a proper **Tier-2 `GlassSurface` card** (`radii.card`) with `accent` ornament, using the type ramp. Content unchanged.

### 4.11 Copy toast — `components/CopyToast.tsx` (shared)

- Restyle the confirmation toast to a small glass chrome pill with the type ramp. Appears after copy on this page (and anywhere else it's used — change is shared but visual-only).

## 5. New / changed shared pieces

- **`components/quran/SurahBanner.tsx`** (new) — extracted surah banner (§4.3).
- **Shared glass-sheet background** — factor `MosqueSheet`'s `SheetBackground` into a reusable helper (e.g. `components/ui/SheetBackground.tsx`) so navigator/bookmark/display/copy don't each re-implement glass + animated gradient overlay. (Refactor only; behavior identical.)
- No new state, services, hooks, or data files.

## 6. Motion & haptics

- Verse list: content entrance fade + slide-up with `STAGGER_MS`, `TIMING_ENTER`, respecting Reduce Motion (fall back to plain fade/none).
- Press feedback via `PRESS_SCALE`/`SPRING_PRESS`. No breathing/ring elements added to the reader (no "currently reading" indicator).
- Haptics via `useHaptics`: `light` on bookmark/select/long-press, `success` on copy, `selection` on segment change. Gated by setting + Reduce Motion.
- **Never animate glass opacity** (parent or child). Sheets animate the gradient overlay, not the `GlassView`.

## 7. Theming

- All three themes (`default`, `dark`, `light`) via `useTheme()` + `createStyles(theme)`. No static colors.
- Glass over the **light** theme uses dark tints (handled by `materials`); fallbacks must carry their own contrast (Reduce Transparency may be on even when glass is available).
- `Aurora` colors are per-theme; the reader inherits them through `Screen`.

## 8. Behavior preservation contract (must remain identical)

- Double-tap an **un**-bookmarked ayah → open bookmark editor; double-tap an **already-bookmarked** ayah → open navigator on the **Bookmarks** segment (`openNavigator("bookmarks")`), *not* a new editor (`Quran.tsx:1101-1116`).
- Long-press an ayah → copy sheet + `light` haptic; copy → `success` haptic.
- Header play/pause toggling, long-press-to-stop, loading-disabled, and offline states.
- Navigator selection → `scrollToAyahIndex`; "Go To"/verse search parsing; juz selection; bookmark search; swipe-to-delete.
- Display-mode toggles and the scroll-anchoring that preserves view position on toggle.
- Resume-on-open (last-read index/position), preload requirements.

## 9. Out of scope / hands-off

- All `services/` (`quranData`, `quranBookmarks`, `quranProgress`, `quranDisplayModes`, `quranCopyText`), `context/QuranAudioProvider`, and Quran hooks — logic untouched.
- Arabic text rendering internals (RTL, line-height, markers, font padding).
- Deep mushaf/page rendering, kashida justification — separate feature project (parent spec §7).
- Home, Mosques, and shared app shell (tab bar, etc.) — already migrated; only `CopyToast` (shared) is touched, visually.
- No new features, routes, or behavioral changes.

## 10. Affected files

**Restyle:** `app/(tabs)/Quran.tsx`, `components/quran/QuranAyahCard.tsx`, `QuranMiniPlayer.tsx`, `QuranMiniPlayerPortal.tsx` (positioning only), `QuranCompletionCard.tsx`, `QuranDisplaySettingsModal.tsx`, `QuranBookmarkModal.tsx`, `QuranCopySheet.tsx`, `navigator/NavigatorModal.tsx`, `navigator/NavigatorTabs.tsx`, `navigator/SurahTab.tsx`, `navigator/BookmarksTab.tsx`, `navigator/JuzTab.tsx`, `components/CopyToast.tsx`.
**New:** `components/quran/SurahBanner.tsx`, `components/ui/SheetBackground.tsx` (shared sheet background).
**Untouched (logic):** all Quran `services/`, `context/QuranAudioProvider.tsx`, Quran hooks.

## 11. Risks & glass caveats (from parent spec §10)

- `expo-glass-effect` is sub-1.0 — every glass mount goes through `GlassSurface` (already gated on `isGlassEffectAPIAvailable()`).
- Do not animate glass opacity; glass may not refresh on theme toggle (remount glass on theme change if needed).
- Cap glass layers per screen — the flowing reader deliberately uses **no** per-verse glass; glass is limited to header, mini player, banners-as-ornament, and the (transient) sheets.
- Bottom-sheet ↔ gesture-handler conflicts (swipe-to-delete inside the navigator sheet) — resolve with `activeOffsetX`/`failOffsetY`.
- QA on a dev/device build, not Expo Go alone (glass can appear in Go but be absent in builds). Verify Android/iOS≤25 solid fallbacks and Reduce Transparency.

## 12. Testing & verification

- `npm run verify` (lint + typecheck + test) green.
- Update `__tests__/screens/screen-contracts.test.tsx` if the Quran screen's mocked surface changes (it mocks `@/services/quranData`, `quranPageProgress`, `useQuranReadingMode`; keep mocks in sync). Update theme tests and `__tests__/README.md` if any suites change.
- Tests mocking `react-native-safe-area-context` must keep `useSafeAreaInsets: () => ({ top:0, bottom:0, left:0, right:0 })`.
- Visual QA across all 3 themes; on-device glass QA (iOS 26 device, older iOS, Android fallback); Reduce Motion + Reduce Transparency + AA contrast.

## 13. Phasing

1. **Shared primitives** — `SheetBackground` extraction + `SurahBanner`.
2. **Reader core** — flowing verses (`QuranAyahCard`), persistent glass header, surah banners, safe-area/full-bleed.
3. **Mini player** glass restyle.
4. **Navigator** → bottom sheet + segmented control (Sūrah · Juzʾ · Bookmarks), swipe-delete gesture fix.
5. **Bookmark editor, Display Text, Copy sheet** → glass sheets; **Completion card** + **Copy toast**.
6. Motion/haptics polish, light theme, on-device QA, `npm run verify`.

## 14. Rollout

Glass is a native module already present (parent spec ships it first). These restyles ride the existing OTA pipeline (`expo-ota.yml`) on top of the native build, per parent spec §8. No new native changes introduced by this spec.
