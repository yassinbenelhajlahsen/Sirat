# Prayer Window Reminders — Design

**Date:** 2026-06-22
**Branch:** feat/prayer-window-reminders (to be created off `main`)
**Status:** Approved design, pending implementation plan

## Overview

Add an optional "window reminder" notification: a heads-up sent a fixed number
of minutes before the **next** prayer begins, warning the user that the
**current** prayer's time is about to run out. The reminder is sent only if the
user has **not** logged that prayer in the tracker. It coexists with the
existing at-prayer-time notifications and is configured in a new subsection of
the existing Notifications card.

Example: Dhuhr is 1:00 PM, Asr is 5:30 PM, reminder set to 15 min. If the user
never logged Dhuhr, a notification fires at 5:15 PM:

> **Dhuhr ending soon**
> Asr begins at 5:30 PM, in 15 min.

If the user had marked Dhuhr (prayed, late, or missed) at any point before
5:15 PM, no reminder is sent.

This is frontend-only. No backend changes.

## Goals

- Nudge users to pray before the current prayer's window closes, only when they
  have not already logged it.
- Reuse the existing notification scheduling, rescheduling, and preferences
  infrastructure rather than building a parallel system.
- Keep the UI inside the existing Notifications card, matching the established
  prayer-alerts pattern.
- Stay within the iOS hard cap of 64 pending local notifications.

## Non-Goals (YAGNI)

- No Isha reminder (Isha has no same-day next prayer; explicitly excluded).
- No per-prayer "minutes before" values — one global value for all reminders.
- No Sunrise reminder (Sunrise is not a tracked prayer, so there is nothing to
  suppress against).
- No new background-fetch reschedule path in this feature (see Known
  Limitations); reuse the existing midnight + app-foreground triggers.
- No backend / sync changes. These preferences are device-local, like all other
  `notif_*` keys, and never sync.

