# User Accounts & Cloud Sync — Design

**Date:** 2026-06-19 (updated 2026-06-21)
**Status:** Phase 1 (backend), Phase 2 (frontend auth), and Phase 3 (sync engine) **all shipped**
**Branch context:** builds on the tracking feature (`feat/habit-tracker`); auth work on `feat/auth`

> **Update 2026-06-20:** The implemented backend deviates from the original
> brainstorm in one material way — **Prisma Migrate replaced the planned
> "lightweight SQL-file migration runner."** The schema lives in
> `backend/prisma/schema.prisma` and is applied via `prisma migrate deploy`.
> Request-path queries for the `users` / `sync_documents` tables still use raw
> `pg` exactly as designed below; only the migration mechanism changed. All
> sections below have been reconciled with the shipped code. See
> **Implementation status** at the end for the per-section diff.

## Goal

Add user accounts (Apple + Google sign-in) and cloud sync so a user's
tracker data and user-level settings follow them across devices and survive
reinstalls. Establish a real user identity + backend foundation for future
features that require users.

Drivers (confirmed): **multi-device sync** and **backup/restore**, equally,
plus a **user-identity foundation** for future server-backed features.

## Decisions (locked during brainstorming)

- **Auth:** Apple + Google sign-in only. **No email / magic link** (avoids SMTP
  burden), **no custom passwords**.
- **Identity provider:** **Clerk** (`@clerk/clerk-expo`). Clerk sends/verifies
  the Apple/Google flows and issues a session JWT; our backend verifies that JWT
  via Clerk's JWKS. Free to 10k MAU.
- **Backend:** extend the existing Express app on **Railway** with **Postgres**.
  Data lives in our own DB (not in Clerk, not in a third-party DB) so future
  features live in our codebase. This is approach **C** below.
- **Sync model:** approach **C** — JSONB-per-domain documents with
  **server-side LWW merge inside a transaction**.
- **Sign-in is optional:** the app stays fully usable anonymously; signing in
  only turns on sync.

## Sync scope

**Syncs (user-level):**
- Tracker: prayer log, habits, habit log (already carry `Cell` / `updatedAt`
  stamps).
- Prayer settings (`prayerSettings`, `selectedCity`).
- Theme (`app_theme_v1`).
- Quran: progress, bookmarks, reading mode, display modes.
- Ramadan tracker (`ramadan_tracker_v1`).

**Never syncs (device-specific):**
- Notification scheduling/runtime state: `notif_schedule_ids_v1`,
  `notif_os_status_v1`, `notif_daykey_v1`, `notif_seen_keys_v1`, etc.
- Any OS permission / device-local cache (mosque cache, prayer-times cache).

> Notification *preferences* (enabled, sound mode, per-prayer map) are a
> candidate for a later pass but are **out of scope** here to keep the device
> vs. user split clean.

## Architecture overview

```
Expo app ──Clerk SDK──> Clerk (Apple/Google sign-in)
   │ Clerk session JWT (Authorization: Bearer …)
   ▼
Express on Railway ──verify JWT (Clerk JWKS)──> Postgres
   POST /api/sync     (server-side LWW merge in a txn)
   DELETE /api/account
```

A user is at most **4 rows** in `sync_documents` (one JSONB doc per domain).

## Why approach C (vs alternatives)

- **A — fully normalized (row per cell):** concurrency-safe and delta-friendly,
  but the data volume (even years of logs are tens of KB) never justifies the
  schema and write complexity.
- **B — dumb blob store, client-side merge:** minimal backend and reuses
  `merge.ts` verbatim, but has a real **lost-update window** when two devices
  push concurrently. Rejected — that's a correctness bug for a multi-device
  feature.
- **C — JSONB-per-domain, server-side merge in a transaction (chosen):**
  concurrency-safe like A, reuses the existing `Cell` merge logic, tiny schema.
  Can migrate C→A later if a feature needs server-side per-cell queries.

## Data model (Postgres)

The schema is defined in **`backend/prisma/schema.prisma`** (source of truth) and
materialized by Prisma Migrate. The generated SQL is equivalent to the design
below; column names use snake_case via Prisma `@map`. **Note:** these two tables
are still *queried* with raw `pg` (see "DB query boundary"), Prisma owns only
their schema/migrations.

