# Frontend Tests

This folder contains frontend automated tests for the Expo/React Native app.

## Structure

- `app/`: root layout/bootstrap behavior tests
- `components/`: shared UI contract tests
- `screens/`: tab/screen contract tests
- `navigation/`: route registration and param contracts
- `flows/`: integration-style user-flow tests
- `hooks/`: behavior tests for reusable hooks
- `services/`: unit tests for service modules (API, storage, matching, scheduling, caching)
- `constants/`: token/constant value tests
- `utils/`: pure utility function tests

## Phase Coverage

- `notification scheduling lifecycle testing`
  - `services/notificationService.test.ts` — master/permission gate, apply schedule, cancel on failure, overlapping requests collapse into one extra run
  - `services/notifications/planner.test.ts` — pure planner: alert/window/Friday/Iftar planning, seen keys, 60 budget, plan fingerprint
  - `services/notifications/scheduler.test.ts` — IO layer: reads inputs, replaces pending notifications only when the plan changed, tops up otherwise
  - `services/notifications/lifecycle.test.ts` — what triggers a reschedule (each synced setting, master switch, Pretend Ramadan, prayer log, foreground, midnight)
  - `services/notifications/push.test.ts` — push announcements: registers on a real iOS device with permission and the switch on, 24h re-register, unregisters on switch off or revoked permission, retries a failed unregister, serialized runs, fixed bug-log message
  - `services/notifications/*.test.ts`
  - `utils/notifications/fridayReminder.test.ts` — Friday reminder picks: 10+ messages, 9:00 to 10:59 window, same result for a given Friday, varies across weeks
  - `services/notifications/response.test.ts` — notification tap routing: `data.url` opens the route, other types do nothing, one response routes once
  - `services/notifications/cityResolver.test.ts` — city-display fallback chain (caller coords → live position → last-known → cached → "your area"; never raw coordinates)
- `prayer times retrieval + caching testing`
  - `services/prayerTimes.test.ts`
  - `services/prayerDay.test.ts` — prayer day: 12-hour parsing onto a date, dropped bad rows, next slot, window end, Maghrib, clock formatting
  - `services/prayer-times/*.test.ts`
- `home prayer feature behavior testing`
  - `hooks/usePrayerDay.test.ts` — browsed day: backoff retry, gives up after three retries, location vs generic errors
  - `hooks/usePrayerDay.live.test.ts` — today view (Home): place label, tomorrow's Fajr, reload on settings change and foreground
  - `hooks/usePrayerDay.location.test.ts` — the real facade and location code throw the typed error that offers Open Settings
  - `hooks/usePrayerDay.marks.test.ts` — prayer marks, log sheet wiring, Hijri date (turns at Maghrib for today)
- `settings permission sync on bootstrap testing`
  - `app/root-layout-permission-sync.test.ts`
  - `hooks/useSettingsPermissions.test.ts`
  - `hooks/usePrayerSettingsState.test.ts`
- `quran data preload contract testing`
  - `services/quranData.test.ts`
- `quran user state persistence testing`
  - `services/quranBookmarks.test.ts`
  - `services/quranProgress.test.ts`
  - `services/quranDisplayModes.test.ts`
  - `hooks/useQuranDisplayModes.test.ts` — display modes hook: loads, falls back on invalid storage, follows remote changes
  - `services/quranTextScale.test.ts` — reader text size (`quran_text_scale_v1`): defaults, snapping, persistence, update event
  - `hooks/useQuranTextScale.test.ts`
  - `services/quranAudio.test.ts` — reciter list, QuranicAudio URL builder (zero padding, every id), unknown-id fallback
  - `components/quran-ayah-card.contract.test.tsx` — tap reveals Bookmark/Copy actions, long-press copy shortcut, text scaling
  - `components/surah-banner.contract.test.tsx`
  - `components/surah-tab.contract.test.tsx` (navigator Surah tab — search-forward default: Continue reading + Popular, "All Sūrahs" reveal, search mode)
- `quran copy text formatting testing`
  - `services/quranCopyText.test.ts`