## Scope Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Relationship to existing alerts | **Coexist.** New subsection inside the existing Notifications card, below "Prayer alerts". Both notification types can fire independently. |
| Granularity | **Per-prayer on/off + one global "minutes before".** |
| Eligible prayers | **Fajr, Dhuhr, Asr, Maghrib.** Isha and Sunrise excluded. |
| Window boundary | Each reminder fires `offset` minutes before the **next scheduled time**: Dhuhr→Asr, Asr→Maghrib, Maghrib→Isha, and **Fajr→Sunrise** (Fajr's window ends at sunrise). |
| Suppression condition | Skip the reminder if the prayer has **any** logged status (`prayed`, `late`, or `missed`). |
| "Minutes before" control | **Preset segment**: 5 / 15 / 20 / 30 min. Default 15. Matches the existing Adhan Sound segment control. |
| Notification copy | Plain text, no em dashes, no assumption that the user uses the tracker. Title `"{Prayer} ending soon"`, body `"{Next} begins at {time}, in {X} min."` |
| iOS 64-cap handling | Budget at-prayer and window reminders together; generate all candidates, sort by fire time ascending, schedule the soonest 60. |

## Window Model

The five tracked prayers and Sunrise form an ordered daily sequence:

```
Fajr → Sunrise → Dhuhr → Asr → Maghrib → Isha → (next day) Fajr
```

A window reminder for prayer P fires at `nextTime(P) - offset`, gated on P not
being logged, where:

| Reminder for | Fires before | Gated on (not logged) |
|---|---|---|
| Fajr | Sunrise | Fajr |
| Dhuhr | Asr | Dhuhr |
| Asr | Maghrib | Asr |
| Maghrib | Isha | Maghrib |
| ~~Isha~~ | — (no same-day next) | excluded |

`offset` is the global "minutes before" value.

## UX — Settings

Lives in `components/NotificationSettings.tsx`, inside the existing
`GlassSurface` Notifications card, as a third subsection ordered **after "Prayer
alerts" and before "Adhan Sound"** — this groups the two "what to notify"
sections together, then the "how it sounds" section last. Shown only when
notifications are enabled (inside the existing reveal section).

Subsection contents:

- **Title:** "Window reminders"
- **Description:** "A heads up before a prayer's time runs out. Sent only if you
  have not logged it yet." (plain text, no em dashes)
- **Minutes control:** preset segment `5 min | 15 min | 20 min | 30 min`,
  default 15, styled like the existing Adhan Sound segment control.
- **Per-prayer toggles:** a grid of four pressables — Fajr, Dhuhr, Asr, Maghrib
  — reusing the exact visual pattern of the existing prayer-alerts grid (Ionicon
  + "On"/"Off" label, accent when on, muted when off). **Icons are Ionicons, not
  emoji** (the emoji in the brainstorming mockup were illustrative only).

Default state on first run: feature effectively off (all four per-prayer toggles
off), offset 15. Toggling any prayer on enables that reminder.

## Notification Message

Title and body are separate notification fields, so no joining dash is needed.

- **Title:** `{Prayer} ending soon` — e.g. `Dhuhr ending soon`
- **Body (prayers):** `{Next} begins at {time}, in {offset} min.` — e.g.
  `Asr begins at 5:30 PM, in 15 min.`
- **Body (Fajr, whose next is Sunrise):** `Sunrise is at {time}, in {offset} min.`
  (uses "is at" rather than "begins at" since sunrise is not a prayer.)

`{time}` is the next event's local time in the same 12-hour format the
prayer-times service already returns. No emoji in the title (the user asked for
simple text); this intentionally differs from the existing at-prayer-time
notifications, which prefix `PRAYER_EMOJI`.

Notification `data` payload (for tap handling / dedup), mirroring the existing
`"prayer"` shape:

```ts
{
  type: "window_reminder",
  label,            // PrayerKey the reminder is about (e.g. "Dhuhr")
  nextLabel,        // the next event ("Asr" / "Sunrise")
  nextTimeLocal,    // 12h string
  offset,           // minutes
  dayKey,           // "YYYY-MM-DD"
}
```

## Architecture

Reuse the existing notification stack. No new service module is required; extend
the existing scheduler, preferences hook, and storage.

### Storage (new AsyncStorage keys)

| Key | Type | Purpose |
|---|---|---|
| `notif_window_map_v1` | JSON `Record<"Fajr"\|"Dhuhr"\|"Asr"\|"Maghrib", boolean>` | per-prayer on/off for window reminders |
| `notif_window_offset_v1` | string (minutes, e.g. `"15"`) | global "minutes before" value |

Follows the existing convention (cf. `notif_map_v1`, `notif_sound_mode_v1`).
These are device-local and excluded from sync, like all `notif_*` keys.

### Preferences (`hooks/useNotificationPreferences.ts`)

Extend the hook to hydrate, persist, and expose:

- `windowPrefs: Record<PrayerKey, boolean>` and `setWindowPreference(prayer, value)`
- `windowOffset: number` and `setWindowOffset(minutes)`

Include both in the `NOTIF_PREFS_UPDATED` event payload so the existing
lifecycle listener reschedules on change (already wired:
`NOTIF_PREFS_UPDATED → rescheduleAll("notif-prefs-changed")`).

### Scheduler (`services/notifications/`)

Extend candidate generation. Today the scheduler builds at-prayer-time
notifications per day across the horizon. Add window-reminder candidates:

For each day in the horizon, for each eligible prayer P (Fajr, Dhuhr, Asr,
Maghrib) whose window toggle is on:

1. Resolve `nextTime(P)` from that day's prayer times (Fajr→Sunrise, else the
   following prayer).
