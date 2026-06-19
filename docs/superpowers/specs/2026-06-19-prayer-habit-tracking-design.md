# Prayer & Habit Tracking — Design

**Date:** 2026-06-19
**Branch:** feat/ui-revamp
**Status:** Approved design, pending implementation plan

## Overview

Add prayer logging and a flexible habit tracker to Sirat. Users log each of the
five daily prayers with one of three states (Prayed / Late / Missed), build a
custom list of habits with daily-or-weekly frequency, and view streaks,
monthly completion, and a qada (make-up) counter. All data is local
(AsyncStorage); cloud sync / accounts are explicitly out of scope and designed
around for a later feature.

## Goals

- Log the 5 daily prayers in context, directly on the existing prayer arc.
- Track arbitrary user-defined habits with flexible frequency (daily or N×/week).
- Review history and edit any past day from the Calendar screen.
- Surface motivation: streaks, monthly completion %, qada counter.
- Remind users via a **new, separate** notification service (streak-aware nudges),
  independent of the existing prayer-time notifications.

## Non-Goals (YAGNI)

- No accounts, auth, or cloud sync (future feature; data model leaves room).
- No social/sharing/leaderboards.
- No prayer sub-states beyond Prayed / Late / Missed (no jama'ah/at-mosque split).
- No backend changes — this is frontend-only.

## Scope Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Feature scope | Prayers (rich-ish status) + flexible Islamic habit list |
| Prayer states | **Prayed**, **Late**, **Missed** (3 states) |
| Placement | Logging folds **into the PrayerArc**; full stats/habits on a dedicated screen reached from Home; per-day editing in Calendar |
| Habits | Custom, with presets; **flexible frequency** (daily OR N×/week), per-habit streaks |
| Reminders | **New notification service**, separate from prayer notifications; streak-aware (e.g. "your 12-day streak is at risk") |
| Backfill | Any past date, no limit |
| Stats screen | Streaks + monthly completion % + habit management + qada counter |
| Display font | One characterful display font for large stat numerals only (via `expo-font`); rest stays on system stack |
| Iconography | **No emojis** except the streak flame. All other icons via `@expo/vector-icons` (Ionicons) or custom `react-native-svg`. Habit icons chosen from a curated Ionicons set. |

## Architecture

Follows the existing service convention (cf. `quranDisplayModes.ts`,
`ramadanTracker.ts`): a sync in-memory cache + async load/persist +
`DeviceEventEmitter` events for cross-screen sync. UI stays thin and delegates
to services and hooks.

### New services (`frontend/services/`)

```
tracking/
  types.ts              # PrayerStatus, PrayerLog, Habit, HabitLog, frequency types
  prayerLog.ts          # CRUD for per-day prayer status, qada tally
  habits.ts             # Habit definitions: create/edit/reorder/archive
  habitLog.ts           # Per-day habit completion records
  stats.ts              # Pure functions: streaks, completion %, weekly progress
  reminders.ts          # NEW notification service (streak-aware), separate scheduler
prayerTracker.ts        # Facade re-exporting prayerLog + qada
habitTracker.ts         # Facade re-exporting habits + habitLog + stats
```

`stats.ts` is pure (no storage/IO) so it is trivially unit-testable.

### New hooks (`frontend/hooks/`)

- `usePrayerLog(date)` — status map for a day + setter, listens to events.
- `useHabits()` — habit list (active, ordered) + mutations.
- `useHabitLog(date)` — completion state for a day + toggler.
- `useTrackingStats()` — derived streaks/completion/qada for the stats screen.

### New components

- `components/tracking/PrayerLogSheet.tsx` — bottom sheet (uses existing
  `@gorhom/bottom-sheet`) with the 3 status options.
- `components/tracking/PrayerStatusDots.tsx` — the status indicator row rendered
  under the arc columns (SVG dots, not emoji).
- `components/tracking/StreakHero.tsx` — large numeral + flame.
- `components/tracking/CompletionRings.tsx` — per-prayer SVG rings.
- `components/tracking/MonthHeatmap.tsx` — calendar grid heatmap (SVG/Views).
- `components/tracking/QadaCard.tsx` — make-up counter.
- `components/tracking/HabitRow.tsx` + `HabitEditor.tsx` — list row + add/edit form.

### New screen

- `app/Tracker.tsx` — the dedicated stats + habits screen (stack route, like
  Settings / QuranPageReader). Registered in `app/_layout.tsx`. Reached via a
  "View tracker & habits" affordance on Home.

## Data Model

```ts
type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
type PrayerStatus = "prayed" | "late" | "missed";

// Every synced value is wrapped in a cell carrying a last-modified stamp so
// cloud sync (future) can resolve multi-device conflicts with last-write-wins.
// updatedAt is epoch-ms (Date.now()).
type Cell<T> = { value: T; updatedAt: number };

// Per-day prayer log. Key by local date "YYYY-MM-DD" (matches existing dateKey()).
type PrayerLog = Record<string /*dateKey*/, Partial<Record<PrayerName, Cell<PrayerStatus>>>>;

type HabitFrequency =
  | { type: "daily" }
  | { type: "weekly"; timesPerWeek: number }; // 1..7

type Habit = {
  id: string;            // uuid-ish (Date-free generator; see note)
  name: string;
  icon: string;          // Ionicons glyph name
  frequency: HabitFrequency;
  reminder?: { enabled: boolean; time?: string /*HH:mm*/ };
  order: number;
  archived: boolean;       // soft delete; syncs as a normal field flip
  createdAtKey: string;    // dateKey of creation
  updatedAt: number;       // epoch-ms; bumped on any edit, for LWW merge
  deletedAt?: number;      // tombstone; set on hard delete so the removal propagates
};

// Per-day habit completion. dateKey -> habitId -> done cell.
type HabitLog = Record<string /*dateKey*/, Record<string /*habitId*/, Cell<boolean>>>;
```

Notes:
- `Date.now()`/`Math.random()` are fine in app runtime (the workflow-script
  restriction does not apply here), but prefer a small id helper for testability.
- IDs must be globally unique (uuid-style), not sequential, so two offline
  devices never mint the same habit id before a first sync.

## Storage Keys (versioned)

Add to the CLAUDE.md AsyncStorage registry:

- `tracking:prayer_log_v1` — `PrayerLog` JSON
- `tracking:habits_v1` — `Habit[]` JSON
- `tracking:habit_log_v1` — `HabitLog` JSON
- `tracking:reminder_prefs_v1` — reminder master toggle + scheduled ids
- (qada is **derived** from `prayer_log` `missed` count minus made-up entries;
  if explicit make-up tracking is needed, add `tracking:qada_resolved_v1`)

Values are stored as `Cell<T>` (value + `updatedAt`); habits carry `updatedAt`
and an optional `deletedAt` tombstone (see Sync-Readiness). Reads filter out
tombstoned habits and unwrap cells so callers see plain values.

## DeviceEventEmitter Events

Add to the documented event list:

- `PRAYER_LOG_UPDATED` — payload `{ dateKey }`
- `HABITS_UPDATED` — habit list changed (add/edit/reorder/archive)
- `HABIT_LOG_UPDATED` — payload `{ dateKey }`

Home, Calendar, and Tracker screens subscribe to keep in sync (same pattern as
`settingsChanged`, `QURAN_DISPLAY_MODES_UPDATED`).

## UI Integration

### PrayerArc (logging folds in)

`PrayerArc` already renders a row of prayer name/time columns and already knows
`passed | next | upcoming` state and whether it is `live`. Extend it:

- Add an optional `logging` mode. When on, render a `PrayerStatusDots` indicator
  under each column: emerald=prayed, gold=late, red=missed, dashed ring on the
  `next`/loggable prayer, faint dot for upcoming.
- Tapping a loggable column opens `PrayerLogSheet` for that prayer.
- Status colors reuse theme tokens: `accentSecondary` (emerald) / `accent`
  (gold) / `danger` (red). No new color constants.
- Keep `PrayerArc` backward compatible: `logging` defaults off so existing
  non-logging usages (if any) are unaffected.

### Home (`app/(tabs)/index.tsx`)

- Enable `logging` on the existing arc instance (no second card).
- Add a compact streak chip in the arc card header and a "View tracker &
  habits →" affordance that routes to `/Tracker`.

### Calendar (`DayDetailPanel`)

- The panel already renders a `PrayerArc` for the selected day; enable `logging`
  so any past/any date is editable (mirrors the existing Ramadan missed-fast
  editing already woven into Calendar).
- Add a habits checklist for the selected day below the arc.

### Tracker screen (`app/Tracker.tsx`)

Two logical sections (single scroll or segmented):

1. **Overview** — `StreakHero`, `CompletionRings` (per-prayer, this month),
   `MonthHeatmap`, `QadaCard`.
2. **Habits** — `HabitRow` list with frequency badges + per-habit streaks,
   drag-to-reorder, swipe-to-archive, "+ New habit" → `HabitEditor`.

Full-bleed Aurora background per the safe-area convention (scrollable screen →
no `SafeAreaView`; apply `useSafeAreaInsets()` as content padding).

## Stats Logic (`stats.ts`, pure)

- **Prayer streak:** consecutive days (ending today or yesterday) where all 5
  prayers are logged as `prayed` or `late` (not `missed`, not empty). Define
  "today counts as not-yet-broken until day end."
- **Habit streak:** per habit. Daily habits → consecutive completed days.
  Weekly (N×/week) habits → consecutive weeks meeting the target.
- **Monthly completion %:** logged-non-missed / total-eligible for the visible
  month, overall and per-prayer (drives the rings).
- **Qada count:** total `missed` prayers minus resolved make-ups.

All boundary rules (timezone, "today incomplete") get explicit unit tests.

## Reminders (new notification service — `tracking/reminders.ts`)

Separate from `notificationService.ts`. Same building blocks (`expo-notifications`,
its own scheduler/storage), but a distinct concern and its own AsyncStorage key
and (Android) notification channel.

- **Streak-aware nudges:** if a habit has an active streak and isn't completed by
  its reminder time, schedule a gentle "your N-day streak is at risk" reminder.
- Per-habit opt-in (`Habit.reminder`), plus a master toggle in
  `tracking:reminder_prefs_v1`.
- Reschedule on `HABITS_UPDATED` / `HABIT_LOG_UPDATED`.
- Reuses `permissions.ts` patterns; must not interfere with prayer-time channels.

## Visual / Design Notes

- Aesthetic stays inside Sirat's existing language (Aurora deep-green gradient,
  gold `#E8C77A` + emerald `#3FB984`, glass surfaces). Apply craft via hierarchy,
  one dominant hero numeral, layered radial glows + faint grain, choreographed
  reveals (Reanimated, already a dependency).