- `dua flow testing`
  - `services/duaMatcher.test.ts` — offline matcher (keyword rules + classifier): crisis check and idioms, conflicts, misspellings, accent folding, romanized terms, Arabic script, off-topic requests, every category but General reachable, tuning list passes, held-out list meets the targets (90% correct, 3% wrong topic)
  - `services/duaClassifier.test.ts` — the decision between keyword rules and the classifier (support, override, ties, unknown words) on a toy model; the bundled model is deterministic, under the asset budget, and meets the right/wrong bar on the unseen `scripts/dua-classifier/test.txt`
  - `fixtures/duaHeldOut.ts` — held-out requests with expected topics, written before the scorer and never tuned against: do not edit an entry to improve a result
  - `fixtures/duaTuning.ts` — tuning requests the rules may be adjusted against
  - `services/duaEval.helper.ts` — shared topic-level judging for the two lists (not a test)
  - `services/duaService.test.ts` — includes the no-match and crisis notices, and that history never stores typed text or a notice
  - `hooks/useDuaInteraction.test.ts` — the crisis notice survives Another and clears on close; no-match clears on Another; only the dua is saved
  - `components/dua-result-card.contract.test.tsx` — crisis message (exact text, alert role), no-match line with Browse all duas, copy reports to the screen (the toast lives on Home)
  - `services/duaTopics.test.ts` — every category in duas.json maps to exactly one topic; "another dua" stays in the topic, and in Sleep
  - `services/duaSaved.test.ts` — saved dua ids (newest first, own change event for sync stamping)
  - `screens/settings-notifications.test.tsx` — Settings > Notifications page passes the OS permission status (granted, or denied on read failure)
  - `screens/Duas.test.tsx` — dua library sheet: Saved/Recent rows, topics, pushes inside the sheet; list page shows full duas, saving, Saved empty state
- `location heavy features testing`
  - `hooks/useQibla.test.ts`
  - `components/compass-dial.contract.test.tsx` (CompassDial contract — bearing/distance readout, cardinals, aligned swap)
  - `services/getNearbyMosques.test.ts`
  - `services/getNearbyMosques.cache.test.ts`
  - `utils/geo.test.ts`
  - `components/mosque-row.contract.test.tsx`
  - `components/mosque-sheet.contract.test.tsx`
  - `screens/nearby-mosques.contract.test.tsx` (updated: map-first bottom-sheet screen)
  - `flows/nearby-mosques-refresh.flow.test.tsx`
- `holiday ramadan calendar data integrity testing`
  - `services/holidayService.test.ts`
  - `services/ramadanTracker.test.ts`
  - `hooks/useRamadanTracker.test.ts`
  - `hooks/useCalendarData.test.ts`
  - `components/day-detail-panel.contract.test.tsx` (calendar inline-agenda day detail — today arc, other days as a time list, no logging on future days,/holiday/Ramadan/error states; holiday names render on their own row without a line clamp)
  - `components/calendar/MonthPickerSheet.test.tsx` (month/year picker bottom sheet — year pills, month grid, out-of-range disabling)
  - `components/ramadan-card.contract.test.tsx` — Home Ramadan card: day, suhoor/iftar target and countdown, missed-fast action, hidden outside Ramadan or when off
- `force update gate testing`
  - `services/appVersion.test.ts`
  - `services/apiClient.test.ts`
  - `components/force-update-gate.contract.test.tsx`
- `shared component contracts testing`
  - `components/*.contract.test.tsx`
  - `components/native-sheet.contract.test.tsx` — native sheet keeps its title and content while closing
- `screen level contract tests testing`
  - `screens/screen-contracts.test.tsx`
  - `screens/nearby-mosques.contract.test.tsx`
- `navigation contracts testing`
  - `navigation/navigation-contracts.test.tsx`
  - `navigation/tabs-layout.contract.test.tsx`
  - `navigation/root-layout-navigation.contract.test.tsx`
  - `navigation/routes-params.contract.test.tsx` (trimmed: removed retired MosqueMap route assertion)
