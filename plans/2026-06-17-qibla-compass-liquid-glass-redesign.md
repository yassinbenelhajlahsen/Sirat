# Qibla Compass — Liquid Glass Redesign + Lift (Design Spec)

**Date:** 2026-06-17
**Status:** Approved design — ready for implementation planning
**Parent spec:** `plans/2026-06-16-visual-refresh-liquid-glass-design.md` (§6 "Qibla")
**Scope:** Migrate the Qibla screen onto the liquid-glass design system **and** give the compass a genuine qualitative lift. A small, pure addition to `useQibla` (distance to Makkah). No change to the existing location/permission/heading logic.

---

## 1. Goal

The Qibla screen is the only screen never migrated to the liquid-glass system — it still hand-rolls its own `LinearGradient`/`SafeAreaView`, uses stale typography tokens (`typography.subtitle`/`bodyLg`), hand-builds its pills/cards instead of `GlassSurface`, fires the wrong alignment haptic (`impactAsync(Light)`), and renders the compass as a single PNG arrow rotated by the *relative* angle. Bring it into the design language used on Home/Mosques/Quran **and** turn the bare arrow into a real instrument compass: a ticked dial with true-north cardinals, a Kaaba marker at the actual bearing, a bearing + distance readout, and a calm "aligned" bloom.

## 2. Relationship to the parent spec (explicit deviation)

The parent spec scoped Qibla as **restyle-only** ("compass restyled; success haptic on alignment", §6) and put behavioral/content changes out of scope (§7). This spec is an **approved, deliberate step beyond that**: it adds a derived **distance-to-Makkah** readout and changes the dial mechanics (heading-rotated card instead of a relative-rotated arrow). Both were chosen knowingly during brainstorming ("Full revamp + lift"). Everything else stays restyle-only; the underlying location, permission, heading-smoothing, and alignment-tolerance logic in `useQibla` is untouched apart from the additive `distanceKm`.

## 3. Locked decisions

| # | Decision |
|---|----------|
| 01 | **Full revamp + lift**, not a restyle. The compass is the screen's centerpiece and gets the qualitative upgrade. |
| 02 | **Compass concept = Instrument dial.** Ticked glass dial, N/E/S/W cardinals, fixed gold top pointer, 🕋 marker at the Qibla bearing, bearing + distance readout in the dial core. |
| 03 | **The lift = real directions.** The dial card rotates by `-heading` so N tracks true north and the cardinals become *real* compass directions; 🕋 is placed at the absolute `qiblaAngle`. Replaces today's "rotate one arrow by the relative angle." Uses `heading` + `qiblaAngle`, both already exposed by `useQibla`. |
| 04 | **Aligned state = Calm bloom + one ripple.** Ring border turns gold and softly glows, a halo blooms behind the 🕋, the dial core swaps to "Facing Makkah" + distance, and a single one-shot halo ripple expands once on the alignment moment. Calm-premium, on-tone. |
| 05 | **Correct haptic.** `success` (`notificationAsync(Success)`) via `useHaptics` on alignment, replacing the current `impactAsync(Light)`. |
| 06 | **Readout = bearing + distance.** Center shows `{qiblaAngle}° · to Makkah` and `{distanceKm} km`. Bearing is free (`qiblaAngle` exists); distance is a small pure addition to `useQibla`. |
| 07 | **No special aligned subtitle.** One functional subtitle, identical across states (no blessing copy), so there's no layout jump when alignment flips. The dial-core text must not overlap the 🕋 marker above or the distance line below. |
| 08 | **Fixed-layout screen** keeps `SafeAreaView` (no scroll container) per CLAUDE.md. Adopt the shared `Screen` scaffold (gradient + `Aurora` + safe area). |

## 4. Foundations reused (already built)

From `frontend/components/ui/`, `frontend/constants/`, `frontend/hooks/`:

