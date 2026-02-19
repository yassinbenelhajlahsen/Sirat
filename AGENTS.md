## Scope
This repository is a monorepo with:
- `frontend/`: Expo Router + React Native mobile app
- `backend/`: Express + TypeScript API for dua matching
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
- `npm run reset-project` -> `node ./scripts/reset-project.js` (script target file is missing in repo)

## Architecture

### Backend
- Entry: `backend/src/index.ts`
- Routes: `backend/src/routes/dua.ts`
- Controller: `backend/src/controllers/duaController.ts`
- OpenAI integration: `backend/src/services/openaiService.ts`
- Dua data source/caching: `backend/src/utils/duaDatabase.ts`
- Error middleware: `backend/src/middleware/errorHandler.ts`
- Canonical backend dua dataset: `backend/public/duas.json`

Dua API flow:
1. Validate `userRequest` (string, trimmed length >= 3)
2. Load duas from `public/duas.json`
3. Try OpenAI selection (`/v1/chat/completions`)
4. Validate returned `duaId` exists
5. Fallback to random dua on any AI failure

### Frontend
- Router entry/layout: `frontend/app/_layout.tsx`
- Tabs: `frontend/app/(tabs)/`
- Core logic in `frontend/services/`
- Reusable hooks in `frontend/hooks/`
- Quran audio/provider context in `frontend/context/`
- App data assets in `frontend/assets/data/`

Important frontend flows:
- Dua: local regex match first (`frontend/services/duaMatcher.ts`), backend fallback via `frontend/services/duaService.ts`
- Prayer times: Aladhan API + year/day caching in `frontend/services/prayerTimes.ts`
- Notifications: rolling scheduling in `frontend/services/notificationService.ts`
- Quran: preload/normalize local dataset in `frontend/services/quranData.ts`
- Mosques: Google Places Nearby Search in `frontend/services/getNearbyMosques.ts`
- Calendar/Ramadan: holiday fetch + missed fast tracking (`holidayService.ts`, `ramadanTracker.ts`)

## Environment and Runtime Constraints

### Backend env (`backend/src/config/env.ts`)
- `PORT` default: `3001`
- `NODE_ENV` default: `development`
- `FRONTEND_URL` default: `http://localhost:8081`
- `OPENAI_API_KEY` default: empty (AI disabled, fallback mode used)
- `OPENAI_MODEL` default: `gpt-4-turbo`

### Frontend env/config
- `EXPO_PUBLIC_API_URL` used in `frontend/services/duaService.ts`, default `http://localhost:3001`
- `GOOGLE_MAPS_API_KEY` pulled from `frontend/app.config.js` -> `expo.extra.GOOGLE_MAPS_API_KEY`
- `frontend/app.config.js` sets `newArchEnabled: true`, iOS bundle metadata, notifications plugin with `adhan.wav`

## Constraints and Gotchas
- Backend `loadDuas()` resolves file via `process.cwd()/public/duas.json`; run backend from `backend/` or data load fails.
- `frontend/package.json` includes `reset-project` script, but `frontend/scripts/reset-project.js` does not exist.
- Notification master toggle in UI opens OS settings; it does not directly toggle permission state in-app.
- Notification enable flag is stored as string `"1"`/`"0"` (`notif_enabled_v1`), not JSON boolean.
- Cross-screen sync relies on exact `DeviceEventEmitter` event names (`settingsChanged`, `NOTIF_PREFS_UPDATED`, `QURAN_DISPLAY_MODES_UPDATED`).
- `quranData` accessors throw if preload has not occurred; preload is triggered in root layout.
- Calendar month navigation is constrained to current year through next year.
- CORS allowlist in backend is explicit; add origins in `backend/src/index.ts` if needed.
- Backend coverage output is committed under `backend/coverage/`.
- `.env` files are gitignored at repo root (`.gitignore`).

## TypeScript / Lint
- Frontend TS path alias: `@/*` -> `frontend/*` (`frontend/tsconfig.json`)
- Backend uses strict TypeScript (`backend/tsconfig.json`)
- Frontend ESLint config: `frontend/eslint.config.js` (Expo flat config)
- Backend lint command expects ESLint setup present in backend dependencies/scripts

## PR / CI Rules Detected
- No GitHub Actions workflows are present.
- No PR template or CONTRIBUTING file is present.
- No repository-level PR checks/rules are detectable from tracked files.

## Agent Operating Notes
- Prefer editing service logic in `frontend/services/` and `backend/src/services|utils|controllers` rather than bloating UI files.
- Preserve AsyncStorage keys/events unless migration is deliberate and updated everywhere.
- When changing prayer/notification behavior, verify both `Settings` and `NotificationService` integration paths.
- When changing dua schema/category behavior, keep frontend and backend dua data/logic aligned.