- `end to end like user flows testing`
  - `flows/home-settings-refresh.flow.test.tsx`
  - `flows/dua-request-history.flow.test.tsx`
  - `hooks/useDuaInteraction.test.ts` — includes the dua swap animation (safe only while the dua cards are solid, not Liquid Glass)
  - `flows/calendar-missed-fast.flow.test.tsx`
  - `flows/nearby-mosques-refresh.flow.test.tsx`
- `visual refresh foundations (Plan 1) testing`
  - `utils/greeting.test.ts`
  - `utils/devClock.test.ts` — dev-only pretend time of day: real time by default, moves today's clock to the chosen hour and minute, clears back to real time
  - `utils/formatDate.test.ts` — ordinal day suffixes (1st/2nd/3rd/11th-13th) for the dial centre and calendar day title
  - `utils/hijriDate.test.ts` — shared Hijri date: Umm al-Qura (matches the holiday feed), rolls to the next day at Maghrib; `isFastingDay` / `ramadanDayAt` on the Ramadan 1448 boundaries
  - `utils/ramadanCountdown.test.ts` — Home Ramadan card state: hidden/shown, suhoor vs iftar target, Maghrib rollover, last-day end
  - `constants/motion.test.ts`
  - `hooks/useHaptics.test.ts`
  - `components/glass-surface.contract.test.tsx` — glass vs fallback, and the borderless-over-glass default (hairline in the fallback, 1px when `bordered`)
  - `components/ui-text.contract.test.tsx` — type ramp plus Dynamic Type cap (`TEXT_MAX_FONT_SCALE`)
  - `navigation/glass-tab-bar.contract.test.tsx`
- `design audit follow-ups (Sept 2026) testing`
  - `constants/theme-text-tokens.test.ts` — `textPrimary/Secondary/Tertiary/Disabled` and `iconMuted` clear WCAG contrast on every theme's canvas
  - `components/ui/primitives.contract.test.tsx` — shared `Button`, `IconButton` (44pt target + hitSlop), `SheetTitleBar`, `SkeletonBar`
  - `hooks/useReducedMotion.test.ts` — mirrors the OS Reduce Motion setting and its live changes
  - `screens/nearby-mosques.contract.test.tsx` — inline load error with retry (no Alert), `shouldOfferAreaSearch` distance gate
  - `components/compass-dial.contract.test.tsx` — themed Kaaba mark replaces the emoji
  - `components/prayer-times-list.contract.test.tsx` was removed with the unused `PrayerTimesList` component
- `iOS-native polish (Direction A) testing`
  - `components/ui/app-icon.test.tsx` — every `IONICON_TO_SF` entry renders an SF Symbol on iOS and the Ionicon on Android; unmapped names fall back on both
  - `components/ui/segmented.ios.test.tsx` — native segmented control: radiogroup, selected state, `onChange` value
  - `components/ui/section-header.test.tsx` — `SectionHeader` (+ action and footer), `ScreenHeader` (title, supporting line, leading control) and `EmptyState` contracts
  - `components/ui/press-variants.test.tsx` — `PressableScale` `row` renders no transform; `button`/`card` do; the `row` highlight takes its corners from the `radius` prop, falling back to the pressable's own `borderRadius`
  - `components/ui/aurora.test.tsx` — the exported bloom opacities stay toned down
  - `hooks/useScreenMargin.test.ts` — 16 under 400pt, 20 at 430pt
- `splash screen (night sky + khatam) testing`
  - `components/splash-screen.contract.test.tsx` — wordmark set above the type scale in the system face with Dynamic Type pinned off and no tagline, the emblem lettering and the hadith Arabic in Amiri (smaller for a long hadith), today's hadith on the first launch of the day and none on a repeat launch (unless the dev-only "always first-launch splash" switch is on), Hijri date only (no Gregorian), the wordmark anchored identically on both launch paths, and the native splash hidden only after a layout pass
  - `components/splash-sky.test.tsx` — the seeded star field stays at 3–4 twinkle layers with every star inside the screen, and one view renders per star
  - `components/reload-sky.test.ts` — the committed OTA reload-screen PNGs (`assets/reload/sky-*.png`) match the splash sky's gradient and vignette row for row for every theme (re-run `scripts/generate-reload-sky.ts` if it fails)
