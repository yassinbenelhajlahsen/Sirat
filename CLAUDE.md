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
- Cross-screen sync via `DeviceEventEmitter` with exact event names: `FORCE_UPDATE_REQUIRED`, `PRAYER_LOG_UPDATED`, `HABITS_UPDATED`, `HABIT_LOG_UPDATED`. Synced settings do NOT use `DeviceEventEmitter`: they notify through `subscribe` on the setting (see Sync)
- All backend HTTP calls go through `frontend/services/apiClient.ts` (`apiFetch`/`apiPost`) which attaches version headers and intercepts 426 responses. The mosque and holiday services call `loggedFetch` from the same file directly, so failed requests still reach the bug log
- Window reminders fire `offset` minutes before the next prayer (Fajr target is Sunrise; no Isha window), are suppressed when the prayer is already logged, and share the iOS 60-notification budget with at-prayer alerts (candidates sorted by fire time and cut to the budget in the pure planner, `services/notifications/planner.ts`). `scheduler.ts` is IO only: it reads inputs, asks the planner, and diffs against the OS. The schedule is fingerprinted from the planner's output (no hand-listed inputs or version constant), and anything a notification depends on triggers a reschedule by itself (synced settings, prayer settings, master switch via `subscribeMasterEnabled`, Pretend Ramadan, prayer log), so never emit a manual "please reschedule" event. Overlapping reschedule requests collapse into one extra run

**Backend patterns:**
- Classic routes → controllers → services → utils layered architecture
- Per-route rate limiting via `express-rate-limit`: mosque 100/15min, prayer-times 300/15min, holidays 180/15min, feedback 10/hour, chat 100/15min per IP plus 10/min per user (keyed by Clerk user ID, the only limiter not keyed by IP) and one reply in progress per user (409 `busy`)
- Aladhan proxy caching with TTLs (timings 5min, calendar 12hr, holidays 24hr), stale-on-error fallback, in-flight request deduplication, and retry with exponential backoff (3 attempts, 300ms base). All of it lives in `services/aladhanFetch.ts` (`createCachedGetter`, `requestAladhan`); `aladhanService.ts` only declares each getter's key, fetch and TTL. The prayer-times and holiday controllers share `controllers/aladhanHelpers.ts`
- Production mode strips internal error messages from API responses (debug locally for full details)
- JSON body limit: 16KB globally; `/api/sync` (1MB), `/api/feedback` (256KB) and `/api/chat` (128KB) have their own parsers and are skipped in `index.ts`
- Feedback: `POST /api/feedback` saves to `feedback_reports` (Prisma), then emails `support@sirat.dev` through Resend (`services/emailService.ts`, plain `fetch`, 5s timeout, `RESEND_API_KEY`). The row is the source of truth: an email failure never fails the request. Auth is optional, and `diagnostics`, `device` and `platform` are stored for bugs only. Account deletion also deletes the user's reports. Save errors log the error name and code only, because Prisma messages can echo report text
- **Chat (server):** `POST /api/chat` and `GET /api/chat/status` (`routes/chat.ts`, `controllers/chatController.ts`, `services/chat/`) return 503 unless `CHAT_ENABLED=1`. Order: switch, auth, validation, per-user limit, identity hash, allowance (DeviceCheck on the month's first message), one atomic quota claim, then `answerMessage` (moderate the question, self-harm gets the crisis reply; model with at most 3 Quran/hadith searches; quote guard retries once then strips; model/provider names scrubbed; moderate the answer, severe gets blocked; citations rendered from stored text, only IDs this request's searches returned). Crisis replies always refund the message; blocked replies and failures after the claim refund it at most 5 times a month (`MAX_REFUNDS`, the `refunds` column), since each one still paid for a model run. The whole reply has a 45s deadline and stops (and refunds) if the client disconnects. Never log chat text: errors are fixed strings, logs carry event names and status codes only, and body-parser errors are answered inside the chat router so they never reach the global `errorHandler` (it logs the whole error, raw body included). `chat_usage` is keyed to an HMAC of the Apple/Google ID (`CHAT_IDENTITY_SECRET`), not the Clerk user, so deleting and re-creating an account keeps the month's count; rows from earlier months are purged; changing the secret resets everyone's month. The allowance is decided in one place: `MONTHLY_ALLOWANCE`/`REDUCED_ALLOWANCE` in `quota.ts` and `decideAllowance` in `deviceCheck.ts`. Sources: `npm run import:quran -- ../frontend/assets/data/quran` and `npm run import:hadith` (HadeethEnc; re-run it monthly, its terms require keeping the copy current). `npm run chat:eval -- <questions.md> <out.md>` runs the pre-launch question set through the same `answerMessage`
- Minimum version gate: `minVersionGate` middleware (registered after CORS, before routes) always blocks with 426 when the `x-sirat-app-version` header is missing or below `MIN_SUPPORTED_APP_VERSION`. There is no monitor mode. `GET /api/app/version` and health endpoints are always exempt.
- **Migrations:** Prisma Migrate (`prisma/schema.prisma`, `prisma/migrations/`); `npm run migrate` = `prisma migrate deploy`, chained into `start`. Existing `users`/`sync_documents` queries stay raw `pg` (`src/db/pool.ts`); new tables use the `PrismaClient` singleton (`src/db/prisma.ts`). Prisma serves request-path queries (feedback, account deletion), so `db/prisma.ts` caps its pool at 5 through `withConnectionLimit`, keeping it plus the raw `pg` pool under Railway's Postgres connection limit. Local `backend/.env` points at a local `sirat_dev` database (the production URL is commented out above it); check the host before running `migrate:dev`.