- **Display font:** load one characterful display face via `expo-font` used
  *only* for large stat numerals (`StreakHero`, ring %, qada). Body/UI keep the
  system stack. Pick a tabular-figures face so numbers align.
- **Icons:** Ionicons or custom SVG everywhere; the streak flame is the only
  emoji permitted. Habit creation offers an Ionicons glyph picker.
- Reveal choreography: hero scales in, rings draw stroke, heatmap cells stagger.

## Testing

- `stats.test.ts` — streak boundaries (broken by missed, broken by gap, today
  incomplete), weekly-frequency streaks, completion %, qada tally. Pure, fast.
- `prayerLog.test.ts` / `habits.test.ts` / `habitLog.test.ts` — CRUD + cache
  reset pattern (`jest.resetModules()` + `require()` in a loader, per existing
  `quranData.test.ts` convention).
- Screen-contract test updates: any screen mocking tracking services must expose
  the new service surface (mirror the `quranData`/`useQuranReadingMode` mock
  pattern in `screen-contracts.test.tsx`).
- Frontend Jest is Babel-based — no dynamic `await import()`; use static imports +
  top-level `jest.mock()`.
- Update `frontend/__tests__/README.md` when adding suites.

## Sync-Readiness (accounts / cloud sync — future)

The local schema is designed so a future sync layer drops in without a data
migration. The big lift will be backend-side (the API is currently a stateless
proxy with **no datastore**; accounts need auth + a per-user document store) —
that is its own spec. This feature only needs to make the *local* model
forward-compatible:

