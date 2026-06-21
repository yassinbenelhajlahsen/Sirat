## Scope
This repository is a monorepo with:
- `frontend/`: Expo Router + React Native mobile app
- `backend/`: Express + TypeScript API for dua matching and external API proxying
- `docs/`: static website/privacy pages
- `plans/`: planning documents (not runtime code)

There is no root `package.json`.

## Working Directories
Run commands from the correct package directory:
- Backend commands from `backend/`
- Frontend commands from `frontend/`

## Verified Commands

### Backend (`backend/package.json`)
- `npm install`
- `npm run dev` -> `tsx watch src/index.ts`
- `npm run build` -> `tsc`
- `npm start` -> `node dist/index.js`
- `npm run lint` -> `eslint src --ext .ts`
- `npm test` -> `NODE_OPTIONS=--experimental-vm-modules jest`
- `npm run test:watch` -> `NODE_OPTIONS=--experimental-vm-modules jest --watch`
- `npm run test:coverage` -> `NODE_OPTIONS=--experimental-vm-modules jest --coverage`

### Frontend (`frontend/package.json`)
- `npm install`
- `npm start` -> `expo start`
- `npm run android` -> `expo run:android`
- `npm run ios` -> `expo run:ios`
- `npm run web` -> `expo start --web`
- `npm run lint` -> `expo lint`
- `npm test` -> `jest`
- `npm run test:watch` -> `jest --watch`
- `npm run test:coverage` -> `jest --coverage`

## Architecture

### Backend
- Entry: `backend/src/index.ts`
- Routes: `backend/src/routes/dua.ts`, `backend/src/routes/mosque.ts`, `backend/src/routes/prayerTimes.ts`, `backend/src/routes/holiday.ts`, `backend/src/routes/app.ts` (version check)
- Controller: `backend/src/controllers/duaController.ts`, `backend/src/controllers/mosqueController.ts`, `backend/src/controllers/prayerTimesController.ts`, `backend/src/controllers/holidayController.ts`
- OpenAI integration: `backend/src/services/openaiService.ts`
- Google Maps integration: `backend/src/services/googleMapsService.ts`
- Aladhan integration/proxy + cache/retry: `backend/src/services/aladhanService.ts`
- Dua data source/caching: `backend/src/utils/duaDatabase.ts`
- Prayer method resolution (integer → Aladhan method, `auto` → IP-based): `backend/src/utils/prayerMethodResolver.ts`
- Semver comparison: `backend/src/utils/semver.ts`
- Error middleware: `backend/src/middleware/errorHandler.ts`
- Version gate middleware: `backend/src/middleware/minVersionGate.ts` (monitor/enforce mode, 426 response)
- Canonical backend dua dataset: `backend/public/duas.json`

Dua API flow:
1. Validate `userRequest` (string, trimmed length >= 3)
2. Load duas from `public/duas.json`
3. Try OpenAI selection (`/v1/chat/completions`)
4. Validate returned `duaId` exists
5. Fallback to random dua on any AI failure

### Frontend
- Router entry/layout: `frontend/app/_layout.tsx`
- Tabs: `frontend/app/(tabs)/` — `index.tsx` (home/prayer), `Calendar.tsx`, `Mosques.tsx`, `Qibla.tsx`, `Quran.tsx`, `Settings.tsx`
- Non-tab screens: `frontend/app/[date].tsx` (calendar day detail), `frontend/app/MosqueMap.tsx` (full-screen map)
- Shared UI components: `frontend/components/` — generic components at root, `quran/` sub-dir (QuranAyahCard, QuranMiniPlayer, QuranMiniPlayerPortal, QuranBookmarkModal, QuranDisplaySettingsModal, QuranCompletionCard, navigator/)
- Core logic in `frontend/services/`
- Reusable hooks in `frontend/hooks/`
- Shared utilities: `frontend/utils/` — `calculationMethods.ts`, `cities.ts`, `getTimeUntil.ts`, `notifications/` (constants + styles)
- App providers in `frontend/context/` (`QuranAudioProvider`, `ThemeContext`)
- App data assets in `frontend/assets/data/`

Important frontend flows:
- Dua: local regex match first (`frontend/services/duaMatcher.ts`), backend fallback via `frontend/services/duaService.ts`
- Prayer times: backend-proxied Aladhan via `frontend/services/prayerTimes.ts` (modular internals in `frontend/services/prayer-times/`) using `/api/prayer-times/timings` + `/api/prayer-times/calendar/year`, with monthly `/api/prayer-times/calendar` fallback
- Notifications: rolling scheduling coordinated in `frontend/services/notificationService.ts` with modular helpers in `frontend/services/notifications/`
- Themes: app-wide theme state in `frontend/context/ThemeContext.tsx` with settings picker in `frontend/app/(tabs)/Settings.tsx`
- Quran: preload/normalize local dataset (`frontend/services/quranData.ts`); audio URL generation (`quranAudio.ts`); bookmark CRUD with AsyncStorage (`quranBookmarks.ts`, key: `quran:bookmarks`); display mode persistence — arabic/english/transliteration (`quranDisplayModes.ts`, key: `quran_display_modes`, event: `QURAN_DISPLAY_MODES_UPDATED`); last-read position tracking (`quranProgress.ts`, keys: `quran:last-read:index`, `quran:last-read:position`). Audio playback managed by `frontend/context/QuranAudioProvider.tsx`
- Mosques: backend-proxied Google Places Nearby Search via `frontend/services/getNearbyMosques.ts` and `backend/src/routes/mosque.ts`
- Calendar/Ramadan: backend holiday year proxy + missed fast tracking (`holidayService.ts`, `ramadanTracker.ts`)

