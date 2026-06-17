# Sirat Visual Refresh — Liquid Glass Redesign (Design Spec)

**Date:** 2026-06-16
**Status:** Approved design — ready for implementation planning
**Scope:** App-wide visual/UX refresh of the Sirat frontend (Expo SDK 54 / RN 0.81). No behavior or feature changes.

---

## 1. Goal

Make Sirat look and feel like a modern 2026 iOS app: Liquid Glass chrome, a refined palette, real depth and materials, a consistent type hierarchy, and calm-premium motion — while preserving its Islamic identity and serene tone. This is a **visual/UX refresh only**; no functional logic changes.

## 2. Why now (diagnosis of the current look)

From a review of the current codebase:

- Every screen sits on the same `primaryDeep → primary → primaryLift` green gradient with a faint pattern overlay. There is no real material/depth system — just `black @ 22% opacity + 1px border` cards repeated everywhere. Reads flat and muddy.
- The accent (`#DABA69` muted gold on `#134b0a` forest green) is heritage/traditional, not vibrant or premium.
- The tab bar is a hand-rolled floating pill with **6 tabs** (busy), not the real iOS 26 glass bar.
- Almost no motion — most screen transitions are `"none"`.
- Type sizes are redefined ad-hoc per screen rather than following one ramp.

Good existing foundations to build on: SF Pro fonts are loaded, a token system (`theme.colors/spacing/typography`) and `withOpacity` exist, and there is already a 3-theme switcher.

## 3. Locked decisions

| # | Area | Decision |
|---|------|----------|
| 01 | Palette & themes | Refresh all 3 theme slots in place. `default = A` (green + gold, **flagship**), `dark = B` (Luminous Serenity), `light` = modernized. One shared design language; palette is the per-theme variable. |
| 02 | Liquid Glass | **Controlled** — real `GlassView` material that *we* place. Opt out of the blanket iOS 26 auto-restyle (`UIDesignRequiresCompatibility=true`). Identical look on iOS + Android via graceful fallback. |
| 03 | Navigation | **5-tab glass pill**: Home · Quran · Qibla · Mosques · Calendar. Settings moves to a **header gear**. |
| 04 | Design language | iOS-native type ramp · 3 glass tiers · continuous (squircle) corners · airy 8pt spacing · one signature accent per theme · SF Symbols · meaningful haptics. |
| 05 | Motion | **Calm-premium** — gentle springs, soft fades, slow breathing next-prayer ring, shared-element transition into Quran. Alive but serene. |
| 06 | Home greeting | **Time-based** — "Good morning / afternoon / evening" as the headline (replaces "As-salāmu ʿalaykum"). |

## 4. Design language specification

### 4.1 Color — three refreshed palettes

The existing `AppColors` 30-field structure is retained and remapped; new tokens are added (§5.1). Anchor colors per theme:

**A — `default` (flagship, green + gold):**
- Canvas gradient: `#0B1810 → #102A1C → #0A150E`
- Signature accent (gold): `#E8C77A` (replaces `#DABA69`)
- Secondary / positive (jade): `#3FB984`
- `onAccent` (text on gold): `#10301F`
- Ambient aurora glows: gold `#E8C77A` @ ~0.30, jade `#3FB984` @ ~0.18
- Text: `#FFFFFF`; secondary `white@0.6`; tertiary `white@0.5`
- Borders: `white@0.09–0.18` (by glass tier)

**B — `dark` (Luminous Serenity):**
- Canvas gradient: `#0E1116 → #141B26 → #0B0E13`
- Signature accent (emerald-teal): `#33D29B`
- Secondary (soft gold): `#E3C27E`
- `onAccent`: `#04130D`
- Aurora glows: jade `#2FBF8F`, teal `#37C9C2`, soft gold `#E3C27E`

**`light` (modernized warm light):**
- Canvas: warm off-white `#F6F1E9 → #FBF7F1` (never pure white)
- Surfaces: near-white panels with soft real shadows; **glass over light uses dark tints** (`black@0.04–0.08`), not white
- Accent (deeper for AA contrast on light): gold/bronze `#B58A36`
- Text: `#1A1A1A` primary; muted grays for secondary

