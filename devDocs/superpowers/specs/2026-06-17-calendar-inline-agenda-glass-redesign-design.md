# Calendar — Inline Agenda + Liquid Glass Redesign (Design Spec)

**Date:** 2026-06-17
**Status:** Approved design — ready for implementation planning
**Scope:** Restructure the Calendar tab from "grid → push a separate day page" into a single inline-agenda screen, and glass-restyle the day detail. Part of the app-wide Liquid Glass refresh (see `2026-06-16-visual-refresh-liquid-glass-design.md`).

---

## 1. Problem

Today, tapping a day in `app/(tabs)/Calendar.tsx` fades the whole calendar out and `router.push`es to a standalone `app/[date].tsx` route. That route is a full second screen with its **own** day-navigation paradigm (Prev/Next buttons + a `PanResponder` horizontal swiper). So the user crosses a hard screen boundary and then re-navigates days in a different way than they navigated months.

The result reads as "a whole separate page" for what is conceptually just "look at one day inside the calendar I'm already in." The visuals are also the old flat system (`black@22% + 1px border` cards, ad-hoc type sizes) rather than the new glass language now shipping in Quran / Qibla / Mosques.

Two distinct problems, fixed together:
1. **Structure** — the day detail should live *inside* the calendar, not behind a navigation push.
2. **Skin** — the day detail and the calendar chrome should use the glass primitives + type ramp.

## 2. Chosen model — inline agenda

Selected from three candidates (bottom sheet over the grid · inline agenda · seamless shared-element morph). **Inline agenda** won: the month grid pins to the top of the Calendar tab, and the selected day's detail renders directly beneath it on the **same** screen. Tapping a day in the grid selects it inline — no navigation, no second day-swiper. This is the Apple/Google Calendar pattern.

```
┌─────────────────────────────┐
│  Calendar        ‹ Dec 2026 › │  ← header: title + bare month switcher (top-right)
│  S  M  T  W  T  F  S          │  ← weekday row
│  …  …  15 …  …  …  …           │  ← month grid, ALWAYS 6 rows reserved (fixed height)
│  …  …  …  …  …  …  …           │
│ ───────────────────────────── │  ← divider (fixed Y — never moves between months)
│  Today · Dec 15   ✦ Holiday   │  ┐
│  ┌─ PrayerArc (live) ───────┐ │  │  scrolling day panel
│  │  ◜‾‾●‾‾◝  Fajr…Asr…Isha   │ │  │
│  └──────────────────────────┘ │  ┘
└─────────────────────────────┘
```

## 3. Locked decisions

| # | Area | Decision |
|---|------|----------|
| 01 | Interaction | Inline agenda. Grid pinned top, divider, scrolling day panel below. Tapping a grid day selects it inline — **no navigation**. |
| 02 | Day-swiper | The standalone day Prev/Next + `PanResponder` swiper on the Calendar flow is **removed**; days change by tapping the grid. |
| 03 | Prayer display | **`PrayerArc` everywhere** for one consistent shell. **Live** (sun/moon marker, gold progress arc, breathing "next" ring) only when the selected day is **today**. Any other day renders the **static** shell: arc curve + neutral prayer markers + the six times, no live layer. |
| 04 | Month switcher | Bare `‹ Mon Year ›` text + chevrons, **no pill/border**, tucked top-right on the title line. Abbreviated month (e.g. `Dec 2026`). Frees vertical space for the panel. |
| 05 | Default selection | On open (and when swiping to a month that contains today) **auto-select today** and show its panel. When viewing a month with **no** today, show the "tap a day to see prayer times & events" prompt. |
| 06 | Ramadan | Per-day "mark/clear missed fast" toggle lives in the day panel. The month-level **Ramadan Summary** pins to the **top of the day panel** when the viewed month overlaps Ramadan (relocated from the old footer). |
| 07 | Grid height | **Always reserve 6 week-rows** (render the full matrix incl. blank trailing cells). Constant grid height → the divider + day panel never shift when month row-counts differ (4 / 5 / 6). Day cells keep a fixed size; short months show blank space at the grid's bottom. |
| 08 | `/[date]` route | **Kept**, glass-restyled. Still reached from Home (`index.tsx`) and the Ramadan-summary deep link path. It and the inline panel **share** the same day-detail components (no duplication). |
| 09 | Skin | Adopt the glass system: `Screen` / `GlassSurface` (tiers) / typed `Text` / `useHaptics` / `constants/motion` presets / `theme.radii`/`materials`/`type` + refreshed palette. Replace all flat `black@22%` cards and ad-hoc `typography`/`fontFamily` usage. |

