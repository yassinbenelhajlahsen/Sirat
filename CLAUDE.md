# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sirat is an Islamic companion mobile app. This is a simple directory-based monorepo (no workspaces) with two independent packages — each has its own `package.json`, `node_modules`, and config. There is no root `package.json`. All commands must be run from the correct sub-directory.

## Commands

### Frontend (run from `frontend/`)

```bash
npm start                # expo start
npm run ios              # expo run:ios
npm run android          # expo run:android
npm run web              # expo start --web
npm run lint             # expo lint
npm run typecheck        # npx tsc --noEmit
npm test                 # jest
npm run test:watch       # jest --watch
npm run test:coverage    # jest --coverage
npm run verify           # lint + typecheck + test (used in CI)

# Run a single test file:
npm test -- --runTestsByPath __tests__/services/prayerTimes.test.ts
```

### Backend (run from `backend/`)

```bash
npm run dev              # tsx watch src/index.ts
npm run build            # tsc
npm start                # node dist/index.js
npm run lint             # eslint src --ext .ts
npm test                 # NODE_OPTIONS=--experimental-vm-modules jest
npm run test:watch       # jest --watch
npm run test:coverage    # jest --coverage
```

## Architecture

See `AGENTS.md` for full architecture details. Key points:

**Monorepo layout:** `frontend/` (Expo 54 / React Native 0.81 / Expo Router 6), `backend/` (Express 4 + TypeScript API proxy), `docs/` (GitHub Pages site at `sirat.dev`), `plans/` (planning docs).

**Frontend patterns:**
- Screens in `app/(tabs)/` are thin — they delegate to hooks and services
- Business logic lives in `services/`, with modular sub-directories (`prayer-times/`, `notifications/`) orchestrated by facade files (`prayerTimes.ts`, `notificationService.ts`)
- State: React Context (`ThemeContext`, `QuranAudioProvider`) + local state + AsyncStorage persistence — no Redux/Zustand
- Cross-screen sync via `DeviceEventEmitter` with exact event names: `settingsChanged`, `NOTIF_PREFS_UPDATED`, `QURAN_DISPLAY_MODES_UPDATED`

**Backend patterns:**
- Classic routes → controllers → services → utils layered architecture
- Per-route rate limiting via `express-rate-limit`: dua 60/15min, mosque 100/15min, prayer-times 300/15min, holidays 180/15min
- Aladhan proxy caching with TTLs (timings 5min, calendar 12hr, holidays 24hr), stale-on-error fallback, in-flight request deduplication, and retry with exponential backoff (3 attempts, 300ms base)
- Prompt injection defense on the dua endpoint — new dua categories/tags must not trigger it
- Production mode strips internal error messages from API responses (debug locally for full details)
- JSON body limit: 16KB

## Key Conventions

- **Imports:** Use `@/` path alias for all frontend imports (maps to `frontend/` root)
- **Theming:** All themed UI must use `useTheme()` + `createStyles(theme)` factory pattern — never use static color constants
- **Tests:** When adding/removing test suites, update `frontend/__tests__/README.md`. Frontend Jest uses `jest-silent-reporter` + `summary` reporters. Backend Jest uses `ts-jest` with ESM preset and suppresses console output during tests

### AsyncStorage Keys

Versioned keys — do not rename without migrating all references.

**Theme:** `app_theme_v1` (stores `"default"` | `"dark"` | `"light"`)

**Prayer:** `prayerSettings` (JSON object), `selectedCity` (legacy city fallback)

**Notifications:** `notif_enabled_v1` (`"1"`/`"0"` strings, not JSON booleans), `notif_os_status_v1`, `notif_schedule_ids_v1`, `notif_daykey_v1`, `notif_seen_keys_v1`, `notif_city_display_loc_v1`, `notif_city_display_man_v1`, `notif_last_manual_city_v1`, `notif_map_v1`, `notif_sound_mode_v1`

**Quran:** `quran:bookmarks`, `quran_display_modes`, `quran:last-read:index`, `quran:last-read:position`

**Other:** `dua_history_v1` (dua request history), `ramadan_tracker_v1` (missed fast days map), `mosques_[lat]_[lng]` (dynamically keyed mosque cache)

## Critical Gotchas

- Backend must be run from `backend/` directory — `loadDuas()` resolves via `process.cwd()/public/duas.json`
- Root layout (`app/_layout.tsx`) waits for theme hydration before rendering to prevent first-frame flash
- `quranData` accessors throw if preload hasn't occurred (preload is triggered in root layout)
- Frontend prayer method `-1` maps to `method=auto` in backend API
- CORS allowlist in `backend/src/index.ts` is explicit — add new origins there when needed
- Trust proxy resolves to `true` in production, `false` in development (override with `TRUST_PROXY` env var)

## CI/CD

- Pushes to `main` touching `frontend/**` trigger iOS-only OTA update via `.github/workflows/expo-ota.yml` (Node 22, requires `EXPO_TOKEN` secret, skipped if commit message contains `[no-ota]` or only markdown files changed)
- Pushes to `main` touching `docs/**` deploy to GitHub Pages via `.github/workflows/pages.yml` (custom domain: `sirat.dev`)
