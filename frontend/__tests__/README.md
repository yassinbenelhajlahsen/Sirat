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
  - `services/notificationService.test.ts`
  - `services/notifications/*.test.ts`
- `prayer times retrieval + caching testing`
  - `services/prayerTimes.test.ts`
  - `services/prayer-times/*.test.ts`
- `home prayer feature behavior testing`
  - `hooks/usePrayerTimes.test.ts`
  - `hooks/useHomePrayerTimes.test.ts`
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
  - `hooks/useQuranDisplayModes.test.ts`
  - `components/surah-banner.contract.test.tsx`
  - `components/surah-tab.contract.test.tsx` (navigator Surah tab — search-forward default: Continue reading + Popular, "All Sūrahs" reveal, search mode)
- `quran copy text formatting testing`
  - `services/quranCopyText.test.ts`
- `dua flow testing`
  - `services/duaMatcher.test.ts`
  - `services/duaService.test.ts`
  - `hooks/useDuaInteraction.test.ts`
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
  - `components/day-detail-panel.contract.test.tsx` (calendar inline-agenda day detail — today/other-day/holiday/Ramadan/error states)
- `force update gate testing`
  - `services/appVersion.test.ts`
  - `services/apiClient.test.ts`
  - `components/force-update-gate.contract.test.tsx`
- `shared component contracts testing`
  - `components/*.contract.test.tsx`
  - `components/sheet-background.contract.test.tsx`
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
  - `flows/quran-display-mode.flow.test.tsx`
  - `flows/calendar-missed-fast.flow.test.tsx`
  - `flows/nearby-mosques-refresh.flow.test.tsx`
- `visual refresh foundations (Plan 1) testing`
  - `utils/greeting.test.ts`
  - `constants/motion.test.ts`
  - `hooks/useHaptics.test.ts`
  - `components/glass-surface.contract.test.tsx`
  - `components/ui-text.contract.test.tsx`
  - `navigation/glass-tab-bar.contract.test.tsx`
- `home prayer arc (horizontal sun path) testing`
  - `utils/prayer-arc.test.ts`
  - `components/prayer-arc.contract.test.tsx` (incl. live vs static/non-today mode)
- `tab bar scroll-collapse testing`
  - `utils/tab-bar-chrome.test.ts`
- `settings liquid-glass redesign testing`
  - `utils/appLinks.test.ts` — About-row link/share/version helpers
  - `components/settings-section.test.tsx` — SettingsSection group rendering
  - `components/settings-row.test.tsx` — SettingsRow press/haptic/disabled behavior
  - `components/theme-picker.test.tsx` — ThemePicker selection + active state
  - `components/picker-dialog.test.tsx` — shared glass picker (search/select/checkmark)
  - `screens/notification-settings.contract.test.tsx` — now asserts a **button** master row (press), not a Switch
  - `screens/screen-contracts.test.tsx` — dropdown-picker and CitySearchModal mocks removed; city-search-modal.contract.test.tsx suite deleted

- `tracking data layer (Plan 1) testing`
  - `services/tracking/util.test.ts` — date key utilities
  - `services/tracking/prayerLog.test.ts` — prayer status CRUD + events + preload
  - `services/tracking/habits.test.ts` — habit definition CRUD + reorder + tombstone
  - `services/tracking/habitLog.test.ts` — habit completion CRUD + events + preload
  - `services/tracking/stats.prayer.test.ts` — prayer streak, monthly completion, qada count
  - `services/tracking/stats.habit.test.ts` — daily + weekly habit streaks
  - `services/tracking/merge.test.ts` — LWW merge for prayer log, habits, habit log
  - `services/tracking/facades.test.ts` — prayerTracker + habitTracker barrel re-exports
- `prayer logging UI (Phase 2) testing`
  - `utils/prayerLabel.test.ts` — maps prayer-arc labels to PrayerName (Sunrise → null)
  - `hooks/usePrayerLog.test.ts` — usePrayerLog hook: load, set/clear, event filtering, unmount cleanup
  - `components/tracking/PrayerStatusDot.test.tsx` — prayer status indicator dot states
  - `components/tracking/PrayerLogSheet.test.tsx` — prayer logging bottom sheet (Prayed/Late/Missed + Clear)
  - `components/PrayerArc.logging.test.tsx` — PrayerArc logging mode (status dots, tap-to-log, Sunrise excluded)
  - `screens/home-prayer-logging.test.tsx` — logging a prayer from the Home arc persists
  - `components/calendar/DayDetailPanel.logging.test.tsx` — logging a prayer for a past date in the Calendar detail
- `tracker screen + habits UI (Phase 3) testing`
  - `components/ui/DisplayNumber.test.tsx` — display-numeral font/style (`DISPLAY_FONT_FAMILY`, size/weight variants)
  - `services/tracking/stats.phase3.test.ts` — `unwrapHabitLog` habit-log unwrapping, `monthDailyScores` daily completion scoring
  - `hooks/useHabits.test.ts` — habit definition CRUD, reorder, archive/delete, `HABITS_UPDATED` event
  - `hooks/useHabitLog.test.ts` — habit completion toggle, `HABIT_LOG_UPDATED` event, preload
  - `hooks/useTrackingStats.test.ts` — `TrackingStats` shape: prayer streak, monthly %, qada, per-habit streaks
  - `components/tracking/StatCards.test.tsx` — StreakHero + QadaCard stat card rendering
  - `components/tracking/CompletionRings.test.tsx` — animated completion ring display
  - `components/tracking/MonthHeatmap.test.tsx` — monthly prayer completion heatmap grid
  - `components/tracking/HabitRow.test.tsx` — habit list row: label, frequency badge, streak chip, check/uncheck
  - `components/tracking/HabitEditor.test.tsx` — habit create/edit sheet: name, frequency, icon picker
  - `components/tracking/HabitChecklist.test.tsx` — per-day habit checklist (Calendar integration)
  - `screens/Tracker.test.tsx` — Tracker screen contract: Overview section + Habits section, add-habit flow
  - `screens/home-tracker-affordance.test.tsx` — Home streak chip + "View tracker & habits" affordance
- `weekday habits + Tracker check-off (Phase 3.1) testing`
  - `utils/habitFrequency.test.ts` — `frequencyLabel` (weekday list), `isHabitDueOnDate`, `WEEKDAY_SHORT`
  - `services/tracking/habits.migration.test.ts` — legacy `{weekly, timesPerWeek}` habits migrate to Daily on read

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