## Key Conventions

- **Imports:** Use `@/` path alias for all frontend imports (maps to `frontend/` root)
- **Theming:** All themed UI must use `useTheme()` + `createStyles(theme)` factory pattern — never use static color constants
- **Safe areas:** The full-bleed gradient/`Aurora` background fills the whole screen (incl. safe areas). For **scrollable** screens, do NOT wrap the scroll view in `SafeAreaView` (it insets the scroll *frame*, so content hard-clips at the safe-area line as it scrolls). Instead make the scroll view full-bleed and apply `useSafeAreaInsets()` as padding on the content: `contentContainerStyle` `paddingTop: insets.top` / `paddingBottom: insets.bottom`, plus `contentInsetAdjustmentBehavior="never"` so iOS doesn't double the top inset. For a fixed header above the list (Quran, `[date]`), put `paddingTop: insets.top` on the header instead. **Fixed-layout** screens with no scroll container (Qibla, Calendar) keep `SafeAreaView` — there's nothing to clip. Exactly one `SafeAreaProvider`, at the root (`app/_layout.tsx`); never nest another. The shared `Screen` component takes `safeArea={false}` to opt into full-bleed.
- **Display font:** Large stat numerals use the system face (tightened, tabular figures) via `@/components/ui/DisplayNumber`; no serif is loaded. The only custom font is Amiri (`assets/fonts/`, OFL), loaded inside `SplashScreen` for its Arabic. The streak flame 🔥 is the only emoji; all other icons are Ionicons.
- **Routes:** `/Tracker` is a stack route (registered in `app/_layout.tsx`) reached from Home's "View tracker & habits" affordance.
- **Prayer settings:** `prayerSettingsSetting` (in `services/syncedSettings/`) holds only what the user chose: `useLocation`, `method` (default Auto, `-1`) and `city`, plus `cityKey`, the same city as a key string, written alongside `city` so older app builds on the user's other devices can still read it. On read `city` wins and `cityKey` is only a fallback; never drop `cityKey` from writes while older builds are in use. The OS location permission is applied on read by `getEffectivePrayerSettings()` in `services/prayerSettings.ts` and is NEVER written back, so a denied permission on one device cannot overwrite the others. Every reader (Home, Calendar, notifications, widgets, splash) uses the effective settings; only the Settings screen reads the raw choice, and it saves only on real edits. `selectedCity` is read only as a legacy fallback when `prayerSettings` is missing.
- **Prayer day:** `services/prayerTimes.ts` returns a `PrayerDay` (`services/prayerDay.ts`): a `dateKey` plus ordered slots with real `Date`s (Sunrise included). Strings exist only at display (`formatClock`); the one 12-hour parser lives in `buildPrayerDay` and the prayer cache still stores 12-hour strings. Next prayer, window end and Maghrib are lookups on the day (`nextSlot`, `windowEnd`, `maghribOf`). `PrayerName` is capitalized everywhere ("Fajr"); stored prayer-log keys stay lowercase and convert only inside `services/tracking/` (`logKey`, `unwrapDay`), so anything reading the raw log must go through those. The one date-key helper is `dateKeyFromDate` in `utils/dateKey.ts`. Prayer-times requests go through `services/apiClient.ts`, which also sends the auth token.
- **One prayer-day hook:** Home and Calendar both use `hooks/usePrayerDay.ts` (`usePrayerDay("today")` for Home, `usePrayerDay(date)` for a browsed day). It owns times, next prayer and countdown, Hijri date, prayer marks, the log sheet props (`<PrayerLogSheet {...logSheet} />`) and the error. Transient network errors retry with backoff (3 times), then a banner shows; a location error (`isLocationUnavailable`, thrown as `LocationUnavailableError` by `services/prayer-times/environment.ts`) adds Open Settings. Match errors by code, never by message.
- **Ramadan day:** comes from Umm al-Qura (`utils/hijriDate.ts`: `isFastingDay`, `ramadanPeriod`, `isMissedFastDay`) for both the Ramadan wording and marking a missed fast, which is allowed up to 3 days either side. The holiday feed is not used for Ramadan.
- **Tracker stores:** `prayerLog`, `habitLog` and `habits` share `services/tracking/trackerStore.ts` (cache, single load, persist, notify) and the `useTrackerData` hook. Un-marking a prayer writes a **cleared mark**, a time-stamped cell with `value: null`, never a delete, so the removal wins the newest-wins merge on every device. Readers (`getDayStatuses`, `unwrapPrayerLog`) treat null as not logged, so anything new that reads the prayer log must skip null values. Frontend and backend merges are both tested against `shared/syncMergeVectors.json`; change a merge rule there first.
- **Habit frequency:** `HabitFrequency` is `{type:"daily"}` or `{type:"weekly", days:number[]}` where `days` are weekday indices (0=Sun..6=Sat, from `Date.getDay()`). `isHabitDueOnDate`/`frequencyLabel` live in `@/utils/habitFrequency`. Legacy `{type:"weekly", timesPerWeek}` habits migrate to Daily on read in `services/tracking/habits.ts` (no `updatedAt` bump). Habits are checked off for **today** from the Tracker rows (due days only) and for **any date** from the Calendar checklist; both filter by `isHabitDueOnDate`.
- **Auth:** Identity via Clerk (`@clerk/expo` v3.5.2) with Apple + Google sign-in only. The ONLY direct Clerk touch points are `services/auth/authToken.ts` (non-hook token getter), `hooks/useAuthState.ts`, `hooks/useAccountActions.ts`, `ClerkProvider` wrapper in `app/_layout.tsx`, and the `SignIn.tsx` screen — everything else consumes those adapters. Env var `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend); backend uses `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY`. Sign-in is optional; the app works fully signed-out. **Native-build requirement:** Clerk + `expo-secure-store` are native modules → Phase 2 requires a new EAS build and App Store submission, not OTA.
- **Sync:** The sync engine lives in `frontend/services/sync/`. It runs only when the user is signed in and online, pushing the 4 domains (`prayer_log`, `habits`, `habit_log`, `settings`) to `POST /api/sync` and applying the merged response locally. The `settings` domain carries 14 synced settings, all declared once in `frontend/services/syncedSettings/definitions.ts` (envelope key, storage key, codec); the sync envelope is generated from those declarations. Each setting exposes `get`, `peek`, `set`, `applyRemote` and `subscribe`: `set` is a user edit (persist, LWW-stamp, notify with source `local`), `applyRemote` is a merged-in value (persist, notify with source `remote`, never stamps). Read and write synced settings only through that module (screens use `useSyncedSetting`), never raw `AsyncStorage`. Notify is synchronous; the sync engine schedules a push only for `local` changes. Device-specific notification state (`notif_enabled_v1`, OS status, schedule/seen/daykey, city-display keys) and the mosque/prayer-times caches never sync. Settings stamping uses a sidecar key `sync:settings_meta_v1`; last sync time persists in `sync:last_synced_v1`. **Known limitation:** the `settings` domain merges each setting as a whole value under one LWW stamp. For the two *accumulating collections* (`quranBookmarks`, `ramadanTracker`) this means concurrent additions on two offline devices can lose entries (the lower-stamped device's whole list is discarded on merge) — acceptable for now; revisit with per-item `Cell`-keyed merge (like `habitLog`) if it bites. The tracker domains (prayer log, habits, habit log) already merge per-cell and are unaffected.
- **Bug log:** `services/diagnostics.ts` keeps a hidden on-device log (`console.error`, uncaught errors, rejections in production, render crashes, failed requests, last 10 screens; 50 entries max) and is sent only with a bug report (`services/feedback.ts`, which adds basic settings). Never put coordinates, city or user-typed text in it, and pass `loggedFetch` a path without the query string, because that can hold coordinates. The root `ErrorBoundary` (`components/RecordAndRethrow.tsx`) records, saves, then rethrows on purpose: if the app survived a render crash, expo-updates could not roll back a broken OTA.
- **Tests:** When adding/removing test suites, update `frontend/__tests__/README.md`. Frontend Jest uses `jest-silent-reporter` + `summary` reporters. Backend Jest uses `ts-jest` with ESM preset and suppresses console output during tests. Test files that mock `react-native-safe-area-context` must include `useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })` alongside `SafeAreaView`/`SafeAreaProvider`, or screens using the hook throw

### AsyncStorage Keys

Versioned keys — do not rename without migrating all references.

**Theme:** `app_theme_v1` (stores `"default"` | `"dark"` | `"light"`)

**Prayer:** `prayerSettings` (JSON object), `selectedCity` (legacy city fallback)

**Notifications:** `notif_enabled_v1` (`"1"`/`"0"` strings, not JSON booleans), `notif_os_status_v1`, `notif_schedule_ids_v1`, `notif_daykey_v1`, `notif_seen_keys_v1`, `notif_city_display_loc_v1`, `notif_city_display_man_v1`, `notif_last_manual_city_v1`, `notif_map_v1`, `notif_sound_mode_v1`, `notif_window_map_v1` (per-window-prayer on/off JSON, keys Fajr/Dhuhr/Asr/Maghrib), `notif_window_offset_v1` (global minutes-before, stored as a string)

**Quran:** `quran:bookmarks`, `quran_display_modes`, `quran:last-read:index`, `quran:last-read:position`, `quran_reciter_v1` (reciter id string)

**Tracking:** `tracking:prayer_log_v1` (prayer status cells), `tracking:habits_v1` (habit definitions), `tracking:habit_log_v1` (habit completion cells). Values stored as `Cell<T>` = `{ value, updatedAt }` for sync LWW; habits carry `updatedAt` + optional `deletedAt` tombstone.

**Sync:** `sync:settings_meta_v1` (per-setting LWW stamps `Record<settingKey, updatedAt>`), `sync:last_synced_v1` (last successful sync epoch-ms)

**Other:** `diagnostics_log_v1` (hidden bug-report log, device-local, never synced), `dua_history_v1` (dua request history), `ramadan_tracker_v1` (missed fast days map), `mosques_[lat]_[lng]` (dynamically keyed mosque cache)

## Critical Gotchas

- Backend must be run from `backend/` directory — `dotenv/config` loads `.env` and the Prisma scripts find `prisma/schema.prisma` relative to the working directory
- Root layout (`app/_layout.tsx`) waits for theme hydration before rendering to prevent first-frame flash
- `quranData` accessors throw if preload hasn't occurred (preload is triggered in root layout)
- Frontend prayer method `-1` maps to `method=auto` in backend API
- CORS allowlist in `backend/src/index.ts` is explicit — add new origins there when needed
- Trust proxy resolves to `true` in production, `false` in development (override with `TRUST_PROXY` env var)
- **Local Postgres:** the PostgreSQL 17 app holds port 5432, so the Homebrew `postgresql@17` service cannot start alongside it.
- **Force update:** OTA updates install automatically, so the gate is only for native builds. Raise `MIN_SUPPORTED_APP_VERSION` only after the new native build is approved and live on the App Store; every build below it is locked out the moment the backend picks up the new value.

## CI/CD

- Pushes to `main` touching `frontend/**` trigger iOS-only OTA update via `.github/workflows/expo-ota.yml` (Node 22, requires `EXPO_TOKEN` secret, skipped if commit message contains `[no-ota]` or only markdown files changed)
- Pushes to `main` touching `docs/**` deploy to GitHub Pages via `.github/workflows/pages.yml` (custom domain: `sirat.dev`)