```prisma
// Clerk user id is the primary key (text, e.g. "user_2abc…")
model User {
  id            String         @id
  email         String?        // cached from JWT claims, optional (NULL in Phase 1)
  name          String?        // cached from JWT claims, optional (NULL in Phase 1)
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  syncDocuments SyncDocument[]
  @@map("users")
}

// One JSONB document per (user, domain). domain ∈
// {'prayer_log','habits','habit_log','settings'}
model SyncDocument {
  userId    String   @map("user_id")
  domain    String
  doc       Json     @default("{}")
  updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, domain])
  @@map("sync_documents")
}
```

> **DB query boundary (documented in `backend/AGENTS.md`):** existing tables
> (`users`, `sync_documents`) are queried with raw `pg` via `src/db/pool.ts`
> (incl. the `FOR UPDATE` sync transaction). **New** feature tables use the
> Prisma Client singleton in `src/db/prisma.ts`. When the Prisma client starts
> serving request-path queries, cap its pool with `?connection_limit=` on the
> URL so the Prisma pool plus the raw `pg` pool stay under Railway's Postgres
> connection limit.

Domain doc shapes:
- `prayer_log` → `PrayerLog` = `Record<dateKey, Partial<Record<PrayerName, Cell<PrayerStatus>>>>`
- `habits` → `Habit[]` (each with `updatedAt` + optional `deletedAt` tombstone)
- `habit_log` → `HabitLog` = `Record<dateKey, Record<habitId, Cell<boolean>>>`
- `settings` → **stamped envelope** `Record<settingKey, { value, updatedAt }>`

## Sync protocol

**Endpoint:** `POST /api/sync` (auth required).

Request body (client sends whatever it has; a fresh device sends empty docs and
still hydrates):
```json
{
  "prayer_log": { ... }, "habits": [ ... ],
  "habit_log": { ... }, "settings": { ... }
}
```

Server, **per domain, in a transaction**:
1. `SELECT doc FROM sync_documents WHERE user_id=$1 AND domain=$2 FOR UPDATE`
2. Merge incoming into stored using the shared `Cell` LWW functions.
3. `UPDATE … SET doc = merged, updated_at = now()` (upsert if absent).

Response — the merged authoritative docs the client then applies locally:
```json
{ "prayer_log": {…}, "habits": […], "habit_log": {…},
  "settings": {…}, "syncedAt": "<iso>" }
```

**Merge rule (deterministic & idempotent):** an incoming cell/habit replaces the
stored one **iff `incoming.updatedAt > stored.updatedAt`** (stored wins ties).
Converges across devices and is safe to retry.

> Note: the client's existing `merge.ts` keeps *local* on ties; the server keeps
> *stored* on ties. This asymmetry is harmless because real edits always carry
> distinct, newer stamps — both sides converge. Documented so it isn't "fixed"
> into a bug later.

**Shared merge code:** `frontend/services/tracking/merge.ts` is ~60 lines and
lives in `frontend/`. The monorepo has no shared workspace, so the backend has a
**deliberate copy** in `backend/src/utils/syncMerge.ts`
(`mergePrayerLogs` / `mergeHabitLogs` / `mergeHabits` / `mergeSettings`) plus a
**shared test vector** that both sides run, preventing drift. The server-side
`mergeSettings` already exists; Phase 3 adds the frontend settings-merge
counterpart and must wire it into the shared test vector (see Testing).

## Frontend: auth

- Wrap the app in `<ClerkProvider>` (`@clerk/clerk-expo`), token cache backed by
  `expo-secure-store`.
- A sign-in screen offers **Apple** + **Google** via Clerk's OAuth flow.
- Sign-in is optional. The app works anonymously; signing in enables sync.
- Each sync request attaches Clerk's session JWT (`getToken()`) as
  `Authorization: Bearer <jwt>`.

## Frontend: sync engine

New module `frontend/services/sync/syncEngine.ts`:
- **Single-flight:** never overlap syncs; if a change arrives mid-sync, re-run
  once after.
- **Guards:** only run when signed-in (Clerk session active) **and** online
  (`expo-network`).
- **Per-domain adapters** expose:
  - `read()` → build the stamped local doc for that domain.
  - `applyMerged(doc)` → persist + emit the service's existing reload event so
    the UI refreshes live.
  - Tracker adapters reuse existing get/persist; add an internal
    "replace whole log / replace all habits" setter to `prayerLog.ts`,
    `habitLog.ts`, `habits.ts` for `applyMerged`.
- **Triggers:** on Clerk **sign-in**; on `AppState` → **active**
  (foreground/launch); and **debounced (~4s)** off existing change events
  (`PRAYER_LOG_UPDATED`, `HABIT_LOG_UPDATED`, `HABITS_UPDATED`,
  `settingsChanged`, the Quran `*_UPDATED` events, theme change).
