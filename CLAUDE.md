# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sirat is an Islamic companion mobile app. This is a simple directory-based monorepo (no workspaces) with two independent packages — each has its own `package.json`, `node_modules`, and config. There is no root `package.json`. All commands must be run from the correct sub-directory.

## Commands

### Frontend (run from `frontend/`)

```bash
npm start                # expo start
npm run ios              # expo run:ios
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
```

## Architecture

See `AGENTS.md` for full architecture details. Key points:

**Monorepo layout:** `frontend/` (Expo 54 + React Native 0.81 + Expo Router 6), `backend/` (Express + TypeScript API proxy), `docs/` (GitHub Pages site), `plans/` (planning docs).

**Frontend patterns:**
- Screens in `app/(tabs)/` are thin — they delegate to hooks and services
- Business logic lives in `services/`, with modular sub-directories (`prayer-times/`, `notifications/`) orchestrated by facade files (`prayerTimes.ts`, `notificationService.ts`)
- State: React Context (`ThemeContext`, `QuranAudioProvider`) + local state + AsyncStorage persistence — no Redux/Zustand
- Cross-screen sync via `DeviceEventEmitter` with exact event names: `settingsChanged`, `NOTIF_PREFS_UPDATED`, `QURAN_DISPLAY_MODES_UPDATED`

**Backend patterns:** Classic routes → controllers → services → utils layered architecture.

## Key Conventions

- **Imports:** Use `@/` path alias for all frontend imports (maps to `frontend/` root)
- **Theming:** All themed UI must use `useTheme()` + `createStyles(theme)` factory pattern — never use static color constants
- **AsyncStorage keys:** Versioned (e.g., `app_theme_v1`, `notif_enabled_v1`). The notification toggle stores `"1"`/`"0"` strings, not JSON booleans. Do not rename keys without migrating all references
- **Tests:** When adding/removing test suites, update `frontend/__tests__/README.md`. Jest uses `jest-silent-reporter` + `summary` reporters

## Critical Gotchas

- Backend must be run from `backend/` directory — `loadDuas()` resolves via `process.cwd()/public/duas.json`
- Root layout (`app/_layout.tsx`) waits for theme hydration before rendering to prevent first-frame flash
- `quranData` accessors throw if preload hasn't occurred (preload is triggered in root layout)
- Frontend prayer method `-1` maps to `method=auto` in backend API
- CORS allowlist in `backend/src/index.ts` is explicit — add new origins there when needed

## CI/CD

- Pushes to `main` touching `frontend/**` trigger OTA update via `.github/workflows/expo-ota.yml` (skipped if commit message contains `[non-ota]`)
- Pushes to `main` touching `docs/**` deploy to GitHub Pages via `.github/workflows/pages.yml`