- `home prayer arc (horizontal progress thumb) testing`
  - `utils/prayer-dial.test.ts` — dial geometry (noon at top, markers at true angular time), ring construction, disc stops, star field, marker fallbacks
  - `utils/sky.test.ts` — solar palette: pins that `suncalc` altitude is in DEGREES, plus horizon/zenith behaviour at low, high and negative sun
  - `components/prayer-dial.contract.test.tsx` — five columns with Sunrise excluded, centre stack (next prayer / tomorrow rollover / date + daylight / logged count / future), and that a non-today date is never mutated
- `tab bar scroll-collapse testing`
  - `utils/tab-bar-chrome.test.ts` — collapse decision, shared pill geometry (`tabBarClearanceForInset`), Reduce Motion gate
  - `hooks/useTabBarClearance.test.ts`
- `in-app feedback testing`
  - `services/diagnostics.test.ts` — hidden bug-report log: 50-entry cap, message/stack truncation, last 10 screens, `console.error` and global-handler capture (original handlers still called), fatal errors persisted, stored entries restored on install, device context
  - `services/feedback.test.ts` — `submitFeedback`: diagnostics only for bugs, trimmed message, empty email omitted
  - `services/reports.test.ts` — `reportDuaMatch` posts only the trimmed request and dua id to `/api/reports`
  - `hooks/useKeyboardAutoScroll.test.ts` — Home scrolls for the keyboard only while it is the focused screen (a keyboard opened in the Settings modal leaves Home still), and drops its padding if it lost focus mid-keyboard
  - `components/record-and-rethrow.test.tsx` — root error boundary records the render error, saves the log, then rethrows so the app still crashes and a bad OTA still rolls back
  - `components/copy-toast.test.tsx` — toast sits near the bottom by default and at the top with `placement="top"` (feedback thank-you)
  - `components/settings/FeedbackSheet.test.tsx` — Send disabled while blank, email prefilled when signed in, bug-only disclosure line, send calls `onSent`, failure keeps the text and shows the error
- `settings liquid-glass redesign testing`
  - `utils/appLinks.test.ts` — About-row link/share/version helpers
  - `services/ratingPrompt.test.ts` — Apple rating prompt on the 25th visit, once per app version
  - `components/settings-section.test.tsx` — SettingsSection group rendering
  - `components/settings-row.test.tsx` — SettingsRow press/haptic/disabled behavior
  - `components/theme-picker.test.tsx` — ThemePicker selection + active state
  - `components/picker-dialog.test.tsx` — shared glass picker (search/select/checkmark)
  - `components/notification-settings.contract.test.tsx` — a button master row (press) plus per-prayer and per-window Switches, the offset Segmented and the sound rows; the `useNotificationSegmentLayout` mock went with the hook
  - `screens/screen-contracts.test.tsx` — dropdown-picker and CitySearchModal mocks removed; city-search-modal.contract.test.tsx suite deleted

- `widgets testing`
  - `services/widgets/timeline.test.ts` — prayer timeline entries: next prayer per boundary, tomorrow's list after Isha, Hijri date turns once at Maghrib (no double rollover after Isha), stale when stored days run out
  - `services/widgets/verseFit.test.ts` — verse layout tiers; every verse in the Quran fits at or above the minimum size
  - `services/widgets/sync.test.ts` — themed timeline push, 7-day horizon, offline keeps old data, verse pinning and push
  - `hooks/useWidgetSync.test.ts` — syncs on mount, foreground, prayer settings and theme changes
  - `components/quran-copy-sheet.contract.test.tsx` — "Add as widget" action in the copy sheet
  - `components/quran-data-gate.test.tsx` — the reader waits for the Quran data before rendering (widget tap on a cold start)
