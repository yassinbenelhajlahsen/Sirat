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

> **`docs/` vs `devDocs/`:** `docs/` is ONLY the public landing-page site deployed to GitHub Pages (`sirat.dev`) — never put internal/dev docs there. All internal design specs and implementation plans live under `devDocs/superpowers/` (`devDocs/superpowers/specs/`, `devDocs/superpowers/plans/`).

**Frontend patterns:**
- Screens in `app/(tabs)/` are thin — they delegate to hooks and services
- Business logic lives in `services/`, with modular sub-directories (`prayer-times/`, `notifications/`) orchestrated by facade files (`prayerTimes.ts`, `notificationService.ts`)
- State: React Context (`ThemeContext`, `QuranAudioProvider`) + local state + AsyncStorage persistence — no Redux/Zustand
- Cross-screen sync via `DeviceEventEmitter` with exact event names: `settingsChanged`, `NOTIF_PREFS_UPDATED`, `QURAN_DISPLAY_MODES_UPDATED`, `FORCE_UPDATE_REQUIRED`, `PRAYER_LOG_UPDATED`, `HABITS_UPDATED`, `HABIT_LOG_UPDATED`
- All backend HTTP calls go through `frontend/services/apiClient.ts` (`apiFetch`/`apiPost`) which attaches version headers and intercepts 426 responses

**Backend patterns:**
- Classic routes → controllers → services → utils layered architecture
- Per-route rate limiting via `express-rate-limit`: dua 60/15min, mosque 100/15min, prayer-times 300/15min, holidays 180/15min
- Aladhan proxy caching with TTLs (timings 5min, calendar 12hr, holidays 24hr), stale-on-error fallback, in-flight request deduplication, and retry with exponential backoff (3 attempts, 300ms base)
- Prompt injection defense on the dua endpoint — new dua categories/tags must not trigger it
- Production mode strips internal error messages from API responses (debug locally for full details)
- JSON body limit: 16KB
- Minimum version gate: `minVersionGate` middleware (registered after CORS, before routes) logs in monitor mode (`ENFORCE_MIN_VERSION=false`, the default) and blocks with 426 in enforcement mode. `GET /api/app/version` and health endpoints are always exempt.

## Key Conventions