2. `fireDate = nextTime(P) - offset`.
3. Skip if `fireDate` is in the past.
4. Skip if P is already logged for that dayKey (`getDayStatuses(dayKey)` has an
   entry for P's lowercased name, i.e. any of prayed / late / missed).
5. Otherwise emit a candidate `{ type: "window_reminder", fireDate, ... }`.

The suppression check (step 4) reads the tracker at schedule time. Because
marking a prayer emits `PRAYER_LOG_UPDATED`, which triggers `rescheduleAll`
via the `"prayer-log-changed"` reason (wired in `lifecycle.ts`), logging a
prayer cancels its pending reminder on the next reschedule.

### Combined cap (iOS 64 limit)

iOS keeps only the **soonest-firing 64** pending local notifications per app and
silently discards the rest (Apple `scheduledLocalNotifications` docs; confirmed
per-app, hard, by an Apple engineer on the Developer Forums). The cap is
**per-app**, shared across the existing at-prayer alerts and the new reminders.

Algorithm change in `rescheduleAll`:

1. Generate **all** candidates within the horizon — both at-prayer-time and
   window-reminder.
2. Sort by `fireDate` ascending.
3. Schedule only the soonest **60** (4-slot headroom under 64; this app has no
   other notification sources). Drop the rest; the midnight and app-foreground
   reschedules refill the rolling window as time advances.

When window reminders are all off, candidate count is unchanged from today
(≈ at-prayer alerts over the 10-day horizon), so existing behavior does not
regress. When reminders are on, the 60-slot budget covers fewer calendar days
but includes both types in soonest-first order — matching what iOS would evict
to anyway, while keeping our own bookkeeping accurate.

### Identity & dedup

- Reuse the existing tracked-IDs array (`notif_schedule_ids_v1`) for cleanup;
  window-reminder schedule IDs are tracked alongside at-prayer IDs.
- Extend the seen-key scheme to include type so the two notification kinds never
  collide on the same minute, e.g. `window_{label}_{ISO-minute}` vs the existing
  `{label}_{ISO-minute}`.
- Keep the existing day-key fingerprint (`notif_daykey_v1`) rebuild-vs-incremental
  mechanism; the offset and window map become part of the fingerprint inputs so a
  change forces a rebuild.

## Events & Reschedule Triggers

- `NOTIF_PREFS_UPDATED` — window prefs/offset changes (new payload fields).
- `PRAYER_LOG_UPDATED` — a new `"prayer-log-changed"` reschedule reason was
  added to `RescheduleReason` and a `PRAYER_LOG_UPDATED` listener was wired in
  `lifecycle.ts`. This reason forces a heavy rebuild (`cancelPreviouslyScheduled`
  then a fresh `scheduleForHorizon`), which re-evaluates suppression and drops
  the now-logged prayer's pending reminder.
- `settingsChanged`, midnight (00:05), app-foreground, init — unchanged.

## Edge Cases

- **Prayer already logged at schedule time** — candidate skipped (step 4).
- **Fire time already passed** — candidate skipped (step 3); covers the case
  where reschedule runs after the reminder time.
- **Fajr window** — next event is Sunrise; reminder uses Sunrise time and the
  "is at" body phrasing. Requires Sunrise to be present in the day's prayer times
  (it is, per `prayerTimes` output).
- **Day rollover for Maghrib→Isha** — same-day, no rollover needed.
- **Isha** — no candidate generated.
- **Offset larger than the gap between prayers** — if `nextTime(P) - offset`
  lands before P's own time (e.g. a very large offset on a short window), still
  schedule if in the future; it simply fires earlier. Acceptable; the preset max
  is 30 min, which is always well inside real prayer gaps.
- **Log-then-immediately-background race** — logging emits `PRAYER_LOG_UPDATED`
  synchronously, triggering reschedule; the cancel should complete. Worst case a
  single stale reminder fires. Acceptable, documented.

## Testing

Extend `services/notificationService.test.ts` (mock `getDayStatuses`):

- Schedules a window reminder at `nextTime - offset` for an unlogged eligible
  prayer.
- Does **not** schedule when the prayer is logged (prayed / late / missed each).
- Fajr reminder targets Sunrise time and uses the "is at" body.
- No Isha reminder is ever generated.
- Past fire times are skipped.
- Combined candidate set is sorted by fire time and capped at 60.
- Message title/body format for a representative case
  (`Dhuhr ending soon` / `Asr begins at 5:30 PM, in 15 min.`).

Per repo convention, update `frontend/__tests__/README.md` if a new test suite
file is added.

## Known Limitations

- **No background reschedule.** Like the existing at-prayer notifications, the
  rolling window only advances on midnight (while the app is alive) and on
  app-foreground. If the app stays closed for longer than the scheduled window
  (now shorter when reminders are on, ~6 days under the 60-slot budget), later
  reminders will not fire until the app is next opened. This is an existing
  limitation inherited, not a regression. A future enhancement could add
  `expo-background-fetch` to advance the window in the background; out of scope
  here.
- **Suppression is schedule-time, refreshed on reschedule.** A reminder is
  cancelled when its prayer is logged because logging triggers a reschedule. If
  the OS fires the notification in the same instant the user logs (sub-second
  race), a stale reminder may surface once.

## Sources

- Apple — `scheduledLocalNotifications`: "the system keeps the soonest-firing 64
  notifications … and discards the rest."
  https://developer.apple.com/documentation/uikit/uiapplication/scheduledlocalnotifications
- Apple Developer Forums — 64 is a hard per-app system limit:
  https://developer.apple.com/forums/thread/811171
- Expo Notifications SDK (no built-in 64-cap management):
  https://docs.expo.dev/versions/latest/sdk/notifications/