- **Per-cell `updatedAt`** (`Cell<T>`) on every prayer-status and habit-completion
  value, plus `updatedAt`/`deletedAt` on habit definitions. Enables
  **last-write-wins per cell** — correct for this data because every value is a
  small enum or boolean, so cross-device conflicts are trivial (no CRDTs needed).
- **Tombstones** (`deletedAt`) so hard deletes propagate instead of resurrecting
  from another device. Archiving stays a soft flag that syncs normally.
- **Offline-first stays the model:** AsyncStorage remains the source of truth;
  the cloud is a background mirror. Sync = pull remote, merge (LWW per cell),
  push local diffs.
- **First-login merge:** a pure `merge(local, remote)` function (unit-tested
  alongside `stats.ts`) does a per-cell union, keeping the higher `updatedAt`.
- **Sync granularity:** the on-disk shape stays one blob per key for simple local
  reads; the sync layer can later read/write per-day / per-habit slices to avoid
  uploading years of history wholesale. No model change required.

Local read ergonomics note: services unwrap `Cell<T>` at the boundary so the
rest of the app (and `stats.ts`) works with plain `PrayerStatus` / `boolean`,
not the wrapper. The stamp is an implementation detail of the storage layer.

## Open Questions

- Exact display font choice (defer to implementation; must ship with a license
  compatible with app bundling).
- Whether qada needs explicit make-up logging vs. a pure derived count (start
  derived; add `qada_resolved_v1` only if users need to "check off" make-ups).