- Persist `sync:last_synced_v1` for a subtle sync-status indicator.

## Frontend: settings stamping (the one new mechanism)

Theme / prayer settings are currently raw, unstamped values. To LWW-merge them:
- `frontend/services/sync/settingsRegistry.ts` maps each synced setting →
  `{ storageKey, read(), applyValue(), changeEvents[] }`.
- Stamp sidecar `sync:settings_meta_v1` = `Record<settingKey, updatedAt>`. The
  sync engine subscribes to each setting's **already-emitted** change event and
  bumps that key's stamp — services are **not** modified internally.
- `read()` builds the envelope `{ key: { value, updatedAt } }`.
- `applyMerged()` writes back only keys whose merged stamp is newer than local,
  then emits each service's reload event.

## Edge cases

- **Sign-in with existing local data:** first sync merges anonymous local data
  up into the cloud automatically (LWW — nothing lost). No prompt.
- **Sign-out:** stop syncing, **keep** local data on device (app still works
  anonymously). No destructive clear.
- **Account deletion (App Store requirement):** `DELETE /api/account` removes the
  user's `sync_documents` + `users` rows **and** deletes the Clerk user via
  `CLERK_SECRET_KEY`. Surfaced as "Delete account" in settings.
- **Body-limit gotcha:** the backend's global JSON limit is **16KB**; full logs
  can exceed that. The `/api/sync` route gets its **own ~1MB limit** while every
  other route stays 16KB.
- **Rate limiting:** a `sync` limiter (~120 / 15 min) following the existing
  `express-rate-limit` per-route pattern.

## Error handling

- **Offline / network error:** swallowed; retried on the next trigger.
- **401 (expired/invalid token):** Clerk SDK refreshes via `getToken()`; if it
  still fails, treat as signed-out.
- **Per-request atomicity:** the transaction means a failed sync leaves local
  state untouched; retry later.
- **426 force-update:** already handled by `services/apiClient.ts`.

## Testing

- **Backend (done in Phase 1):** ported merge tests live in
  `backend/src/utils/syncMerge.ts` tests; `/api/sync` endpoint tests;
  auth-middleware test; `DELETE /api/account` test. Schema/migrations handled
  by **Prisma Migrate** (`prisma/schema.prisma` + `prisma/migrations/`), not a
  hand-rolled runner — the custom SQL-file runner from the brainstorm was
  removed.
- **Frontend:** sync-engine tests (single-flight, debounce, online/offline
  guard); settings-stamping tests; adapter `applyMerged` tests — following the
  existing Babel-jest static-mock pattern (no dynamic `import()`).
