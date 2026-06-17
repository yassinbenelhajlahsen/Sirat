# Mosques — Map-First Redesign (Design Spec)

**Date:** 2026-06-17
**Status:** Approved design — ready for implementation planning
**Scope:** Redesign the Mosques tab into a single map-first screen with a draggable glass bottom sheet. Part of the app-wide visual refresh (see `2026-06-16-visual-refresh-liquid-glass-design.md` §6 "Mosques"). Presentation + one derived signal (compass direction) only — no new backend, no new product features.

---

## 1. Goal

Turn the Mosques experience from today's disjointed *"3 nearest cards + a dead map-preview that punts to a second full-map screen"* into one cohesive, modern **map-first** screen: an interactive map you can explore, with a draggable glass sheet listing nearby mosques over it — the Apple/Google "nearby places" pattern, in Sirat's glass design language. This is the same level of purpose-built reinvention as `PrayerArc` (which turned a flat prayer list into a data-driven sun arc), applied to the spatial nature of finding a masjid.

## 2. Why now (diagnosis of today's screen)

From `app/(tabs)/Mosques.tsx` (906 lines) and `app/MosqueMap.tsx` (516 lines):

- The list is **capped at the top 3** mosques, then a static 240px map preview punts to a *separate* full-screen `MosqueMap` route. Browsing all nearby mosques isn't possible on the list screen; the two screens duplicate the map, the markers, the callouts, the location-gate, and the directions logic.
- Cards still use the **old flat style** (`primarySurfaceAlt` fill + gold border + text shadows), not the `GlassSurface` language used by `PrayerArc`/`DuaCard`/`DuaResultCard`.
- Distance is the only signal shown; there's no sense of **which way** a mosque is.

Good foundations already present: Aurora background, shrink-on-scroll (`handleTabBarScroll`), per-theme `customMapStyle`, cached-first → fresh data loading, haversine distance, `react-native-maps`, `react-native-reanimated` (4.1.1), `react-native-gesture-handler` (2.28.0), New Architecture enabled.

## 3. Locked decisions

| # | Decision |
|---|----------|
| 01 | **Map-first.** The interactive `MapView` is the screen background (replaces the gradient on this tab only). |
| 02 | **Draggable glass bottom sheet** built with `@gorhom/bottom-sheet` (v5.2.14 — peer-compatible with reanimated 4 + RNGH 2.28, New Arch). Not hand-rolled. |
| 03 | **Three snap points:** Peek (~18%), **Half (~50%, default open)**, Full (~92%). Grabber handle only — **no "drag up/down" text hints.** |
| 04 | **Show up to 10 mosques** (was 3), scrollable inside the sheet. No backend change — Google Places already returns up to ~20; today's frontend just slices to 3. |
| 05 | **Retire `app/MosqueMap.tsx`.** The fused screen already provides the full map (drag sheet to Peek) + "Search this area". Delete the file and its navigation. |
| 06 | **New derived signal: compass direction.** `bearing(from,to)` → `cardinal()` (N/NE/E/…), shown next to distance ("0.3 mi · NE"). Pure, unit-tested. |
| 07 | **Map ↔ list sync:** tap a card → recenter map on its pin; tap a pin → highlight that card and scroll the sheet to it. |

## 4. Screen specification

### 4.1 Background — interactive map

- Full-bleed `MapView` (`react-native-maps`) using the existing per-theme `createCustomMapStyle(colors)` (light theme → default Apple style, others → themed dark style). `showsUserLocation`.
- Markers: themed mosque pins (`MosqueMarker`), `tracksViewChanges={false}` after first paint for perf. A **selected** pin is visually elevated (larger / accent ring). Cap rendered markers to the loaded set (≤ ~20).
- **Search this area:** when the user pans the map (`onRegionChangeComplete` after an interaction), a floating glass chip "Search this area" fades in; tapping it re-fetches `getNearbyMosques(region.lat, region.lng)` and refreshes pins + list (logic carried from `MosqueMap`).
- **Recenter button:** a small Tier-1 glass circular button (locate icon) anchored just above the sheet's Half position; recenters on the user.

### 4.2 The sheet (`@gorhom/bottom-sheet`)

- `snapPoints` ≈ `['18%', '50%', '92%']`; `index={1}` (Half) on open. `enablePanDownToClose={false}` — the sheet never fully dismisses; Peek is the lowest state.
- Background = Tier-1/Chrome `GlassSurface` look (rounded top, hairline top border, soft shadow). `handleIndicator` = the grabber; no text affordances.
- Content = `BottomSheetFlatList` of up to 10 `MosqueRow`s so the list scrolls *inside* the sheet when at Full, and drags the sheet when scrolled to the top (gorhom handles the scroll↔drag handoff).
- Sheet header (non-scrolling): "{n} mosques nearby" + "Nearest {dist}" subtitle.
- Respect Reduce Motion: gorhom's springs degrade gracefully; do **not** animate glass opacity (refresh-risk per visual-refresh spec §10).