- **`Screen`** — gradient + `Aurora` + `SafeAreaView` scaffold (`safeArea` defaults `true`; Qibla keeps it). Replaces the hand-rolled `LinearGradient`/`Aurora`/`SafeAreaView` in `Qibla.tsx`.
- **`GlassSurface`** (`tier="chrome" | "card" | "row"`, `radius`) — gates on `isGlassEffectAPIAvailable()`, falls back to translucent-solid. The only place glass logic lives. Used for status pills, the gate banners, and the info card.
- **Typed `Text`** — `LargeTitle`/`Title1-3`/`Headline`/`Body`/`Callout`/`Subhead`/`Footnote`/`Caption`. Replaces all ad-hoc `<Text style={{fontSize: typography.*}}>`.
- **`theme`** — `colors`, `type` ramp, `spacing`, `radii` (`chip 10`/`row 14`/`card 18`/`cardLg 20`/`hero 24`/`heroLg 26`/`pill 999`), `materials`, `aurora`. Plus `withOpacity`.
- **`useHaptics`** — `selection | light | medium | success | error`, gated by setting + Reduce Motion.
- **`constants/motion.ts`** — `PRESS_SCALE`, `SPRING_PRESS`/`SPRING_GENTLE` (RN `Animated.spring` configs), `TIMING_ENTER`/`TIMING_EXIT`, `BREATH_HALF_CYCLE`. (Note: these are `Animated` configs; the continuous sensor-driven dial rotation stays on its own Reanimated spring — see §8.)
- **`react-native-svg` 15.12.1** — for the dial ticks + cardinals. **`react-native-reanimated` 4.1.1** — for the dial rotation (already used here today). **`expo-symbols`** available if an SF-Symbol Kaaba/qibla glyph is preferred over the 🕋 emoji on iOS.

## 5. The compass (the lift)

### 5.1 Structure (three stacked layers)

A single square compass box, centered, ~`min(screenWidth − 2·margin, 300)`:

1. **Rotating dial layer** (`Animated.View`, `transform: rotate(-heading)`):
   - **SVG dial** — minor ticks (every 6°, hairline `white@~0.4`) and major ticks (every 30°, `accent@~0.8`) drawn as `<Line>`s around the rim, plus the four **cardinal letters** (`N` `E` `S` `W`) as `<Text>`/typed labels just inside the tick ring. **N is `accent` (gold); E/S/W are `white@~0.45`.** Cardinals and ticks rotate *with* the card (physical-compass behavior) so they always point to the real directions.
   - **🕋 Kaaba marker** — positioned on the rim at angle `qiblaAngle` from the dial's top (`rotate(qiblaAngle) → translateY(-R) → rotate(-qiblaAngle)` to keep it upright), gold drop-shadow glow. Because the layer is rotated by `-heading`, the marker's on-screen angle is `qiblaAngle − heading = rotation`, so it reaches the top exactly when `rotation == 0`.
2. **Fixed chrome layer** (does **not** rotate):
   - **Top pointer** — a gold triangle at 12 o'clock = the direction the phone is facing / the alignment target. 🕋 under it ⇒ aligned.
   - **Glass ring** — the dial's circular frame (`white@0.05` fill, `white@0.14` border, soft shadow + inner top highlight). On iOS this is the `GlassSurface`/`GlassView` material (do **not** animate its opacity — see §11).
3. **Core readout** (centered, fixed): bearing + distance (§5.3).

### 5.2 Dial geometry & rotation source