- `tracking data layer (Plan 1) testing`
  - `services/tracking/util.test.ts` — date key utilities
  - `services/tracking/prayerLog.test.ts` — prayer status CRUD + events + preload
  - `services/tracking/habits.test.ts` — habit definition CRUD + reorder + tombstone
  - `services/tracking/habitLog.test.ts` — habit completion CRUD + events + preload
  - `services/tracking/stats.prayer.test.ts` — prayer streak, monthly completion, qada count
  - `services/tracking/stats.habit.test.ts` — daily + weekly habit streaks
  - `services/tracking/merge.test.ts` — LWW merge for prayer log, habit log, habits and settings, run against `shared/syncMergeVectors.json` (the same vectors as `backend/__tests__/syncMerge.test.ts`; includes cleared-mark cases)
  - `services/tracking/trackerStore.test.ts` — tracker store: shared load, shape fallback, save persists + notifies, failed write keeps memory
  - `hooks/useTrackerData.test.ts` — shared tracker hook: loads, follows changes, skips other days, unsubscribes
  - `services/tracking/facades.test.ts` — prayerTracker + habitTracker barrel re-exports
- `prayer logging UI (Phase 2) testing`
  - `hooks/usePrayerLog.test.ts` — usePrayerLog hook: load, set/clear, event filtering, unmount cleanup
  - `components/tracking/PrayerStatusDot.test.tsx` — prayer status glyph states (check / clock / cross, not colour-only)
  - `components/tracking/PrayerLogSheet.test.tsx` — prayer logging bottom sheet (Prayed/Late/Missed + Clear)
  - `components/PrayerDial.logging.test.tsx` — PrayerDial logging mode (status dots, tap-to-log, Sunrise excluded, future prayers unloggable)
  - `screens/home-prayer-logging.test.tsx` — logging a prayer from the Home arc persists
  - `components/calendar/DayDetailPanel.logging.test.tsx` — logging a prayer for a past date in the Calendar detail
- `tracker screen + habits UI (Phase 3) testing`
  - `components/ui/DisplayNumber.test.tsx` — display numerals use the system face: no `fontFamily`, weight 700, tight tracking, tabular figures
  - `services/tracking/stats.phase3.test.ts` — `unwrapHabitLog` habit-log unwrapping, `monthDailyScores` daily completion scoring
  - `hooks/useHabits.test.ts` — habit definition CRUD, reorder, archive/delete, `HABITS_UPDATED` event
  - `hooks/useHabitLog.test.ts` — habit completion toggle, `HABIT_LOG_UPDATED` event, preload
  - `hooks/useTrackingStats.test.ts` — `TrackingStats` shape: prayer streak, monthly %, qada, per-habit streaks
  - `components/tracking/StatCards.test.tsx` — StreakHero + QadaCard stat card rendering
  - `components/tracking/CompletionRings.test.tsx` — animated completion ring display
  - `components/tracking/MonthHeatmap.test.tsx` — monthly prayer completion heatmap grid
  - `components/tracking/HabitRow.test.tsx` — habit list row: label, frequency badge, streak chip, check/uncheck, swipe Edit/Archive actions, "more" menu options
  - `components/tracking/MonthHeatmap.test.tsx` — also asserts per-day accessibility labels and the Less/More legend
  - `utils/action-menu.test.ts` — `showActionMenu` (ActionSheetIOS on iOS, Alert fallback)
  - `components/tracking/HabitEditor.test.tsx` — habit create/edit sheet: name, frequency, icon picker
  - `components/tracking/HabitChecklist.test.tsx` — per-day habit checklist (Calendar integration)
  - `screens/Tracker.test.tsx` — Tracker screen contract: Overview section + Habits section, add-habit flow
  - `screens/home-tracker-affordance.test.tsx` — Home streak chip + "View tracker & habits" affordance
  - `screens/home-sign-in-card.test.tsx` — Home sign-in card clears on sign-in and stays quiet on sign-out
