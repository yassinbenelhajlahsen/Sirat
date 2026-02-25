# Frontend Testing Plan — React Native Islamic Utility App (Sirat)

> Goal: Establish reliable frontend test infrastructure and incrementally add high-value automated tests across core user flows (notifications + prayer times + Quran + permissions), prioritizing regression-prone logic.

## Current State

- Phases 0-13 are covered with automated tests.
- Coverage now includes:
  - service and hook correctness contracts
  - shared component UI contracts
  - screen-level UI contracts
  - navigation route/param contracts
  - integration-style user flows
- Remaining risk is mainly device/runtime-native behavior that unit/integration tests do not fully emulate (for example sensor accuracy, real permission UX, OEM notification behavior).

## Principles

- **Start with test infrastructure** so every subsequent suite is runnable in CI.
- Prefer **unit tests for pure logic** and **hook/component tests** for behavior + side effects.
- Make tests **deterministic**:
  - Freeze time (`Date.now`)
  - Fix timezone
  - Use fake timers for retries/backoff and scheduling
- Standardize mocks for:
  - Storage (AsyncStorage / wrapper)
  - Notifications scheduling API
  - Permissions
  - Network client
  - App lifecycle events (foreground/background)
- Treat tests as contracts for:
  - **Idempotency** (no duplicate schedules)
  - **Cache correctness**
  - **Permission state mapping**
  - **Event emission + hydration ordering**

---

## Phase 0 — Add Test Infrastructure (Required First)

### Deliverables
1. Install tooling:
   - Jest
   - React Native Testing Library
   - TS/Jest integration (`ts-jest` or Babel preset approach)
2. Add scripts to `frontend/package.json`:
   - `test`
   - `test:watch`
   - `test:ci` (coverage + CI-friendly settings)
3. Add configuration files:
   - `jest.config.*`
   - `jest.setup.*`
4. Add reusable mocks/helpers:
   - `__mocks__/AsyncStorage`
   - Notifications API mock (Expo Notifications or equivalent)
   - Permissions mock
   - Network mock (fetch/axios)
   - Time helpers (freeze now, set timezone)
5. Establish folder conventions:
   - `frontend/__tests__/...`
   - `frontend/test-utils/...`

### Acceptance Criteria
- `npm test` (or `yarn test`) runs successfully on a clean machine/CI.
- A simple smoke test passes.
- Fake timers and fixed-time helper verified.
- Coverage output produced in CI mode.

---

## Phase 1 — Notification Scheduling Lifecycle (Highest ROI)

### Targets
- `frontend/services/notificationService.ts`
- `frontend/services/notifications/scheduler.ts`
- `frontend/services/notifications/lifecycle.ts`
- `frontend/services/notifications/storage.ts`
- `frontend/services/notifications/permissions.ts`

### Test Scenarios
- Reschedule triggers:
  - app bootstrap
  - settings change
  - app foreground
- Fingerprint dedupe:
  - same schedule does not create duplicates
  - existing scheduled entries matched and reused/ignored correctly
- Permission denied behavior:
  - no scheduling occurs
  - correct storage flags/events updated
- Midnight rollover:
  - “today” schedule transitions safely to “tomorrow”
  - reschedule at boundary does not duplicate
- Cancel + rebuild flows:
  - cancel clears OS schedules and local storage
  - rebuild is idempotent
- Duplicate-notification prevention:
  - storage + OS scheduled list reconciliation

### Acceptance Criteria
- Tests cover all listed flows with deterministic time + mocks.
- Scheduling is proven idempotent (same inputs ⇒ same scheduled state).
- Permission-denied is proven safe (no schedules, correct state updates).

---

## Phase 2 — Prayer Times Retrieval + Caching (Core Correctness)

### Targets
- `frontend/services/prayerTimes.ts`
- `frontend/services/prayer-times/cacheStore.ts`
- `frontend/services/prayer-times/environment.ts`
- `frontend/services/prayer-times/apiClient.ts`
- `frontend/services/prayer-times/transformers.ts`

### Test Scenarios
- Cache hit paths:
  - memory cache hit
  - storage cache hit
  - network fetch + write-back
- Retrieval strategies:
  - “today fast path” vs yearly fallback
  - legacy month-by-month fallback behavior
- Parameter handling:
  - method/country/other params reflected in request
  - cache key incorporates relevant params correctly
- Transformer integrity:
  - stable mapping from API payload to internal model
  - date parsing correctness around timezone edges (if applicable)

### Acceptance Criteria
- Caching behaves correctly across memory/storage/network.
- No accidental cache poisoning across settings/method changes.
- Transformers validated with representative payload fixtures.

