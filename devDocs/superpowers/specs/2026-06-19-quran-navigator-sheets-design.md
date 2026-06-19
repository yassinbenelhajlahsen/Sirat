# Quran Navigator + Mosque Sheets — Perf, Visual, and Surah-UX Redesign

Date: 2026-06-19
Status: Approved design (pending spec review)

## Problem

Three bottom sheets share `@gorhom/bottom-sheet` v5 + `expo-glass-effect` (liquid glass
confirmed **on** on the target device). The smooth reference is `QuranDisplaySettingsModal`.
The Quran **Navigator** and **Mosque** sheets are not:

- **Navigator lag on open/close**, present since the sheets were created (pre-dates the chrome strip).
- **Navigator seam + "sheet looks very light"**: the sheet and the separate chrome strip behind
  the floating tab bar are two independently-composited translucent layers → visible boundary +
  color mismatch.
- **Navigator close-linger**: the chrome strip is a static `View` with no exit animation; it holds
  full opacity through the close, then pops out when `onChange(-1)` unmounts it.
- **Mosque lag** during open/close/drag despite only 10 rows.
- **Surah list UX**: opening the Navigator greets the user with a wall of 114 surah cards, when the
  real intent is "jump to a known surah" (search) + quick access to popular ones.

### Root causes (verified)

- **Lag = live glass material cost.** With liquid glass on, every sheet background is a real
  `GlassView` that re-filters its backdrop every frame it moves. Cost scales with surface count +
  area + whether the backdrop is moving. `DisplaySettings` = one small (40%) glass surface over
  static content → smooth. Navigator = 78% glass + a second chrome glass surface. Mosque = glass
  over a **live `MapView`** (worst case; list size irrelevant).
- **Navigator open also pays** a synchronous list first-commit on the animating frame.
- **Seam/linger** = the separate, statically-rendered chrome strip (added in `a192283` alongside
  the `bottomInset` lift).
- `GlassView` **cannot be faded via opacity** (expo docs) — exit animations must use `translateY`
  or a non-glass surface.

## Goals

1. Navigator + Mosque open/close/drag as smoothly as `DisplaySettings`.
2. Navigator reads as **one continuous surface** (no seam, no color split, no close-linger).
3. Navigator default view is **search-forward**: Continue reading + Popular, full list on demand.
4. **Do not regress** the 114-surah scroll fix.

## Non-goals

