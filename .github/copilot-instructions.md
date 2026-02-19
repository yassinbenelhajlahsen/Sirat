# Copilot Instructions for Sirat

## Project Overview

Sirat is a monorepo with:

- `frontend/`: Expo Router + React Native app
- `backend/`: Express + TypeScript dua API
- `docs/`: public site and privacy policy

The app includes prayer times, Qibla, Quran reading/audio, mosque discovery, calendar/Ramadan tracking, notifications, and dua matching.

## Code Layout

### Frontend

- `frontend/app/`: routes and UI
- `frontend/app/(tabs)/`: `index`, `Mosques`, `Qibla`, `Quran`, `Calendar`, `Settings`
- `frontend/app/components/`: shared UI (including Quran navigator/modals)
- `frontend/services/`: data integrations, caching, notifications, domain logic
- `frontend/hooks/`: reusable hooks
- `frontend/context/`: providers (`QuranAudioProvider`)
- `frontend/constants/`: theme tokens
- `frontend/util/`: calculation and resolver helpers
- `frontend/assets/data/`: local datasets (`duas.json`, `quran/`, `cities.json`, `hadiths.json`)

### Backend

- `backend/src/index.ts`: app setup, CORS, routes, middleware
- `backend/src/routes/dua.ts`: dua endpoints
- `backend/src/controllers/duaController.ts`: request validation and selection flow
- `backend/src/services/openaiService.ts`: OpenAI API call
- `backend/src/utils/duaDatabase.ts`: dua data loading/cache
- `backend/public/duas.json`: canonical dua dataset

## Important Runtime Flows

### Dua Selection

- Frontend first attempts local regex matching from `frontend/services/duaMatcher.ts`.
- If no local match and network is available, frontend calls backend `POST /api/dua`.
- Backend tries OpenAI selection and falls back to random dua.

### Prayer Times and Caching

- Core logic: `frontend/services/prayerTimes.ts`
- Uses Aladhan timings/calendar endpoints
- Caches by year + settings + location bucket in AsyncStorage
- Supports location mode and manual city mode

### Notifications

- Scheduling logic: `frontend/services/notificationService.ts`
- Prayer-level toggles + master toggle + sound mode (`default` or `adhan`)
- Rolling horizon scheduling (platform-dependent)
- Refreshes on app lifecycle and settings/prefs events

### Quran

- Data normalization/preload: `frontend/services/quranData.ts`
- Audio URLs: `frontend/services/quranAudio.ts`
- Bookmarks/progress/display preferences stored in AsyncStorage
- Audio session/state managed in `QuranAudioProvider`

### Calendar and Ramadan

- Holiday ingestion: `frontend/services/holidayService.ts`
- Missed-fast tracking: `frontend/services/ramadanTracker.ts`

## Permissions and Sync

- Initial permission sync runs in `frontend/app/_layout.tsx`.
- Location permission affects prayer location mode.
- Notification OS permission is mirrored into app toggle state.
- Cross-screen updates use `DeviceEventEmitter` (e.g. `settingsChanged`, `NOTIF_PREFS_UPDATED`).

## Environment Variables

### Frontend

- `GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:3001` in dua service)

### Backend

- `PORT` (default `3001`)
- `NODE_ENV`
- `FRONTEND_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-4-turbo`)

## Development Commands

### Frontend

```bash
cd frontend
npm install
npm start
npm run ios
npm run android
npm run web
npm run lint
```

### Backend

```bash
cd backend
npm install
npm run dev
npm run build
npm start
npm run lint
npm test
```

## Conventions

- Use `@/` import alias for frontend source-root imports.
- Keep business logic in `services/`; keep screens thin where possible.
- Reuse theme tokens from `frontend/constants/theme.ts`; avoid ad-hoc palette drift.
- Use versioned AsyncStorage keys when introducing new persisted shapes.