---

## Phase 3 — Home Prayer Feature Behavior (Hooks)

### Targets
- `frontend/hooks/useHomePrayerTimes.ts`
- `frontend/hooks/usePrayerTimes.ts`

### Test Scenarios
- Retry backoff:
  - increases delays as expected
  - stops after max attempts
  - uses fake timers, no real waiting
- Permission error classification:
  - denied vs undetermined vs “services off” (as applicable)
- Refresh triggers:
  - settings-change refresh
  - app-foreground refresh
- Next-day Fajr logic:
  - when no upcoming prayers remain, next shown is next day Fajr

### Acceptance Criteria
- Hook behavior validated without flaky timing.
- Refresh logic proven to trigger exactly once per event.
- Next-prayer logic is correct at day boundary.

---

## Phase 4 — Settings/Permission Sync on Bootstrap

### Targets
- `frontend/app/_layout.tsx`
- `frontend/hooks/useSettingsPermissions.ts`
- `frontend/hooks/usePrayerSettingsState.ts`

### Test Scenarios
- OS permission sync into storage:
  - correct `"1"` / `"0"` toggle behavior
  - permission revoked after previously granted
- Event emission:
  - `settingsChanged`
  - `NOTIF_PREFS_UPDATED`
- Hydration ordering:
  - settings loaded before downstream actions that depend on them
  - no duplicate emissions during hydration

### Acceptance Criteria
- Bootstrap ordering is enforced by tests.
- Storage + event system reflect OS permissions reliably.

---

## Phase 5 — Quran Data Preload Contract (Fast, Deterministic)

### Targets
- `frontend/services/quranData.ts`
- `frontend/app/_layout.tsx` (preload call site)

### Test Scenarios
- Preload-required guard:
  - throws (or returns explicit error) before preload
- Normalization integrity:
  - expected shape after preload
  - stable IDs, no missing critical fields
- Indexing correctness:
  - juz/surah indexing logic correct for sample fixtures
- Invalid asset-shape handling:
  - missing fields / malformed payload produces safe failure

### Acceptance Criteria
- Preload contract is enforced with clear failure behavior.
- Indexing correctness validated with fixtures.

---

## Phase 6 — Quran User State Persistence

### Targets
- `frontend/services/quranBookmarks.ts`
- `frontend/services/quranProgress.ts`
- `frontend/services/quranDisplayModes.ts`
- `frontend/hooks/useQuranDisplayModes.ts`

### Test Scenarios
- Sanitization:
  - invalid inputs safely rejected/coerced
- Dedupe/update semantics:
  - update existing bookmark/progress rather than duplicate
- Default-mode fallback:
  - missing/unknown mode falls back safely
- Event-driven cross-screen sync:
  - listeners update state without loops or duplication

### Acceptance Criteria
- Persistence is robust to corrupted storage.
- Cross-screen sync behavior is deterministic.

---

## Phase 7 — Dua Flow (Offline-first + Backend Fallback)

### Targets
- `frontend/services/duaService.ts`
- `frontend/services/duaMatcher.ts`
- `frontend/hooks/useDuaInteraction.ts`

### Test Scenarios
- Regex priority/order:
  - test fixture set proving precedence rules
- Offline fallback correctness:
  - local results returned when network unavailable
- Backend/network error mapping:
  - correct user-facing error classification
- Simulated delay timing:
  - uses fake timers; respects intended delay
- History cap/persistence:
  - capped list behavior
  - persistence + restore

### Acceptance Criteria
- Offline-first works reliably.
- History behavior remains bounded and stable.

---

## Phase 8 — Location-heavy Features (Later: Integration Complexity)

### 8A: Qibla/location permission flows
#### Targets
- `frontend/hooks/useQibla.ts`
- `frontend/app/(tabs)/Qibla.tsx`

#### Test Scenarios
- denied/undetermined UX branches
- location-services-off behavior
- happy path with mocked location + heading/orientation inputs

#### Acceptance Criteria
- Permission and services-off paths tested without real device APIs.

### 8B: Location-based mosque feature
#### Targets
- `frontend/services/getNearbyMosques.ts`
- `frontend/app/(tabs)/NearbyMosques.tsx`
- `frontend/app/MosqueMap.tsx`
- `frontend/hooks/useNearbyMosquesData.ts` (if introduced/refactored for screen data orchestration)

