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
  - `services/notifications/windowStorage.test.ts`
  - `services/notifications/cityResolver.test.ts` — city-display fallback chain (caller coords → live position → last-known → cached → "your area"; never raw coordinates)
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
  - `services/quranTextScale.test.ts` — reader text size (`quran_text_scale_v1`): defaults, snapping, persistence, update event
  - `hooks/useQuranTextScale.test.ts`
  - `components/quran-ayah-card.contract.test.tsx` — tap reveals Bookmark/Copy actions, long-press copy shortcut, text scaling
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
  - `components/day-detail-panel.contract.test.tsx` (calendar inline-agenda day detail — today/other-day/holiday/Ramadan/error states; holiday names render on their own row without a line clamp)
  - `components/calendar/MonthPickerSheet.test.tsx` (month/year picker bottom sheet — year pills, month grid, out-of-range disabling)
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
  - `hooks/useDuaInteraction.test.ts` — includes the guard that the dua swap drives no animation (Liquid Glass renders as nothing under an animated ancestor)
  - `flows/quran-display-mode.flow.test.tsx`
  - `flows/calendar-missed-fast.flow.test.tsx`
  - `flows/nearby-mosques-refresh.flow.test.tsx`
- `visual refresh foundations (Plan 1) testing`
  - `utils/greeting.test.ts`
  - `constants/motion.test.ts`
  - `hooks/useHaptics.test.ts`
  - `components/glass-surface.contract.test.tsx` — glass vs fallback, and the borderless-over-glass default (hairline in the fallback, 1px when `bordered`)
  - `components/ui-text.contract.test.tsx` — type ramp plus Dynamic Type cap (`TEXT_MAX_FONT_SCALE`)
  - `navigation/glass-tab-bar.contract.test.tsx`
- `design audit follow-ups (Sept 2026) testing`
  - `constants/theme-text-tokens.test.ts` — `textPrimary/Secondary/Tertiary/Disabled` and `iconMuted` clear WCAG contrast on every theme's canvas
  - `components/ui/primitives.contract.test.tsx` — shared `Button`, `IconButton` (44pt target + hitSlop), `SheetHeader`, `SkeletonBar`
  - `hooks/useReducedMotion.test.ts` — mirrors the OS Reduce Motion setting and its live changes
  - `screens/nearby-mosques.contract.test.tsx` — inline load error with retry (no Alert), `shouldOfferAreaSearch` gesture/distance gate
  - `components/compass-dial.contract.test.tsx` — themed Kaaba mark replaces the emoji
  - `components/prayer-times-list.contract.test.tsx` was removed with the unused `PrayerTimesList` component
- `iOS-native polish (Direction A) testing`
  - `components/ui/app-icon.test.tsx` — every `IONICON_TO_SF` entry renders an SF Symbol on iOS and the Ionicon on Android; unmapped names fall back on both
  - `components/ui/segmented.test.tsx` — radiogroup/radio roles, selected state, `onChange` value, thumb position per index
  - `components/ui/section-header.test.tsx` — `SectionHeader` (+ action and footer), `ScreenHeader` (title, supporting line, leading control) and `EmptyState` contracts
  - `components/ui/press-variants.test.tsx` — `PressableScale` `row` renders no transform; `button`/`card` do; the `row` highlight takes its corners from the `radius` prop, falling back to the pressable's own `borderRadius`
  - `components/ui/aurora.test.tsx` — the exported bloom opacities stay toned down
  - `hooks/useScreenMargin.test.ts` — 16 under 400pt, 20 at 430pt
- `splash screen (marked passage) testing`
  - `components/splash-screen.contract.test.tsx` — wordmark set above the type scale in the system face with Dynamic Type pinned off, today's hadith on the first launch of the day and the masthead alone on a repeat launch, Hijri date only (no Gregorian), the wordmark anchored identically on both launch paths, and the native splash hidden only after a layout pass
  - `components/splash-atmosphere.test.tsx` — the splash-only horizon glow carries further than the in-app `Aurora` (which stays faint because content sits on it), and the top vignette stays a deepening rather than a curtain