- **Drift guard:** a shared merge **test vector** runs on both frontend and
  backend. Phase 1 ships a backend-only `mergeSettings` (no frontend counterpart
  until Phase 3's settings stamping). When Phase 3 adds frontend settings
  merging, add `mergeSettings` to the shared merge test vector so both sides are
  drift-guarded.

## Infra / config

- **Railway:** add the Postgres plugin + `DATABASE_URL`. Backend deps:
  `pg` (raw queries) **plus** `prisma` + `@prisma/client` — both in
  `dependencies` (not devDeps) so `prisma migrate deploy` runs at production
  boot. `postinstall` runs `prisma generate`; `start` runs
  `prisma migrate deploy && node dist/index.js`.
- **Secrets:** `CLERK_SECRET_KEY` (backend — JWKS verify + admin delete),
  `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend).
- **CLAUDE.md:** add `sync:settings_meta_v1` and `sync:last_synced_v1` to the
  AsyncStorage-keys list; note the new device-vs-user sync split.

## Native build / release note

Adding Clerk pulls in native modules not currently compiled into the iOS binary
(`expo-secure-store`, the OAuth stack, `expo-apple-authentication`) plus the
**Sign in with Apple** entitlement. Therefore **Phase 2 requires a new EAS build
+ App Store submission** — it cannot ship via OTA. The backend (Phase 1) deploys
to Railway independently. Once the auth-capable binary is live, Phase 3 sync
work can largely ride the existing OTA pipeline (as long as it adds no further
native modules).

## Phasing (each independently shippable)

1. ✅ **Backend foundation (shipped)** — Postgres via Prisma Migrate, Clerk
   `requireAuth`, `users` table (`ensureUser` upsert on first sync),
   `POST /api/sync` + transactional merge, `DELETE /api/account`. (Railway
   deploy.)
2. ✅ **Frontend auth (shipped)** — `ClerkProvider`, `SignIn.tsx` screen,
   optional-login UX (`SignInCard`), account / sign-out / delete via
   `useAccountActions`. **(Submission gate — new binary.)**
3. ✅ **Sync engine (shipped)** — `frontend/services/sync/` built and tested.
   Per-domain adapters (tracker + settings), triggers (sign-in, foreground,
   debounced change events), settings stamping (`settingsRegistry.ts`,
   `sync:settings_meta_v1` sidecar), sync-status indicator (`useSyncStatus`,
   `sync:last_synced_v1`), and single-flight/feedback-loop guard
   (`isApplyingRemote()`) are all live. (OTA — no native modules added.)

## Risks / tradeoffs accepted

- Introduces a **vendor (Clerk)** and a **stateful backend** (DB backups,
  migrations, a new secret) to a previously stateless proxy — a real operational
  step up, accepted for the identity foundation.
- **Merge logic duplicated** across frontend/backend (no shared workspace),
  mitigated by a shared test vector.
- Server/client **tie-break asymmetry** documented above.

## Implementation status (2026-06-20)

What the shipped code looks like, so Phase 3 builds on facts rather than the
brainstorm. Deviations from the original design are flagged **[DEVIATION]**.

**Phase 1 — backend (shipped):**
- Schema: `backend/prisma/schema.prisma` (`User`, `SyncDocument`). **[DEVIATION]**
  Prisma Migrate (`prisma/migrations/`: `0_init`, `1_drop_legacy_migrations`)
  replaced the planned SQL-file runner; the custom runner and legacy
  `_migrations` table were removed.
- DB layer: raw `pg` pool `src/db/pool.ts`; Prisma singleton `src/db/prisma.ts`
  (for *future* tables only). Query boundary documented in `backend/AGENTS.md`.
- Sync: `routes/sync.ts` → `controllers/syncController.ts` →
  `services/syncService.ts` (raw `pg`, `BEGIN` / `SELECT … FOR UPDATE` /
  `INSERT … ON CONFLICT … DO UPDATE` / `COMMIT`). Merge in `utils/syncMerge.ts`.
  Domains in `types/sync.ts`: `prayer_log`, `habits`, `habit_log`, `settings`.
- Users: `services/userService.ts` `ensureUser()` upserts the Clerk id on first
  sync. `email`/`name` are NULL in the shipped Phase 1; **Phase 3 extends
  `ensureUser` to populate them from Clerk** (`clerkClient.users.getUser`) when
  the row is new or those columns are still null — captured server-side so it
  survives Apple's once-only name delivery. Columns stay nullable (Apple/Google
  may not always provide a name).
- Account delete: `routes/account.ts` → `services/accountService.ts` —
  `DELETE FROM users` (cascades) + `clerkClient.users.deleteUser`, 404 treated
  as success.
- Auth: `middleware/requireAuth.ts` using `getAuth()` from `@clerk/express`
  (paired with `clerkMiddleware()`). **[Note]** verification is via Clerk's
  Express SDK, not a hand-rolled JWKS check as the brainstorm sketched — same
  result, less code.
- Sync route: own `express.json({ limit: "1mb" })` (global stays 16KB, bypassed
  for `/api/sync` in `index.ts`); `syncLimiter` 120 / 15 min.

**Phase 2 — frontend auth (shipped):**
- `ClerkProvider` in `app/_layout.tsx`; `app/SignIn.tsx` (Apple + Google);
  `components/home/SignInCard.tsx` (dismissible "Sign in to sync").
- Adapters Phase 3 consumes: `services/auth/authToken.ts` (`getAuthToken()`),
  `hooks/useAuthState.ts`, `hooks/useAccountActions.ts`. `apiFetch` already
  attaches the Bearer token.

**Phase 3 — sync engine (shipped):** `frontend/services/sync/` is live.
Key implementation notes vs. the design:
- `ensureUser` in `userService.ts` now populates `email`/`name` from Clerk
  (`clerkClient.users.getUser`) when the row is new or those columns are null —
  captures the name server-side to survive Apple's once-only delivery.
- **Quran reading mode is out of scope on this branch** (no service exists for
  `quran:reading-mode` on `feat/auth`); it can be added in a follow-up.
- Settings stamping wires into **added change events** on theme, bookmarks,
  quran progress, ramadan tracker, and `writePrayerSettings` — services were not
  modified internally; the sync engine subscribes to the events they now emit.
- Feedback-loop guard: `isApplyingRemote()` in the sync engine gates both
  stamp-bumps and debounced re-syncs during `applyMerged`, preventing an
  apply→event→sync→apply ping-pong.