- `weekday habits + Tracker check-off (Phase 3.1) testing`
  - `utils/habitFrequency.test.ts` — `frequencyLabel` (weekday list), `isHabitDueOnDate`, `WEEKDAY_SHORT`
  - `services/tracking/habits.migration.test.ts` — legacy `{weekly, timesPerWeek}` habits migrate to Daily on read
- `user authentication + account management (Phase 2) testing`
  - `services/auth/authToken.test.ts` — non-hook token getter and Clerk instance initialization
  - `services/apiClient.auth.test.ts` — bearer token attachment to backend calls
  - `hooks/useAuthState.test.tsx` — Clerk session state subscription (isLoaded, isSignedIn, userId, email)
  - `hooks/useAccountActions.test.tsx` — sign-out and account-delete actions
  - `components/accountSection.test.tsx` — account UI section rendering and action callbacks
  - `screens/signIn.test.tsx` — SignIn screen: renders both provider buttons, Google/Apple SSO flow invocation, session activation
  - `screens/settings.account.test.tsx` — Settings account section integration + sign-out/delete confirmation flows
- `cloud sync engine (Phase 3) testing`
  - `services/sync/replaceSetters.test.ts` — `replacePrayerLog` / `replaceHabitLog` / `replaceHabits` internal setters
  - `services/sync/settingsMeta.test.ts` — `sync:settings_meta_v1` stamp sidecar read/write and bump-on-event behavior
  - `hooks/useSyncedSetting.test.ts` — hook loads the stored value and keeps a change that lands during the first read
  - `services/prayerSettings.test.ts` — prayer settings (defaults, cityKey, legacy `selectedCity`, malformed values) and effective settings (OS permission applied on read, never stored)
  - `hooks/usePrayerSettingsEdits.test.ts` — Settings screen state: no save on load, real edits saved and stamped, follows remote changes
  - `hooks/usePrayerDay.settings.test.ts` — a day loads with the user's saved method/city and reloads when they change
  - `services/syncedSettings/syncedSettings.test.ts` — synced setting module: the 14 declared keys, `set` (persist + stamp + notify) vs `applyRemote` (persist + notify, never stamps), per-setting codecs and defaults, malformed remote values
  - `services/sync/settingsAdapter.test.ts` — settings domain adapter `read()` / `applyMerged()` round-trip
  - `services/sync/trackerAdapters.test.ts` — prayer-log, habits, habit-log adapter `read()` / `applyMerged()` round-trips
  - `services/sync/syncEngine.test.ts` — single-flight guard, debounce, online/offline guard, sign-in trigger, foreground trigger
  - `hooks/useSyncEngine.test.ts` — `useSyncEngine` hook: mounts engine on sign-in, tears down on sign-out
  - `hooks/useSyncStatus.test.ts` — `useSyncStatus` hook: reads `sync:last_synced_v1`, updates on sync events
  - `services/quranBookmarks.test.ts` — quran bookmarks service (upsert/delete go through the synced setting)
  - `services/quranProgress.test.ts` — quran reading-progress service (floors and validates before saving to the synced setting; index and position save in one write so overlapping saves keep the newest spot)
  - `services/ramadanTracker.test.ts` — ramadan tracker service (mark/clear go through the synced setting)
  - `context/themeSync.test.tsx` — theme context follows a theme applied from another device

## Run Tests

From `frontend/`:

```bash
npm test
npm run test:watch
npm run test:coverage
```

Run a single file:

```bash
npm test -- --runTestsByPath __tests__/services/prayerTimes.test.ts
```

## Determinism Notes

Global test setup is in `frontend/test/setup/jest.setup.ts` and includes:

- AsyncStorage mock
- notification mock (`expo-notifications`)
- network default mock (`global.fetch`, `expo-network`)
- Liquid Glass mock (`expo-glass-effect`: `GlassView`/`GlassContainer` render as `View`; `isGlassEffectAPIAvailable` → true)
- haptics mock (`expo-haptics`: `selectionAsync`/`impactAsync`/`notificationAsync` + feedback enums)
- test time helpers: `freezeTestTime(...)`, `resetTestTime()`

When adding tests for retry/backoff/scheduling logic, prefer fake timers and frozen time.
