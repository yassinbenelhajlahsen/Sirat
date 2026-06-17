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
  - `components/prayer-arc.contract.test.tsx`
- `tab bar scroll-collapse testing`
  - `utils/tab-bar-chrome.test.ts`

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