- **Imports:** Use `@/` path alias for all frontend imports (maps to `frontend/` root)
- **Theming:** All themed UI must use `useTheme()` + `createStyles(theme)` factory pattern — never use static color constants
- **Safe areas:** The full-bleed gradient/`Aurora` background fills the whole screen (incl. safe areas). For **scrollable** screens, do NOT wrap the scroll view in `SafeAreaView` (it insets the scroll *frame*, so content hard-clips at the safe-area line as it scrolls). Instead make the scroll view full-bleed and apply `useSafeAreaInsets()` as padding on the content: `contentContainerStyle` `paddingTop: insets.top` / `paddingBottom: insets.bottom`, plus `contentInsetAdjustmentBehavior="never"` so iOS doesn't double the top inset. For a fixed header above the list (Quran, `[date]`), put `paddingTop: insets.top` on the header instead. **Fixed-layout** screens with no scroll container (Qibla, Calendar) keep `SafeAreaView` — there's nothing to clip. Exactly one `SafeAreaProvider`, at the root (`app/_layout.tsx`); never nest another. The shared `Screen` component takes `safeArea={false}` to opt into full-bleed.
- **Display font:** Large stat numerals use Fraunces via `@/components/ui/DisplayNumber` (`DISPLAY_FONT_FAMILY = "Fraunces_700Bold"`, loaded in `app/_layout.tsx`). The streak flame 🔥 is the only emoji; all other icons are Ionicons.
- **Routes:** `/Tracker` is a stack route (registered in `app/_layout.tsx`) reached from Home's "View tracker & habits" affordance.
- **Habit frequency:** `HabitFrequency` is `{type:"daily"}` or `{type:"weekly", days:number[]}` where `days` are weekday indices (0=Sun..6=Sat, from `Date.getDay()`). `isHabitDueOnDate`/`frequencyLabel` live in `@/utils/habitFrequency`. Legacy `{type:"weekly", timesPerWeek}` habits migrate to Daily on read in `services/tracking/habits.ts` (no `updatedAt` bump). Habits are checked off for **today** from the Tracker rows (due days only) and for **any date** from the Calendar checklist; both filter by `isHabitDueOnDate`.
- **Auth:** Identity via Clerk (`@clerk/expo` v3.5.2) with Apple + Google sign-in only. The ONLY direct Clerk touch points are `services/auth/authToken.ts` (non-hook token getter), `hooks/useAuthState.ts`, `hooks/useAccountActions.ts`, `ClerkProvider` wrapper in `app/_layout.tsx`, and the `SignIn.tsx` screen — everything else consumes those adapters. Env var `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend); backend uses `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY`. Sign-in is optional; the app works fully signed-out. **Native-build requirement:** Clerk + `expo-secure-store` are native modules → Phase 2 requires a new EAS build and App Store submission, not OTA.
- **Tests:** When adding/removing test suites, update `frontend/__tests__/README.md`. Frontend Jest uses `jest-silent-reporter` + `summary` reporters. Backend Jest uses `ts-jest` with ESM preset and suppresses console output during tests. Test files that mock `react-native-safe-area-context` must include `useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })` alongside `SafeAreaView`/`SafeAreaProvider`, or screens using the hook throw

### AsyncStorage Keys

Versioned keys — do not rename without migrating all references.

**Theme:** `app_theme_v1` (stores `"default"` | `"dark"` | `"light"`)

**Prayer:** `prayerSettings` (JSON object), `selectedCity` (legacy city fallback)

**Notifications:** `notif_enabled_v1` (`"1"`/`"0"` strings, not JSON booleans), `notif_os_status_v1`, `notif_schedule_ids_v1`, `notif_daykey_v1`, `notif_seen_keys_v1`, `notif_city_display_loc_v1`, `notif_city_display_man_v1`, `notif_last_manual_city_v1`, `notif_map_v1`, `notif_sound_mode_v1`

**Quran:** `quran:bookmarks`, `quran_display_modes`, `quran:last-read:index`, `quran:last-read:position`

**Tracking:** `tracking:prayer_log_v1` (prayer status cells), `tracking:habits_v1` (habit definitions), `tracking:habit_log_v1` (habit completion cells). Values stored as `Cell<T>` = `{ value, updatedAt }` for sync LWW; habits carry `updatedAt` + optional `deletedAt` tombstone.

**Other:** `dua_history_v1` (dua request history), `ramadan_tracker_v1` (missed fast days map), `mosques_[lat]_[lng]` (dynamically keyed mosque cache)

## Critical Gotchas

- Backend must be run from `backend/` directory — `loadDuas()` resolves via `process.cwd()/public/duas.json`
- Root layout (`app/_layout.tsx`) waits for theme hydration before rendering to prevent first-frame flash
- `quranData` accessors throw if preload hasn't occurred (preload is triggered in root layout)
- Frontend prayer method `-1` maps to `method=auto` in backend API
- CORS allowlist in `backend/src/index.ts` is explicit — add new origins there when needed
- Trust proxy resolves to `true` in production, `false` in development (override with `TRUST_PROXY` env var)
- **Force update rollout order:** deploy backend first (`ENFORCE_MIN_VERSION=false`), ship frontend OTA update second, then flip `ENFORCE_MIN_VERSION=true`. Never enable enforcement before the frontend update is live or all existing users get locked out.

## CI/CD

- Pushes to `main` touching `frontend/**` trigger iOS-only OTA update via `.github/workflows/expo-ota.yml` (Node 22, requires `EXPO_TOKEN` secret, skipped if commit message contains `[no-ota]` or only markdown files changed)
- Pushes to `main` touching `docs/**` deploy to GitHub Pages via `.github/workflows/pages.yml` (custom domain: `sirat.dev`)
