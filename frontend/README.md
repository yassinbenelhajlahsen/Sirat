# Sirat Frontend

Expo Router + React Native app for daily Islamic utilities.

## Screens (Tabs)

- Home: prayer times + next prayer + dua request
- Mosques: nearby mosque map/list
- Qibla: compass-based direction to Kaaba
- Quran: read/listen/search/bookmark ayat
- Calendar: holidays + Ramadan missed-fast tracker
- Settings: location/method/city preferences + notification controls

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
├── context/     # app-level providers (Quran audio)
├── assets/      # local data, images, fonts, sounds
├── constants/   # theme tokens
└── util/        # calculation helpers and shared utilities
```

## Data & Integrations

- Sirat backend (`/api/prayer-times/timings`, `/api/prayer-times/calendar`): proxied Aladhan prayer data
- Sirat backend (`/api/holidays/year`): proxied and aggregated Aladhan holiday data
- Sirat backend (`/api/mosque/nearby`): proxied Google Places nearby mosques
- Sirat backend (`/api/dua`): AI-assisted dua fallback
- Quran text data: bundled local JSON assets
- Quran audio: streamed per surah
- Persistence: AsyncStorage (settings, caches, bookmarks, history)

## Notes For Development

- App startup preloads Quran data/display modes and syncs location/notification permissions in `app/_layout.tsx`.
- Notification scheduling is handled by `services/notificationService.ts`.
- Notification master flag (`notif_enabled_v1`) is persisted as string `"1"`/`"0"` in AsyncStorage.
- Prayer-time caching and annual calendar fetch live in `services/prayerTimes.ts`.
- Holiday year fetch and caching live in `services/holidayService.ts`.