## Environment and Runtime Constraints

### Backend env (`backend/src/config/env.ts`)
- `PORT` default: `3001`
- `NODE_ENV` default: `development`
- `FRONTEND_URL` default: `http://localhost:8081`
- `TRUST_PROXY` default: empty (backend resolves trust proxy from environment/runtime)
- `LOG_LEVEL` default: `info`
- `OPENAI_API_KEY` default: empty (AI disabled, fallback mode used)
- `OPENAI_MODEL` default: `gpt-4-turbo`
- `GOOGLE_MAPS_API_KEY` default: empty (mosque lookup fails without it)
- `MIN_SUPPORTED_APP_VERSION` default: `1.0.0` (minimum client version allowed)
- `ENFORCE_MIN_VERSION` default: `false` (monitor mode — logs but never blocks; set to `true` to enforce)
- Database migrations: Prisma Migrate. Schema in `backend/prisma/schema.prisma`;
  migrations in `backend/prisma/migrations/`. Apply with `npm run migrate`
  (`prisma migrate deploy`); author new ones with `npm run migrate:dev`.
  `start` runs `prisma migrate deploy` before boot.
- DB query boundary: existing tables (`users`, `sync_documents`) are queried with
  raw `pg` via `src/db/pool.ts` (incl. the `FOR UPDATE` sync transaction). New
  feature tables use the Prisma Client singleton in `src/db/prisma.ts`.

### Frontend env/config
- `EXPO_PUBLIC_API_URL` used in `frontend/services/apiClient.ts` (shared API client) and `frontend/app/_layout.tsx` (version check), default `http://localhost:3001`
- `frontend/app.config.js` sets `newArchEnabled: true`, iOS bundle metadata, notifications plugin with `adhan.wav`

## Constraints and Gotchas
- Backend `loadDuas()` resolves file via `process.cwd()/public/duas.json`; run backend from `backend/` or data load fails.
- Backend mosque `radius` is clamped to `100..5000` in `backend/src/controllers/mosqueController.ts` (default `3000`).
- Theme selection is stored as string key `app_theme_v1` (`default` | `dark` | `light`).
- Root app readiness depends on theme hydration in `frontend/app/_layout.tsx` to avoid first-frame flash.
- Notification master toggle in UI opens OS settings; it does not directly toggle permission state in-app.
- Notification enable flag is stored as string `"1"`/`"0"` (`notif_enabled_v1`), not JSON boolean.
- Cross-screen sync relies on exact `DeviceEventEmitter` event names (`settingsChanged`, `NOTIF_PREFS_UPDATED`, `QURAN_DISPLAY_MODES_UPDATED`, `FORCE_UPDATE_REQUIRED`).
- `quranData` accessors throw if preload has not occurred; preload is triggered in root layout.
- Calendar month navigation is constrained to current year through next year.
- CORS allowlist in backend is explicit; add origins in `backend/src/index.ts` if needed.
- Backend coverage output is generated under `backend/coverage/` (not tracked in git).
- `.env` files are gitignored at repo root (`.gitignore`).

## TypeScript / Lint
- Frontend TS path alias: `@/*` -> `frontend/*` (`frontend/tsconfig.json`)
- Backend uses strict TypeScript (`backend/tsconfig.json`)
- Frontend ESLint config: `frontend/eslint.config.js` (Expo flat config)
- Backend lint command expects ESLint setup present in backend dependencies/scripts

## PR / CI Rules Detected
- GitHub Actions workflows:
  - `.github/workflows/expo-ota.yml` publishes iOS OTA updates on `main` pushes touching `frontend/**` (requires `EXPO_TOKEN` secret).
  - `.github/workflows/pages.yml` deploys `docs/` to GitHub Pages on `main` pushes touching `docs/**` (or manual dispatch).
- No PR template or CONTRIBUTING file is present.
- No repository-level PR checks/rules are detectable from tracked files.

## Agent Operating Notes
- Prefer editing service logic in `frontend/services/` and `backend/src/services|utils|controllers` rather than bloating UI files.
- Keep `frontend/services/prayer-times/` and `frontend/services/notifications/` modules aligned with their orchestrators (`prayerTimes.ts`, `notificationService.ts`) instead of re-expanding those files.
- Preserve AsyncStorage keys/events unless migration is deliberate and updated everywhere.
- Keep theme-aware UI changes on `useTheme()` + theme-driven style factories (`createStyles`) instead of static color constants.
- When changing prayer/notification behavior, verify both `Settings` and `NotificationService` integration paths.
- When changing dua schema/category behavior, keep frontend and backend dua data/logic aligned.
- Frontend test coverage map and conventions live in `frontend/__tests__/README.md`; update it when adding/removing major frontend test suites.
- All frontend API calls must go through `frontend/services/apiClient.ts` (`apiFetch`/`apiPost`) so version headers and 426 interception are applied consistently. Do not add raw `fetch`/`axios` calls in service files.
- Force update gate rollout: deploy backend with `ENFORCE_MIN_VERSION=false` first, ship frontend OTA second, then flip `ENFORCE_MIN_VERSION=true`.
