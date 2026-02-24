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

## Environment Variables

Create `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

- `EXPO_PUBLIC_API_URL` points to the backend API (dua, mosque, prayer-times, and holidays endpoints).

## Current Architecture

```text
frontend/
├── app/         # Expo Router routes, tabs, and UI components
├── services/    # API/data/caching/business logic
├── hooks/       # reusable behavior hooks
├── context/     # app-level providers (Quran audio, app theme)
├── assets/      # local data, images, fonts, sounds
├── constants/   # theme tokens and helpers
└── util/        # calculation helpers and shared utilities
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
- Root layout also checks and applies OTA updates outside Expo Go in `app/_layout.tsx`.
- Notification scheduling is handled by `services/notificationService.ts`.
- Notification master flag (`notif_enabled_v1`) is persisted as string `"1"`/`"0"` in AsyncStorage.
- Prayer-time caching and annual calendar fetch live in `services/prayerTimes.ts` (uses `/calendar/year` first, with monthly fallback).
- Prayer method `-1` in settings maps to backend `method=auto` with optional country-based resolution.
- Holiday year fetch and caching live in `services/holidayService.ts`.
- `npm run reset-project` currently points to a missing `frontend/scripts/reset-project.js` file.