- Changing `DisplaySettings` (stays glass — it's the loved reference). May be revisited for
  consistency later.
- Removing browse-all (it stays, behind a tap).
- Touching the Juz / Bookmarks tabs' behavior.

## Load-bearing scroll invariants — DO NOT TOUCH

From commits `70d148a` + `a192283`, all in `NavigatorModal`/`SurahTab`:
`enableDynamicSizing={false}`, fixed `snapPoints=["78%"]`, `bottomInset=tabBarClearance`,
`contentMaxHeight = frame.height*0.78` applied as `maxHeight`, the **plain `<View>` wrapper**
(not `BottomSheetView`), and **a single active scrollable** registered with gorhom. Every change
below is additive/sibling-only and verified orthogonal to these.

---

## Part A — Sheet perf + visual fixes

### A1. `SheetBackground.tsx` — add an `opaque` mode
New prop `opaque?: boolean`. When set, render **no `GlassView`/`BlurView`** — just an opaque
`LinearGradient [primaryDeep → primary]` (full alpha) inside the existing rounded `bg` container.
Removes the per-frame glass/blur cost entirely. Existing `solid` (glass) and default (non-solid)
paths are unchanged, so `DisplaySettings`/`Copy`/`Bookmark` are unaffected.

### A2. `NavigatorModal.tsx` — keep glass (Part B decouples the list from the open)
- Sheet background → **stays `solid` (glass)**, same material as `DisplaySettings`. Rationale: Part B
  moves the 114-list mount **off** the open animation (it mounts only on the "All Sūrahs" tap, while
  the sheet is already at rest), removing the dominant lag leg the research identified. The open is
  then just the glass-slide.
- Chrome strip → keep `GlassView` (both surfaces share the same material → kills the base-mismatch
  seam) under a **uniform `primary@0.6` scrim** that matches the sheet's gradient **bottom** endpoint
  (the sheet meets the chrome at `primary@0.6`), replacing the old `@0.82` + gradient stack.
- Fix close-linger with a **`translateY`** slide (NOT opacity — illegal on `GlassView`): add
  `const animatedIndex = useSharedValue(0)`, pass `animatedIndex={animatedIndex}` to `<BottomSheet>`,
  wrap the chrome in `Animated.View` with
  `translateY = interpolate(animatedIndex.value, [-1, 0], [tabBarClearance, 0], CLAMP)` so it slides
  off the bottom in sync with the closing sheet; at rest (index 0) it sits in place.
- **Opaque fallback (one prop, A1):** if on-device testing shows the 78% glass-slide still janks,
  switch the wrapper to `opaque` and the chrome to a flat `primary` fill (both supported by A1).
  `opaque` is ~2× cheaper (no per-frame backdrop filter) but loses the glass sheen. The chrome's
  `translateY` close-fix is identical either way.

### A3. `MosqueSheet.tsx`
- Sheet background → `opaque` (new `MosqueSheetBackground` wrapper) — no more blur over the live map.
- Chrome strip → flat opaque `primary` fill (drop the `GlassView`/`@0.82` + animated overlay).
- Keep `animatedPosition` (drives the recenter button); drop the now-unused `animatedIndex`/
  `chromeSolid` + their reanimated imports + the `glass` local.
- Tradeoff (accepted): loses see-through-to-map at the 18% peek.

### A4. `SurahTab.tsx` — lean first paint
Add `initialNumToRender={6}`, `maxToRenderPerBatch={6}`, `windowSize={5}` to the
`BottomSheetFlatList`. (No `removeClippedSubviews` — known gorhom scroll-wiring bugs.)

---

## Part B — Surah navigator UX (search-forward)

Goal: opening the Surah tab no longer renders 114 cards. Intent = jump-to-known + popular.

### Structure (preserves the single-scrollable scroll fix)
`SurahTab` still renders exactly **one** `BottomSheetFlatList`; only its `data` and
`ListHeaderComponent` change by mode. Sticky search stays pinned above it (unchanged).

| Mode | `data` | `ListHeaderComponent` |
|---|---|---|
| **Empty query, collapsed** (default) | `[]` | Continue card + Popular grid + **"All Sūrahs ›"** expander |
| **Empty query, expanded** | all 114 surahs | Continue card + Popular grid + "All Sūrahs" heading |
| **Search active** | `filteredSurahs` | ayah matches + juz match (existing) |

Because the default `data=[]`, none of the 114 render until the user taps "All Sūrahs" — that's
choice (b). Typing hides Continue/Popular/expander and restores the existing filtered results.

### Components in the header
- **Continue reading** (omitted if no last-read): a card showing the last-read surah +
  `Ayah N`, sourced from `currentAyah`/`currentSurahMeta` already in `Quran.tsx`, passed down as a
  new `lastRead` prop (`NavigatorModal` → `SurahTab`). Tap → `onSelectAyah(surah, ayah)`.
- **Popular**: 8 curated surahs, a 2-col grid reusing the existing tile style. Tap →
  `onSelectSurah`. Set (by number): **1 Al-Fatiha, 2 Al-Baqara, 18 Al-Kahf, 36 Ya-Sin,
  55 Ar-Rahman, 56 Al-Waqi'ah, 67 Al-Mulk, 112 Al-Ikhlas**. Defined as
  `POPULAR_SURAH_NUMBERS` and resolved against the `surahs` prop (preserve this order).
- **"All Sūrahs ›"** expander: local `showAllSurahs` state (default `false`). Tapping sets it true
  (reveals the full list). Reset to `false` when the query becomes non-empty and when the sheet
  re-opens.

### State / data flow
- New `showAllSurahs` local state in `SurahTab`.
- New `lastRead?: { surahNumber; ayahNumber; englishName; arabicName }` prop threaded
  `Quran.tsx → NavigatorModal → SurahTab`.
- No new AsyncStorage; reuses live reader state.

---

## Files touched
- `frontend/components/ui/SheetBackground.tsx` — A1
- `frontend/components/quran/navigator/NavigatorModal.tsx` — A2 + thread `lastRead`
- `frontend/components/mosques/MosqueSheet.tsx` — A3
- `frontend/components/quran/navigator/SurahTab.tsx` — A4 + B (header modes, Popular, Continue, expander)
- `frontend/app/(tabs)/Quran.tsx` — pass `lastRead` to `NavigatorModal`
- `frontend/__tests__/components/quran-navigator-modal.contract.test.tsx` — update for new default view
- `frontend/__tests__/components/mosque-sheet.contract.test.tsx` — update if it asserts on glass/chrome
- `frontend/__tests__/README.md` — note any suite changes

## Testing
- Contract: default view shows Continue + Popular + "All Sūrahs" and renders **no** surah rows;
  tapping "All Sūrahs" reveals the list; typing shows filtered results.
- Regression: all 114 scroll reachable once expanded (structure unchanged → preserved).
- `npm run verify` (lint + typecheck + test) green.
- Manual on device: Navigator + Mosque open/close/drag smooth; no seam; no close-linger; Mosque solid.

## Risks / tradeoffs
- **Navigator stays glass (matches `DisplaySettings`).** Residual risk: the 78% glass-slide on open
  is ~2× the backdrop-filtered area of the 40% `DisplaySettings`. Expected smooth post-Part-B (the
  dominant list-mount leg is gone), but **must be confirmed on-device**. Fallback = flip to `opaque`
  (one prop, A1).
- Two glass layers (sheet + chrome) sampling slightly different backdrops may leave a **very faint
  seam**; mitigated by the matched `primary@0.6` scrim. Verify on-device.
- Pixel-true `DisplaySettings` parity (one glass surface to the bottom) would require dropping the
  chrome + `bottomInset` → re-tunes the scroll fix. **Out of scope** unless explicitly requested.
- Popular set is curated/static (editorial; easy to change).
- "All Sūrahs" adds one tap for users who do want to browse.
- Mosque loses see-through-map at peek (accepted; glass-over-live-map can't be decoupled).
- "Continue reading" only shows when last-read state exists.