**Color discipline (all themes):** muted base + **one** signature accent used only for the active/next state and primary actions. Calm secondary text via reduced-opacity foreground, not new hues. Desaturate any over-bright custom accent in dark mode so it doesn't vibrate.

### 4.2 Typography — iOS-native ramp

One ramp in `theme.typography`, used everywhere (replaces ad-hoc per-screen sizes):

| Token | Size | Weight | Notes |
|-------|------|--------|-------|
| largeTitle | 34 | Bold | Collapses to Headline (17 Semibold) inline on scroll |
| title1 | 28 | Bold | |
| title2 | 22 | Bold | |
| title3 | 20 | Semibold | |
| headline | 17 | Semibold | |
| body | 17 | Regular | |
| callout | 16 | Regular | |
| subhead | 15 | Regular | |
| footnote | 13 | Regular | |
| caption | 12 | Regular | |

- Fonts: SF Pro Display (Bold/Semibold/Regular) already loaded. **Nice-to-have:** load SF Pro **Text** (Regular/Medium) for sizes ≤19 to match Apple's optical sizing; otherwise reuse Display. Avoid Ultralight/Thin/Light weights.
- Arabic (Quran) type ramp is handled within the Quran screens (existing sizing preserved; only chrome/containers restyle).

### 4.3 Materials — three glass tiers

| Tier | Used for | iOS (`GlassView`) | Fallback (Android / iOS ≤ 25) |
|------|----------|-------------------|-------------------------------|
| 1 · Chrome | Tab bar, header gear, nav | strong blur, `white@0.10`, border `white@0.18`, strong shadow | solid translucent surface color, same border/shadow |
| 2 · Card | Hero card, content cards | medium blur, `white@0.06–0.08`, border `white@0.12–0.14` | semi-opaque surface, border/shadow |
| 3 · Row/inline | List rows, chips | subtle fill `white@0.05`, border `white@0.09` (glass optional) | same subtle fill |

- iOS uses `expo-glass-effect` `GlassView` (`glassEffectStyle: 'regular'`, chrome may use `'clear'`). Use `GlassContainer` to group adjacent glass so it blends; **cap glass layers per screen** (refraction is GPU-heavy).
- Android/old-iOS fallback must carry its own contrast — never rely on glass for legibility. (`expo-blur` `BlurView` already installed if a frosted Android look is wanted, but solid translucent is the safe default.)
- Shadows are soft and physical, not decorative.

### 4.4 Corners — continuous (squircle)

Use RN `borderCurve: 'continuous'` (iOS) everywhere; concentric nesting (inner radius ≈ outer − padding).

| Element | Radius |
|---------|--------|
| Chrome / tab pill / capsules | fully rounded |
| Hero cards | 24–26 |
| Cards / modals | 18–20 |
| Rows / inputs | 14 |
| Chips | 10 |

### 4.5 Spacing — 8pt grid, airy

Keep `xs:4 sm:8 md:12 lg:16 xl:20 xxl:24`; **add** `xxxl:32`, `huge:40` for oversized headers and breathing room. Content margins 20. Min touch target 44×44.

### 4.6 Motion — calm-premium (react-native-reanimated + gesture-handler)

Centralized presets in `constants/motion.ts`:

- **Spring (gentle):** `withSpring({ damping: 18, stiffness: 140, mass: 1 })` — soft settle, minimal overshoot.
- **Press feedback:** scale → 0.97 on press-in, gentle spring back.
- **Content entrance:** staggered fade + 16px slide-up, ~480ms ease-out, ~70ms per-item stagger.
- **Screen / tab transition:** cross-fade + scale `0.98 → 1`, ~300–360ms. (Replaces `animation: "none"`.)
- **Quran open:** shared-element transition from the "Continue reading" card.
- **Next-prayer ring:** slow breathing `scale 1 ↔ 1.05` + soft glow, ~4.6s round trip (`withRepeat(..., -1, true)`).
- Respect Reduce Motion (fall back to simple fades / no breathing).

### 4.7 Haptics (`expo-haptics`, via `useHaptics`)