#### Test Scenarios
- permission gating
- query/caching
- empty/error/loading UI states
- cached-first render path (show cached list/map markers before live refresh resolves)
- pull-to-refresh/manual retry path after network failure
- map handoff contract (Nearby list -> full map route params remain stable)
- stale cache invalidation behavior (TTL or equivalent freshness rule)
- graceful fallback when location services are off but cached mosque data exists

#### Current Coverage Status
- Implemented:
  - service-level permission/fetch/error contracts (`getNearbyMosques`)
  - cache-keying/freshness invalidation contracts (`getNearbyMosques.cache`)
  - dedicated Nearby Mosques screen loading/empty/error/cached-first contracts
  - retry/refresh user flow coverage for failed permission path
  - basic map handoff route contract
  - list->map continuity flow contract for shared mosque marker continuity
  - location-services-off screen contract

#### Remaining Implementation Plan (Phase 8 Follow-up)
1. ✅ `__tests__/services/getNearbyMosques.cache.test.ts` for cache-keying and freshness invalidation rules.
2. ✅ `__tests__/screens/nearby-mosques.contract.test.tsx` for loading/empty/error/cached-first rendering.
3. ✅ `__tests__/flows/nearby-mosques-refresh.flow.test.tsx` for retry and refresh behavior after failures.
4. ✅ `__tests__/flows/nearby-list-to-map.flow.test.tsx` for route-param and marker continuity from list into `MosqueMap`.

#### Acceptance Criteria (Expanded)
- Permission, cache behavior, and UI state contracts are deterministic and isolated from real device/network APIs.
- Nearby mosques list/map flow is covered end-to-end through at least one refresh/retry cycle.
- Cache freshness rules are enforced by tests and fail loudly on regressions.

---

## Phase 9 — Holiday/Ramadan Calendar Data Integrity

### Targets
- `frontend/services/holidayService.ts`
- `frontend/services/ramadanTracker.ts`
- `frontend/hooks/useRamadanTracker.ts`
- `frontend/hooks/useCalendarData.ts`

### Test Scenarios
- Payload sanitization
- Date-key correctness
- Cache invalidation rules
- Missed-fast tracking persistence

### Acceptance Criteria
- Calendar integrity holds across edge dates and storage restores.

---

## UI Contract Expansion Plan (Completed)

### Why this plan
- Existing coverage is strong for services and hooks, but users experience the app through screens and navigation.
- UI contract tests should verify:
  - critical text/actions are rendered
  - primary interactions invoke the right side effects
  - navigation boundaries and route params work as expected
  - key empty/loading/error states remain stable

---

## Phase 10 — Shared Component Contracts

### Targets
- `frontend/components/DuaCard.tsx`
- `frontend/components/DuaResultCard.tsx`
- `frontend/components/PrayerTimesList.tsx`
- `frontend/components/NotificationSettings.tsx`
- `frontend/components/CitySearchModal.tsx`
- `frontend/components/quran/*` (highest-use cards/modals first)

### Test Scenarios
- Renders required content from props (labels, values, accessibility text).
- Fires callback contracts on press/toggle/select events.
- Handles empty/null props safely (no crash, expected fallback UI).
- Honors key conditional rendering branches (loading/disabled/hidden states).

### Acceptance Criteria
- Shared components have stable contract tests for primary props/events.
- No snapshots unless the UI is intentionally static and meaningful.

---

## Phase 11 — Screen-Level Contract Tests (Tabs + Key Routes)

### Targets
- `frontend/app/(tabs)/index.tsx` (Home)
- `frontend/app/(tabs)/Settings.tsx`
- `frontend/app/(tabs)/Quran.tsx`
- `frontend/app/(tabs)/Calendar.tsx`
- `frontend/app/(tabs)/Mosques.tsx`
- `frontend/app/(tabs)/Qibla.tsx`
- `frontend/app/MosqueMap.tsx`
- `frontend/app/[date].tsx` (priority branches only)

### Test Scenarios
- Screen boot path renders expected loading/default UI.
- Screen reacts to mocked hook/service outputs (success, empty, error).
- Primary CTAs are wired (retry/open settings/open map/open modal/etc.).
- Cross-screen event updates are reflected where applicable (settings/notif/quran display events).

### Acceptance Criteria
- Each core screen has at least one happy-path and one failure/empty-state contract test.
- High-risk screens (Home/Settings/Quran/Calendar) cover primary interaction loops.

---

## Phase 12 — Navigation Contracts

### Targets
- `frontend/app/(tabs)/_layout.tsx`
- `frontend/app/_layout.tsx`
- Route links/pushes between tabs and stack routes (`MosqueMap`, date route, etc.)