- `home prayer arc (horizontal progress thumb) testing`
  - `utils/prayer-dial.test.ts` — dial geometry (noon at top, markers at true angular time), ring construction, disc stops, star field, marker fallbacks
  - `utils/sky.test.ts` — solar palette: pins that `suncalc` altitude is in DEGREES, plus horizon/zenith behaviour at low, high and negative sun
  - `components/prayer-dial.contract.test.tsx` — five columns with Sunrise excluded, centre stack (next prayer / tomorrow rollover / date + daylight / logged count / future), and that a non-today date is never mutated
- `tab bar scroll-collapse testing`
  - `utils/tab-bar-chrome.test.ts` — collapse decision, shared pill geometry (`tabBarClearanceForInset`), Reduce Motion gate
  - `hooks/useTabBarClearance.test.ts`
- `settings liquid-glass redesign testing`
  - `utils/appLinks.test.ts` — About-row link/share/version helpers
  - `components/settings-section.test.tsx` — SettingsSection group rendering
  - `components/settings-row.test.tsx` — SettingsRow press/haptic/disabled behavior
  - `components/theme-picker.test.tsx` — ThemePicker selection + active state
  - `components/picker-dialog.test.tsx` — shared glass picker (search/select/checkmark)
  - `components/notification-settings.contract.test.tsx` — a button master row (press) plus per-prayer and per-window Switches, the offset Segmented and the sound rows; the `useNotificationSegmentLayout` mock went with the hook
  - `screens/screen-contracts.test.tsx` — dropdown-picker and CitySearchModal mocks removed; city-search-modal.contract.test.tsx suite deleted

- `widgets testing`
  - `services/widgets/timeline.test.ts` — prayer timeline entries: next prayer per boundary, tomorrow's list after Isha, stale when stored days run out
  - `services/widgets/verseFit.test.ts` — verse layout tiers; every verse in the Quran fits at or above the minimum size
  - `services/widgets/sync.test.ts` — themed timeline push, 7-day horizon, offline keeps old data, verse pinning and push
  - `hooks/useWidgetSync.test.ts` — syncs on mount, foreground, settings and theme changes
  - `components/quran-copy-sheet.contract.test.tsx` — "Add as widget" action in the copy sheet
  - `components/quran-data-gate.test.tsx` — the reader waits for the Quran data before rendering (widget tap on a cold start)
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
  - `utils/prayerLabel.test.ts` — maps dial prayer labels to PrayerName (Sunrise → null)
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
  - `services/tracking/merge.mergeSettings.test.ts` — shared `mergeSettings` LWW merge cases (drift-guard vector used by both frontend and backend)
  - `services/sync/replaceSetters.test.ts` — `replacePrayerLog` / `replaceHabitLog` / `replaceHabits` internal setters
  - `services/sync/settingsMeta.test.ts` — `sync:settings_meta_v1` stamp sidecar read/write and bump-on-event behavior
  - `services/sync/settingsRegistry.test.ts` — `settingsRegistry.ts` entry shapes: storageKey, read(), applyValue(), changeEvents (incl. the four synced notif prefs and their granular per-key change events)
  - `services/sync/settingsAdapter.test.ts` — settings domain adapter `read()` / `applyMerged()` round-trip
  - `services/sync/trackerAdapters.test.ts` — prayer-log, habits, habit-log adapter `read()` / `applyMerged()` round-trips
  - `services/sync/syncEngine.test.ts` — single-flight guard, debounce, online/offline guard, sign-in trigger, foreground trigger
  - `hooks/useSyncEngine.test.ts` — `useSyncEngine` hook: mounts engine on sign-in, tears down on sign-out
  - `hooks/useSyncStatus.test.ts` — `useSyncStatus` hook: reads `sync:last_synced_v1`, updates on sync events
  - `services/quranBookmarks.test.ts` — quran bookmarks service (change events emitted for sync stamping)
  - `services/quranProgress.test.ts` — quran reading-progress service (change events for sync stamping)
  - `services/ramadanTracker.test.ts` — ramadan tracker service change events for sync stamping
  - `services/notifications/writePrayerSettings.test.ts` — prayer settings write path change events for sync stamping
  - `context/themeSync.test.ts` — theme context change event emitted on theme write (sync stamping trigger)

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
