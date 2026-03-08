# Sirat Frontend

Expo Router + React Native app for daily Islamic utilities.

## Screens (Tabs)

- Home: prayer times + next prayer + dua request
- Mosques: nearby mosque map/list
- Qibla: compass-based direction to Kaaba
- Quran: read/listen/search/bookmark ayat
- Calendar: holidays + Ramadan missed-fast tracker
- Settings: appearance (theme), location/method/city preferences + notification controls

## Run Locally

```bash
npm install
npm start
```

Platform commands:

```bash
npm run ios
npm run android
npm run web
npm run lint
```

Testing:

```bash
npm test
npm run test:coverage
```

See `frontend/__tests__/README.md` for test-suite coverage and conventions.
Current suites include service/hook contracts, screen/component contracts, navigation contracts, and integration-style flow tests.

## Environment Variables

Create `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

- `EXPO_PUBLIC_API_URL` points to the backend API (dua, mosque, prayer-times, and holidays endpoints).

## Current Architecture

```text
frontend/
├── app/         # Expo Router routes and screen entry points
├── components/  # reusable UI components
├── services/    # API/data/caching/business logic orchestrators
│   ├── prayer-times/    # prayer API/cache/location/transform modules
│   └── notifications/   # notification storage/permissions/scheduler modules
├── hooks/       # reusable behavior hooks
├── context/     # app-level providers (Quran audio, app theme)
├── assets/      # local data, images, fonts, sounds
├── constants/   # theme tokens and helpers
└── utils/       # calculation helpers and shared utilities
```

## Data & Integrations

- Sirat backend (`/api/prayer-times/timings`, `/api/prayer-times/calendar`, `/api/prayer-times/calendar/year`): proxied Aladhan prayer data
- Sirat backend (`/api/holidays/year`): proxied and aggregated Aladhan holiday data
- Sirat backend (`/api/mosque/nearby`): proxied Google Places nearby mosques
- Sirat backend (`/api/dua`): AI-assisted dua fallback
- Quran text data: bundled local JSON assets
- Quran audio: streamed per surah
- Persistence: AsyncStorage (settings, theme, caches, bookmarks, history)

## Notes For Development

- App startup preloads Quran data/display modes and syncs location/notification permissions in `app/_layout.tsx`.
- Theme state is provided by `context/ThemeContext.tsx` and persisted under `app_theme_v1`.
- Root layout waits for theme hydration before marking the app as ready to avoid startup flicker.
- Root layout checks OTA updates outside Expo Go in `app/_layout.tsx` and downloads them in the background (no immediate forced reload).
- A themed restart prompt (`components/UpdateModal.tsx`) is shown on the next foreground event when a downloaded update is ready.
- Tapping `Restart` applies the OTA via runtime reload; tapping `Later` defers until a future foreground/cold launch.
- Notification scheduling is coordinated by `services/notificationService.ts` with helper modules in `services/notifications/`.
- Notification master flag (`notif_enabled_v1`) is persisted as string `"1"`/`"0"` in AsyncStorage.
- Prayer-time orchestration lives in `services/prayerTimes.ts` with modular internals in `services/prayer-times/` (uses `/calendar/year` first, with monthly fallback).
- Prayer method `-1` in settings maps to backend `method=auto` with optional country-based resolution.
- Holiday year fetch and caching live in `services/holidayService.ts`.