Tied to meaning, and gated by a user setting + Reduce Motion:

| Event | Haptic |
|-------|--------|
| Tab change | `selectionAsync` |
| Prayer row / card tap | `impactAsync(Light)` |
| Primary action (Ask for du'ā) | `impactAsync(Medium)` |
| Qibla aligned | `notificationAsync(Success)` |
| Error | `notificationAsync(Error)` |

### 4.8 Icons

SF Symbols via `expo-symbols` (installed) on iOS; Material Symbols / Ionicons (`@expo/vector-icons`, installed) on Android. Centralize platform mapping in one icon component.

### 4.9 Geometric texture

Keep a **very subtle** Islamic geometric motif only in headers / empty states (low opacity). Not a full-screen overlay. Used to complement, never compete.

## 5. Architecture & new primitives

### 5.1 Token system (`frontend/constants/theme.ts`)

- Extend `AppColors` with `accentSecondary` (jade/teal), and explicit material/border tokens as needed.
- Replace `typography` with the full ramp (§4.2), each entry `{ size, weight, lineHeight }`.
- Add `radii` token group (§4.4) and extend `spacing` (§4.5).
- Add a `materials` token group describing the 3 glass tiers per theme (blur, fill alpha, border alpha, shadow).
- Refresh `defaultColors` / `darkColors` / `lightColors` to the anchors in §4.1. `themeMap` and `ThemeName` unchanged (still `default | dark | light`).

### 5.2 New shared UI (`frontend/components/ui/`)

- **`GlassSurface.tsx`** — glass wrapper; props `tier` (1/2/3). Renders `GlassView` on iOS (gated by `isGlassEffectAPIAvailable()`), translucent-solid fallback elsewhere. The single place glass logic lives.
- **`Text` components** — typed components (`LargeTitle`, `Title`, `Headline`, `Body`, `Caption`, …) reading the ramp; replaces ad-hoc `<Text style={{fontSize}}>`.
- **`Screen.tsx`** — standard scaffold: gradient background + safe-area + scroll + collapsing large-title header. Most screens adopt this.

### 5.3 Helpers / presets

- **`constants/motion.ts`** — spring/timing/stagger presets (§4.6).
- **`hooks/useHaptics.ts`** — haptics map (§4.7), respects settings + Reduce Motion.

### 5.4 Navigation

- **`components/navigation/GlassTabBar.tsx`** — custom 5-tab glass pill (Tier-1 `GlassSurface`), gold/teal active bubble, icon-only.
- **`app/(tabs)/_layout.tsx`** — reduce to 5 tabs (Home, Quran, Qibla, Mosques, Calendar), use the custom tab bar, remove Settings tab.
- **Settings** — reached via header gear on Home (route preserved; entry point moves). Confirm no deep links assumed the tab.

### 5.5 Native / config (`frontend/app.config.js`)

- Add `expo-glass-effect` (`npx expo install expo-glass-effect`); add its config plugin if required.
- `ios.infoPlist.UIDesignRequiresCompatibility = true` (opt out of blanket auto-restyle during migration).
- Build with **Xcode 26** (EAS default for SDK 54). iOS deployment target stays **15.1** (glass is runtime-gated).
- Bump `version` / build number for the native release.

## 6. Per-screen scope (restyle only — no logic changes)

- **Home** — time-based greeting headline, header gear, hero next-prayer glass card w/ breathing ring, glass prayer list (active state highlighted), du'ā action, glass tab bar.
- **Quran** — reader, ayah cards, mini-player, navigator/bookmark/display modals restyled with glass + ramp; **Arabic rendering logic untouched**.
- **Qibla** — compass restyled; success haptic on alignment.
- **Mosques** — list + map cards restyled; map screen chrome restyled.
- **Calendar** — Islamic calendar, Ramadan tracker, holidays restyled.
- **Settings** — full restyle; now entered from header gear; theme switcher updated for refreshed themes.
- **Shared** — DuaCard, DuaResultCard, PrayerTimesList, modals (Update/CitySearch/ForceUpdate/Notification), CopyToast, SplashScreen adopt new primitives.

## 7. Out of scope (explicit)

- No new features or behavioral/logic changes.
- Deep Quran rendering (kashida justification, mushaf-perfect pagination) — a separate **feature** project, not this refresh.
- Native-tabs migration (`expo-router/unstable-native-tabs`) — rejected in favor of Controlled glass.
- No new screens.

## 8. Rollout

Glass + the iOS 26 build are **native** changes → they need a new **App Store / Play Store build**, not OTA.

1. Ship the native release first: `expo-glass-effect` + config + the `GlassSurface`/tab-bar primitives (and Phase 1–2 screens).
2. Subsequent screen restyles can flow via the existing OTA pipeline (`expo-ota.yml`) on top, since the native glass module is already present.
3. `runtimeVersion` policy is `appVersion` — native changes require a version bump and store submission; coordinate with the force-update gate guidance in CLAUDE.md.

## 9. Phasing (foundations-first)

1. **Foundations** — expand tokens, refresh 3 palettes, build primitives (`GlassSurface`, Text components, `Screen`, `useHaptics`, motion presets). No screen changes yet.
2. **App shell** — native build w/ `expo-glass-effect` + iOS 26 config; 5-tab glass bar; header gear; calm transition system. *(Most visible change.)*
3. **Home** — flagship screen fully refreshed.
4. **Quran** — reader, cards, mini-player, modals (most complex).
5. **Qibla · Mosques · Calendar.**
6. **Settings + all modals/sheets**, then motion/haptics polish, light theme, and on-device QA.

## 10. Risks & caveats (from research)

- `expo-glass-effect` is sub-1.0 (v0.1.x). **Gate every glass mount on `isGlassEffectAPIAvailable()`** — some iOS 26 beta builds lacked `UIGlassEffect` and crashed (#40911).
- **Do not animate glass opacity:** `opacity: 0` on a `GlassView` or parent stops it rendering (official known issue); a Reanimated/Animated opacity animation on a glass parent breaks it (#41024). Animate children or non-opacity props; use the built-in `animate` config.
- Glass material may not refresh on theme toggle (#43743) — may require remounting glass on theme change.
- **Expo Go ≠ device:** Liquid Glass can show in Expo Go but be absent in builds (#39666/#39667). QA on a dev/device build, never Expo Go alone.
- Performance: cap glass layers per screen; group with `GlassContainer`.
- `UIDesignRequiresCompatibility` is a **stopgap** (Apple may remove it ~iOS 27) and is reportedly inconsistent in some configs — verify on-device.
- Android / iOS ≤ 25: `GlassView` renders as a plain `View` (no translucency). Fallbacks must supply their own contrast.
- Accessibility: `isLiquidGlassAvailable()` can be `true` even with **Reduce Transparency** on — provide solid fallbacks that respect it.

## 11. Testing

- Visual QA of every screen across **all 3 themes**.
- **On-device** glass QA: an iOS 26 device, an older iOS device, and Android (verify fallbacks).
- `npm run verify` (lint + typecheck + test) green. Update affected tests: `__tests__/screens/screen-contracts.test.tsx`, theme tests, and `__tests__/README.md` when suites change.
- Accessibility: Dynamic Type (revisit current `allowFontScaling={false}`), Reduce Motion, Reduce Transparency, AA contrast per theme.

## 12. References

- Expo Glass Effect — https://docs.expo.dev/versions/latest/sdk/glass-effect/
- Expo Native Tabs — https://docs.expo.dev/router/advanced/native-tabs/
- Expo SDK 54 changelog — https://expo.dev/changelog/sdk-54
- iOS 26 opt-out (`UIDesignRequiresCompatibility`) — https://www.donnywals.com/opting-your-app-out-of-the-liquid-glass-redesign-with-xcode-26/
- Apple HIG (color, typography) — https://developer.apple.com/design/human-interface-guidelines/
- Reanimated springs — https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/
- Arabic/Quran rendering reference (future feature) — https://tarteel.ai/blog/from-page-to-screen-rethinking-quran-rendering-for-the-digital-age/
- Relevant Expo issues: #40911, #41024, #43743, #39930, #40389, #41573, #39666, #39667