- Rotation is driven by **`heading`** (already smoothed inside `useQibla` via its adaptive `smoothRef`). The screen rotates the dial layer by `-heading`; a light Reanimated spring (today's `{ stiffness: 180, damping: 20, mass: 0.9 }`, retuned if needed) smooths the visual settle. **Switch the screen's animated value from the current `rotation` to `heading`** (the 🕋 placement handles the bearing offset, per §5.1).
- Alignment uses the hook's existing `isAligned` (within ±2° of `rotation == 0`). No tolerance change.
- `rotation == null` (no fix yet) → loading state; `error` → calibration/error state (§6.3).

### 5.3 Core readout

- **Seeking:** large bearing `{Math.round(qiblaAngle)}°` (`Title1`, bold), label `to Makkah` (`Caption`, uppercase, dim), distance `{formatKm(distanceKm)} km` (`Footnote`, `accent`).
- **Aligned:** swaps to **"Facing Makkah"** (`Title3`) + the same distance line. Constrain the core to a fixed max-width column and vertically center it so it never overlaps the 🕋 (rim, top) or the distance (below). Reserve consistent vertical space so the seeking↔aligned swap doesn't reflow.

## 6. Screen states & composition

`Qibla.tsx` keeps its current state machine (permission gate → loading → error → live), only restyled.

### 6.1 Header (all live states)
- Gold eyebrow **"Direction"** (`Caption`, uppercase, `accent`), title **"Qibla Compass"** (`LargeTitle`), one **functional subtitle** identical across seeking/aligned: *"Keep your phone flat and turn until the Kaaba reaches the top."* (No blessing copy.)

### 6.2 Status row (live)
- Two **`GlassSurface` `row`/pill** chips:
  - **Accuracy** — `Accuracy ±{Math.round(accuracy)}°` when `accuracy >= 0`, else `Calibrating compass…`.
  - **Alignment** — `Adjusting` (gold dot) ↔ `Aligned` (jade dot + `accent` border) driven by `isAligned`.
- A low-accuracy hint line ("Move in a figure-8 if accuracy is low") shown when accuracy is poor.

### 6.3 Error / loading
- `rotation == null` → centered `Body` "Finding direction…".
- `error` → glass card with a warning glyph, the error text (`Body`, `danger`), and the figure-8 helper (`Footnote`).

### 6.4 Aligned moment (composited)
- Ring border → `accent` + soft gold glow; halo bloom behind 🕋; core → "Facing Makkah"; alignment pill → jade "Aligned"; **one-shot ripple** halo expands from the ring once and settles; **`success` haptic** (debounced like today's `lastHapticAt`/`prevAligned` guard, so it fires once per alignment, not every frame).

### 6.5 Permission gate (restyle-only)
- The existing services-off / denied / undetermined `InfoBanner` flows and the "Prayer Times still work without location" info card become **`GlassSurface`** banners/cards with typed `Text` and gold CTAs (`onAccent` text on `accent`). **All permission/services logic, copy intent, accessibility labels, and CTA handlers (`openDeviceSettings`, `requestPermissionAndLoad`, `openLocationServicesHelp`) stay identical.**

## 7. Hook change — `useQibla` (additive only)

- Capture the `coords` already read at `getCurrentPositionAsync` and compute a **great-circle distance** to the Kaaba (haversine, `R = 6371 km`, same `KAABA_LAT/LON` constants). Expose **`distanceKm: number | null`** on `UseQiblaResult`.
- Pure addition: no change to `rotation`, `heading`, `qiblaAngle`, `accuracy`, `error`, `isAligned`, the smoothing, the lifecycle, or the web fallback. Distance is computed once per position (matching today's single `getCurrentPositionAsync`).
- A `formatKm(distanceKm)` helper renders a localized thousands-separated integer (round to nearest km). Lives with the screen (or a small util); not in the hook's contract beyond the raw number.

## 8. Rendering & animation approach

- **Dial = `react-native-svg`** (`Svg`/`Line`/`Text`/`Circle`) for crisp ticks and cardinals at any size; the 🕋 marker and the gold pointer are RN `View`/`Text` overlays (or SVG — either is fine). The whole dial layer is an `Animated.View` (Reanimated) rotated by `-heading`.
- **Continuous rotation stays on Reanimated** with the existing spring shape (`withSpring({ stiffness, damping, mass })`), tuned for a calm settle. The `motion.ts` `SPRING_*` presets are `Animated.spring` configs (different shape) and are **not** used for the dial rotation; they/`PRESS_SCALE` apply to any press/entrance feedback on chrome.
- **Aligned visuals:** animate the ring's **glow/shadow, the halo scale/opacity, and the ripple** — never the `GlassView`'s own opacity (§11). The ripple is a one-shot scale+fade on a separate `View`, gated by the `isAligned` rising edge. Respect **Reduce Motion** (no ripple/breathing; instant state swap).
- Replace the inline `expo-haptics` call and raw `Date.now()` debounce with `useHaptics('success')`, keeping the once-per-alignment guard.

## 9. Theming

- All three themes via `useTheme()` + `createStyles(theme)`; **no static colors** (current file already uses theme tokens but mixes in stale typography — migrate to the `type` ramp / typed `Text`).
- Glass over the **light** theme uses dark tints (handled by `materials`); SVG tick/cardinal colors derive from `colors.accent` / `withOpacity(colors.white|black, …)` so they invert correctly. Fallbacks (Android / iOS ≤ 25 / Reduce Transparency) carry their own contrast — the dial must read without the glass material.
- `Aurora` is per-theme and inherited through `Screen`.

## 10. Behavior preservation contract (must remain identical)

- Permission/services state machine: services-off, denied, undetermined, granted; all CTAs and their handlers; the "Prayer Times still work" messaging.
- `useQibla` outputs other than the new `distanceKm`: `rotation`, `heading`, `qiblaAngle`, `accuracy`, `error`, `isAligned`; the adaptive heading smoothing; the AppState start/stop lifecycle; the web fallback.
- Alignment tolerance (±2°) and the once-per-alignment haptic debounce.
- Accessibility roles/labels on the gate CTAs.

## 11. Risks & glass caveats (from parent spec §10)

- `expo-glass-effect` is sub-1.0 — every glass mount goes through `GlassSurface` (already gated on `isGlassEffectAPIAvailable()`).
- **Never animate glass opacity** (the ring): a Reanimated/Animated opacity animation on a `GlassView` (or parent) stops it rendering. Animate glow/shadow/halo/ripple on sibling/child `View`s instead.
- Glass may not refresh on theme toggle — remount the ring's glass on theme change if it doesn't repaint.
- QA on a dev/device build, not Expo Go alone (glass can appear in Go but be absent in builds). Verify Android / iOS ≤ 25 solid fallbacks and Reduce Transparency.
- SVG tick performance is fine (static), but keep the dial a single SVG; don't re-mount it per frame — only the wrapping `Animated.View` transform changes.

## 12. Out of scope / hands-off

- All location/permission/heading **logic** in `useQibla` except the additive `distanceKm`.
- No new sensor sources, no magnetometer fusion changes, no calibration UI beyond the existing accuracy pill + figure-8 hint.
- Other screens, the tab bar, and shared chrome (already migrated).
- No new routes, settings, or persisted state.

## 13. Affected files

**Restyle + lift:**
- `frontend/app/(tabs)/Qibla.tsx` — adopt `Screen`, typed `Text`, `GlassSurface` (pills/banners/info card), `useHaptics('success')`, the new SVG instrument dial + heading-driven rotation, the bearing/distance core, and the aligned bloom/ripple.

**Logic (additive):**
- `frontend/hooks/useQibla.ts` — add `distanceKm` (haversine), expose on `UseQiblaResult`.

**Possibly new (optional):**
- `frontend/components/qibla/CompassDial.tsx` — extract the SVG dial + marker + rotation into a focused component so `Qibla.tsx` stays thin (recommended; keeps the screen file readable).
- A small `formatKm` util (or inline in the screen).

**Likely removed:** the `qibla-compass-svgrepo-com.png` arrow asset (superseded by the SVG dial) — confirm no other references before deleting.

## 14. Testing & verification

- `npm run verify` (lint + typecheck + test) green.
- Update `frontend/__tests__/hooks/useQibla.test.ts` for the new `distanceKm` output (assert it's computed/`null` per permission path).
- Update `frontend/__tests__/screens/qibla.contract.test.tsx` if the screen's mocked surface changes; keep the `react-native-safe-area-context` mock's `useSafeAreaInsets: () => ({ top:0, bottom:0, left:0, right:0 })`.
- Update `frontend/__tests__/README.md` if any suite changes.
- Visual QA across all 3 themes; on-device glass QA (iOS 26 device, older iOS, Android fallback); Reduce Motion (no ripple) + Reduce Transparency + AA contrast on the dial/cardinals.

## 15. Phasing

1. **Hook** — add `distanceKm` to `useQibla` + test.
2. **Dial** — build `CompassDial` (SVG ticks/cardinals, 🕋 marker, heading-driven Reanimated rotation, fixed pointer, glass ring). Seeking state only.
3. **Core readout** — bearing + distance; seeking↔aligned text swap with reserved space (no reflow).
4. **Aligned state** — gold bloom + halo + one-shot ripple + `success` haptic (once-per-alignment guard), Reduce-Motion fallback.
5. **Screen migration** — `Screen` scaffold, typed `Text`, glass status pills, low-accuracy/error states.
6. **Permission gate** — glass banners/info card restyle (logic untouched).
7. Polish, light theme, on-device QA, `npm run verify`; remove the old PNG asset.

## 16. Rollout

Per parent spec §8: the glass native module already ships with the app shell, so this restyle rides the existing OTA pipeline (`expo-ota.yml`). The `distanceKm` hook change and SVG dial are pure JS/TS — no new native dependency, OTA-deliverable.
