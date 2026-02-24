# Copilot Instructions for Sirat

## Project Overview

Sirat is a monorepo with:

- `frontend/`: Expo Router + React Native app
- `backend/`: Express + TypeScript API for dua matching and service proxy endpoints
- `docs/`: public site and privacy policy

The app includes prayer times, Qibla, Quran reading/audio, mosque discovery, calendar/Ramadan tracking, notifications, and dua matching.

## Code Layout

### Frontend

- `frontend/app/`: routes and UI
- `frontend/app/(tabs)/`: `index`, `Mosques`, `Qibla`, `Quran`, `Calendar`, `Settings`
- `frontend/app/components/`: shared UI (including Quran navigator/modals)
- `frontend/services/`: data integrations, caching, notifications, domain logic
- `frontend/hooks/`: reusable hooks
- `frontend/context/`: providers (`QuranAudioProvider`, `ThemeContext`)
- `frontend/constants/`: theme tokens, theme map, and helpers
- `frontend/util/`: calculation and resolver helpers
- `frontend/assets/data/`: local datasets (`duas.json`, `quran/`, `cities.json`, `hadiths.json`)

### Backend

- `backend/src/index.ts`: app setup, CORS, routes, middleware
- `backend/src/routes/dua.ts`: dua endpoints
- `backend/src/routes/mosque.ts`: mosque endpoints (`/api/mosque/nearby`, `/api/mosque/health`) with rate limiting
- `backend/src/routes/prayerTimes.ts`: prayer-time proxy endpoints (`/api/prayer-times/timings`, `/api/prayer-times/calendar`, `/api/prayer-times/calendar/year`, `/api/prayer-times/health`)
- `backend/src/routes/holiday.ts`: holiday proxy endpoints (`/api/holidays/year`, `/api/holidays/health`)
- `backend/src/controllers/duaController.ts`: request validation and selection flow
- `backend/src/controllers/mosqueController.ts`: coordinate/radius validation and mosque response shaping
- `backend/src/controllers/prayerTimesController.ts`: lat/lng/method validation (`method` supports integer or `auto`) and proxy responses
- `backend/src/controllers/holidayController.ts`: year validation and holiday proxy responses
- `backend/src/services/openaiService.ts`: OpenAI API call
- `backend/src/services/googleMapsService.ts`: Google Places Nearby Search integration
- `backend/src/services/aladhanService.ts`: Aladhan proxy + retries + cache + stale fallback
- `backend/src/utils/duaDatabase.ts`: dua data loading/cache
- `backend/public/duas.json`: canonical dua dataset

## Important Runtime Flows

### Dua Selection

- Frontend first attempts local regex matching from `frontend/services/duaMatcher.ts`.
- If no local match and network is available, frontend calls backend `POST /api/dua`.
- Backend tries OpenAI selection and falls back to random dua.

### Mosque Discovery

- Frontend calls backend `GET /api/mosque/nearby` from `frontend/services/getNearbyMosques.ts`.
- Backend uses `GOOGLE_MAPS_API_KEY` to query Google Places Nearby Search.
- Requests are rate-limited in `backend/src/routes/mosque.ts`.
- Backend clamps `radius` to `100..5000` (default `3000`).

### Prayer Times and Caching

- Core logic: `frontend/services/prayerTimes.ts`
- Uses backend prayer endpoints (`/timings`, `/calendar/year`, fallback `/calendar`)
- Caches by year + settings + location bucket in AsyncStorage
- Supports location mode and manual city mode
- Frontend setting `method: -1` maps to backend `method=auto` with optional country-based resolution

### Notifications

- Scheduling logic: `frontend/services/notificationService.ts`
- Prayer-level toggles + master toggle + sound mode (`default` or `adhan`)
- Rolling horizon scheduling (platform-dependent)
- Refreshes on app lifecycle and settings/prefs events

### Theming and Appearance

- Theme state is managed by `frontend/context/ThemeContext.tsx`.
- Supported themes: `default`, `dark`, `light`.
- Selection is persisted in AsyncStorage key `app_theme_v1`.
- Root startup waits for theme hydration in `frontend/app/_layout.tsx` before app-ready.
- Settings theme picker lives in `frontend/app/(tabs)/Settings.tsx`.

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
- Root layout also initializes notifications, preloads Quran assets, and checks/fetches OTA updates in the background when not running in Expo Go.
- Downloaded OTA updates are not applied immediately; a themed restart prompt (`frontend/app/components/UpdateModal.tsx`) is shown on the next foreground event.
- Choosing `Restart` applies the update via runtime reload; choosing `Later` defers until a future foreground/cold launch.
- Root layout also updates native background color from active theme to avoid restart/OTA white flashes.
- Location permission affects prayer location mode.
- Notification OS permission is mirrored into app toggle state.
- Cross-screen updates use `DeviceEventEmitter` (e.g. `settingsChanged`, `NOTIF_PREFS_UPDATED`).

## Environment Variables

### Frontend

- `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:3001` in frontend services)

### Backend

- `PORT` (default `3001`)
- `NODE_ENV`
- `FRONTEND_URL`
- `TRUST_PROXY` (optional; resolved automatically if unset)
- `LOG_LEVEL` (default `info`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-4-turbo`)
- `GOOGLE_MAPS_API_KEY`

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
- Use `useTheme()` and theme-driven style factories for UI; avoid static color constants in themed components.
- Use versioned AsyncStorage keys when introducing new persisted shapes.