## 4. Architecture

### 4.1 Shared day-detail component

Extract the day's content into a reusable component (working name **`DayDetailPanel`**, `components/calendar/`):

- **Props:** `date: Date`, `isToday: boolean`, `holiday: string | null`, plus the data/handlers it needs (prayer times + loading/error, `nextPrayer`, ramadan tracker state + toggle). Keep it presentational; data comes from hooks in the host.
- **Renders, top-to-bottom:** (optional) Ramadan **summary** card → day title + Hijri date + holiday chip row → (optional) per-day Ramadan **toggle** → **PrayerArc** (live or static) → error / empty states.
- **Consumers:**
  - **`Calendar.tsx`** — rendered inline beneath the grid for the selected day.
  - **`[date].tsx`** — rendered inside the existing standalone route (glass back header retained; the route keeps its own day Prev/Next swiper for the Home/deep-link entry, restyled — see §7).

### 4.2 PrayerArc — add a static mode

`PrayerArc` currently always draws the live layer. Add a `live?: boolean` (default `true`). When `live === false`:
- Hide the sun/moon glyph and the gold progress `Path` (the `strokeDasharray` segment).
- Render every prayer marker in the neutral "upcoming" style (no gold "next" ring, no breathing animation).
- Swap the label from `TODAY'S PRAYERS · NEXT …` to `PRAYER TIMES`; the six-time row drops the gold "next" / dimmed "passed" coloring (all neutral).
- Skip the breathing `Animated.loop` entirely when not live (perf + correctness).

The host passes `live={isToday}`. (`prayerStates`/`sunMarker` already degrade when `nextPrayer` is null / `now` is off-day; the flag makes the intent explicit and prevents a stray "next" highlight.)

### 4.3 Layout & scroll

- Outer frame: adopt the shared **`Screen`** component (full-bleed gradient + `Aurora` + safe-area), replacing the hand-rolled `LinearGradient`+`Aurora`+`SafeAreaView` in `Calendar.tsx`.
- **Header + weekday row + grid are fixed** (do not scroll). The grid is a constant-height block (§3-07).
- **Only the day panel scrolls** — an inner `ScrollView` filling the remaining flex, with `contentContainerStyle` `paddingBottom: useBottomTabBarHeight() + spacing`. The panel is not full-bleed at the top (the fixed grid sits above it), so it needs no `SafeAreaView` of its own.
- Month-swipe (`useCalendarNavigationTransitions`) stays on the **grid** only. No horizontal gesture on the panel (days change via grid taps), which removes the old two-swiper conflict.

### 4.4 Selection state

`Calendar.tsx` gains a `selectedDate: Date | null` state plus the per-day hooks for it:
- `usePrayerTimes(selectedDate)`, `useNextPrayer(selectedDate, …)`, `useRamadanTracker(selectedDate, ramadanStart, ramadanEnd)` — the same hooks `[date].tsx` uses today, now hosted on Calendar.
- Selecting a grid day sets `selectedDate`. Default selection per §3-05.
- Month-level data (`useCalendarData`, holiday map, ramadan window/summary) stays as-is.

## 5. The states (explicit)

| State | Day panel shows |
|-------|-----------------|
| **Today selected** | Live `PrayerArc` (sun on arc, gold progress, breathing next-ring), holiday chip if any, Ramadan toggle if in Ramadan. |
| **Other day selected** | Static `PrayerArc` (no live layer), holiday chip if any, Ramadan toggle if in Ramadan. |
| **No day selected** | Centered prompt: *"Tap any day to see its prayer times & events."* (Only occurs when viewing a month with no today, or before first selection.) |
| **Loading** | `PrayerArc` skeleton / existing loading affordance for the selected day. |
| **Error** | Glass error card with Retry (and Open-Settings when permission-related), restyled from the current `ErrorBox`. |
| **Ramadan month** | Ramadan **Summary** card pinned at the top of the panel; tapping it selects the first missed-fast date inline (navigating the grid to that month if needed). |

## 6. Navigation / route changes