### Test Scenarios
- Initial route and tab availability are correct.
- Route params are passed and read correctly.
- Navigation actions (push/replace/back) trigger the expected destination and state.
- Deep-link-like path resolution for critical routes does not regress.

### Acceptance Criteria
- Navigation graph contracts are validated with integration-style tests.
- Route param regressions are caught by automated tests.

---

## Phase 13 — End-to-End-Like User Flows (In-App Integration)

### Targets
- High-value user journeys spanning multiple hooks/services/screens:
  - Home prayer-times load -> settings change -> refreshed prayer times
  - Dua request -> result render -> history update
  - Quran display mode change -> reflected on Quran screen
  - Calendar Ramadan missed-fast toggle -> summary updates
  - Mosques permission -> results/list-map handoff

### Test Scenarios
- Render screen/container with realistic mocks and simulate user interactions.
- Assert state transitions across UI + mocked service boundaries.
- Validate loading -> success/error transitions for each flow.
- Ensure expected persistent side effects occur (storage/event emission).

### Acceptance Criteria
- At least one integration flow test per critical feature cluster.
- Flows are deterministic (fake timers/frozen time where needed) and CI-safe.

---

## Test Conventions & Utilities

### Conventions
- Prefer:
  - Unit tests for services/transformers/utility modules
  - Hook tests for behavior + side effects
- Avoid snapshot tests unless UI is stable and meaningful.
- Keep tests isolated:
  - reset mocks between tests
  - no reliance on global mutable state

### Utilities to Create
- `freezeTime(isoString)` / `advanceTime(ms)`
- `setTimezone("America/New_York")` (or consistent deterministic TZ in test env)
- `mockStorage()` with easy seed + inspect helpers
- `mockNotifications()` with inspectable scheduled list
- `mockPermissions()` with per-test state
- `mockNetwork()` with success/failure/timeout helpers

---

## CI Checklist

- Run `test:ci` on every PR.
- Enforce:
  - deterministic timezone
  - coverage artifact output
- Optional:
  - minimum coverage thresholds once baseline is established

---

## Coverage Gap Burn-down Plan (Post-Phase 13)

### Why this section
- Latest coverage run (49 suites / 184 tests) shows strong service-level confidence but lower UI/runtime coverage in Qibla screen contracts, settings permission hook behavior, theme context hydration, and calendar view-state hooks.
- This section tracks the next improvements needed to reduce uncovered high-risk UI logic.

---

## Phase 14 — Qibla Screen + Permission Hook Contracts

### Targets
- `frontend/app/(tabs)/Qibla.tsx`
- `frontend/hooks/useSettingsPermissions.ts`

### Test Scenarios
- Qibla gate rendering:
  - services-off state
  - denied permission state
  - undetermined state
- Qibla runtime rendering:
  - loading state when direction is pending
  - error card branch when compass/location error is present
  - aligned/adjusting status-pill branch
- Settings permission hook:
  - bootstrap status refresh maps permission + notification state correctly
  - active-app refresh path re-checks and synchronizes `useLocation`
  - toggle flow: services off, permission denied, and granted branches

### Acceptance Criteria
- Qibla screen coverage includes both location-gate and active-compass UI branches.
- `useSettingsPermissions` coverage includes bootstrap, app-state refresh, and toggle error/success paths.

---

## Phase 15 — Theme + Calendar View-State Determinism

### Targets
- `frontend/context/ThemeContext.tsx`
- `frontend/hooks/useCalendarViewState.ts`

### Test Scenarios
- Theme context:
  - hydrate from stored value
  - invalid stored value fallback
  - persistence path on `setTheme`
  - `useTheme` outside provider throws contract error
- Calendar view-state:
  - month/year parameter parsing
  - prev/next boundary guards vs min/max allowed dates
  - visible matrix trimming removes trailing all-zero weeks
  - day-button sizing branch (`isSmall`)

### Acceptance Criteria
- Theme context no longer remains untested.
- Calendar view-state hook has deterministic matrix/navigation assertions.

---

## Phase 16 — Quran Navigator/Modal Component Contracts

### Targets
- `frontend/components/quran/NavigatorModal.tsx`
- `frontend/components/quran/NavigatorTabs.tsx`
- `frontend/components/quran/QuranDisplaySettingsModal.tsx`

### Test Scenarios
- Renders expected controls/text for each active tab.
- Tab switching invokes parent callbacks.
- Display settings modal toggles invoke expected callbacks.
- Hidden/closed modal state renders safely with no interactive leakage.

### Acceptance Criteria
- At least one contract test exists for each listed Quran navigator/modal component.
- Coverage improves across current `0%` Quran navigator/modal files.

---
