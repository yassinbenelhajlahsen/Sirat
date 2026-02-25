# Frontend Tests

This folder contains frontend automated tests for the Expo/React Native app.

## Structure

- `app/`: root layout/bootstrap behavior tests
- `hooks/`: behavior tests for reusable hooks
- `services/`: unit tests for service modules (API, storage, matching, scheduling, caching)

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
- `dua flow testing`
  - `services/duaMatcher.test.ts`
  - `services/duaService.test.ts`
  - `hooks/useDuaInteraction.test.ts`
- `location heavy features testing`
  - `hooks/useQibla.test.ts`
  - `services/getNearbyMosques.test.ts`
- `holiday ramadan calendar data integrity testing`
  - `services/holidayService.test.ts`
  - `services/ramadanTracker.test.ts`
  - `hooks/useRamadanTracker.test.ts`
  - `hooks/useCalendarData.test.ts`

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
- test time helpers: `freezeTestTime(...)`, `resetTestTime()`

When adding tests for retry/backoff/scheduling logic, prefer fake timers and frozen time.