### 4.3 Mosque row (`MosqueRow`) — Tier-3 glass

- Left: mosque glyph (`FontAwesome5 mosque`) in a gold-tinted circle.
- Center: **name** (Headline), **address** (Caption, dimmed).
- Right: meta = **distance + cardinal direction** pill ("0.3 mi · NE") and a gold **Directions** chip (opens Apple/Google Maps via existing `openDirections`).
- **Selected** state (focused from a pin tap): accent-tinted fill + border, like the focused card in the mockup.
- Tap row (not the chip) → recenter map on pin + set selected.

### 4.4 Location gate

- Reuse existing permission/services logic and copy verbatim (services-off / denied / undetermined branches, CTAs, `Linking.openSettings`, help alerts).
- Presentation: dimmed map (or solid themed canvas if no location yet) behind a centered Tier-2 glass card carrying the gate `InfoBanner` + CTAs. No functional change to the gate.

### 4.5 Derived geometry (`utils/geo.ts`, pure + tested)

```
distanceKm(aLat,aLng,bLat,bLng): number          // haversine (moved from Mosques.tsx)
formatDistanceLabel(km): string                   // "0.3 mi away" / "120 ft away" (moved)
bearingDeg(fromLat,fromLng,toLat,toLng): number   // 0..360, 0 = North
cardinal(deg): "N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"// 8-point compass
```

`formatDistanceLabel` keeps its current imperial output; a new compact form (e.g. `formatDistanceShort` → "0.3 mi") may be added for the row pill. Unit-tested like `utils/prayerArc.ts`.

## 5. Architecture & files

**New**
- `frontend/utils/geo.ts` — geometry helpers above. (+ `frontend/__tests__/utils/geo.test.ts`)
- `frontend/components/mosques/MosqueSheet.tsx` — gorhom sheet + `BottomSheetFlatList`, header, selection wiring.
- `frontend/components/mosques/MosqueRow.tsx` — Tier-3 glass row (default + selected).
- `frontend/components/mosques/MosqueMarker.tsx` — themed map pin (default + selected).

**Rewritten**
- `frontend/app/(tabs)/Mosques.tsx` — map host + sheet + gate + data loading (loading/cache/error logic preserved). Distance/format helpers move to `utils/geo.ts`.

**Modified**
- `frontend/app/_layout.tsx` — wrap the app root in `GestureHandlerRootView` (required by gorhom; today only `NavigatorModal` wraps locally). One wrapper at the root.
- `frontend/package.json` — add `@gorhom/bottom-sheet`.

**Deleted**
- `frontend/app/MosqueMap.tsx` — retired (fused into the tab). Remove the `router.push("../MosqueMap")` call and the route from `.expo/types/router.d.ts` (regenerated).

## 6. Testing

- Add a jest mock for `@gorhom/bottom-sheet` (render `BottomSheet`/`BottomSheetFlatList`/`BottomSheetView` as plain `View`/`FlatList`) and for `react-native-gesture-handler` `GestureHandlerRootView` where needed (mirror the existing `NavigatorModal` test treatment).
- **Preserve** the data contracts in `__tests__/screens/nearby-mosques.contract.test.tsx`: cached-first → fresh replacement, empty state ("No mosques found near your current location."), error alert ("Failed to load nearby mosques."). These survive — loading logic is unchanged.
- **Rework** `__tests__/flows/nearby-list-to-map.flow.test.tsx`: the list→separate-map navigation no longer exists. Re-target to in-screen behavior (tap row → selection/recenter), or retire if it only asserted navigation to `MosqueMap`.
- **Adapt** `__tests__/flows/nearby-mosques-refresh.flow.test.tsx` to "Search this area" / refresh in the fused screen.
- **Add** `__tests__/utils/geo.test.ts` (bearing quadrants, cardinal boundaries, distance sanity).
- Update `frontend/__tests__/README.md` for added/removed suites.
- `npm run verify` (lint + typecheck + jest) green.

## 7. Risks & caveats

- **gorhom × reanimated 4 / New Arch:** v5.2.14 peer-allows reanimated `>=4.0.0-` + RNGH `>=2.16.1` (we have 4.1.1 / 2.28.0). Verified via `npm view`. Still QA the scroll↔drag handoff on a device build (not just Expo Go) per visual-refresh §10.
- **Native dep already present:** gesture-handler + reanimated are installed and native; gorhom is JS on top, so this can ship OTA *only if* a build already includes those natives — confirm against the visual-refresh native-build rollout (§8 of that spec). If unsure, fold into the next native build.
- **Map markers perf:** keep `tracksViewChanges={false}`; cap to the loaded set.
- **No glass-opacity animation** (refresh-risk #41024).
- **Behavior parity:** directions, caching, gate, search-this-area must behave exactly as today — this is visual + one derived label only.

## 8. Out of scope

- Backend changes, per-mosque prayer times / hours / ratings / favorites.
- Any change to how mosques are fetched/cached beyond showing more of what's already returned.
- Other screens (Quran, Qibla, Calendar, Settings) — separate efforts.