- **Calendar grid tap:** no longer `router.push("/[date]")` — sets `selectedDate` inline. The fade-then-push logic (`handleDatePress`) is replaced by an inline select (with a calm cross-fade of the panel content, **not** an opacity animation on any glass surface — see §9).
- **Ramadan summary tap:** no longer pushes — selects the first missed-fast date inline (sets month + `selectedDate`).
- **Home (`index.tsx`):** unchanged — still `router.push("../[date]")`. `/[date]` remains a valid route.
- **`[date].tsx` back action:** unchanged in behavior (returns to Calendar), restyled.

## 7. `/[date]` standalone route (kept)

- Stays registered for Home + any deep links.
- Inner content swapped to the shared `DayDetailPanel`; the surrounding glass **back-to-Calendar** header and the existing day Prev/Next + swipe wrapper are **retained** (a single-day landing benefits from day stepping), now glass-restyled.
- Full glass skin: `Screen`-style full-bleed background, `GlassSurface` cards, typed `Text`, haptics on day change / back.

## 8. Motion & haptics

- **Selection feedback:** `useHaptics("selection")` on grid day tap; `"light"` on Ramadan toggle; `"selection"` on month change.
- **Panel transition:** when `selectedDate` changes, cross-fade/slide the panel **content** using `constants/motion` presets. Never animate the opacity of a `GlassView`/`GlassSurface` parent (breaks glass rendering — §9). Animate translateX or inner non-glass children, or use the built-in glass `animate` config.
- Respect Reduce Motion (skip the breathing ring / fall back to plain fades).

## 9. Risks & constraints

- **Glass opacity animation is forbidden.** `GlassView` stops drawing when its (or a parent's) opacity is animated to/away from a value (Expo known issue). The current `[date].tsx` swipe animates opacity; the redesigned panel/route must animate **translateX only** on glass, or animate non-glass children. Applies to the inline panel cross-fade and the retained `[date]` swiper.
- **`PrayerArc` breathing loop** must be disabled in static mode (don't run an `Animated.loop` for every non-today selection).
- **Fixed 6-row grid** trades a little bottom whitespace on short months for a stable panel — accepted (matches iOS Calendar).
- **Vertical budget on small phones** (`width < 360`, `dayButtonSize 34`): grid (6 rows) + panel must coexist; the panel scrolls, and `PrayerArc` is compact, so this fits, but verify on a small device.
- **Theme toggle + glass** may require remounting glass (Expo issue noted in the foundation spec) — verify Calendar across all 3 themes.

## 10. Out of scope

- No change to prayer-time calculation, holiday resolution, or Ramadan-tracker persistence logic.
- No change to month-range limits (`minDate`/`maxDate`) or the back-to-today affordance (restyled only).
- No new calendar systems / dual Hijri-Gregorian grid labeling (the grid stays Gregorian with the Hijri date shown in the day panel, as today).
- Home screen and other tabs unchanged beyond what the shared components require.

## 11. Testing

- `npm run verify` (lint + typecheck + test) green.
- **Contract tests to update** (behavior changed):
  - `__tests__/navigation/routes-params.contract.test.tsx` — the "pushes `/[date]` from the calendar grid" and "pushes `/[date]` from Ramadan summary" cases become **inline-selection** assertions; the `[date]` decode/back-to-Calendar case stays.
  - `__tests__/navigation/navigation-contracts.test.tsx` — same grid-tap behavior change.
  - `__tests__/screens/screen-contracts.test.tsx` — Calendar no longer pushes on grid tap; Home's `"../[date]"` push assertion stays.
- Add coverage for: default-select-today, no-today prompt, static-vs-live `PrayerArc`, Ramadan summary inline jump, and stable panel position across 4/5/6-row months.
- Update `__tests__/README.md` if suites change.
- On-device glass QA (iOS 26, older iOS, Android fallback) across all 3 themes; Reduce Motion / Reduce Transparency.

## 12. References

- Foundation: `devDocs/superpowers/specs/2026-06-16-visual-refresh-liquid-glass-design.md`
- Sibling screen redesigns: qibla / quran / mosques specs in the same folder
- Primitives: `components/ui/{Screen,GlassSurface,Text,Aurora}.tsx`, `components/PrayerArc.tsx`, `constants/{theme,motion}.ts`, `hooks/useHaptics.ts`
- Relevant Expo glass issues (no-opacity-animation, theme remount): #41024, #43743
