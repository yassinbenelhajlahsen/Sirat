# Minimum Version Gate — Implementation Plan

## 1. Backend Contract & Gate

### 1.1 Environment Config
Add the following variables to `backend/src/config/env.ts`:

```
MIN_SUPPORTED_APP_VERSION=1.0.10
ENFORCE_MIN_VERSION=true|false
IOS_APP_STORE_URL=<url>
ANDROID_PLAY_STORE_URL=<url>
```

### 1.2 Middleware
Create `backend/src/middleware/minVersionGate.ts` that:
- Reads `x-sirat-app-version` and `x-sirat-platform` from request headers
- Compares the incoming version against `MIN_SUPPORTED_APP_VERSION`
- Returns `426 Upgrade Required` with a structured payload when the version is too old

### 1.3 426 Response Shape
Use this strict shape for all 426 responses:

```json
{
  "error": {
    "code": "APP_UPDATE_REQUIRED",
    "minVersion": "<string>",
    "currentVersion": "<string>",
    "storeUrl": "<string>",
    "retriable": false
  }
}
```

### 1.4 Register Middleware
Register the middleware in `backend/src/index.ts` **before** API routes (line 29), and exempt:
- `/` (root)
- `*/health` (so ops/health checks continue to work)

### 1.5 Proactive Version Check Endpoint
Add a lightweight endpoint (e.g. `GET /api/app/version`) so the frontend can proactively check version compatibility on startup and foreground resume — not only after a feature call fails.

---

## 2. Frontend Request Metadata

### 2.1 Client-Info Utility
Create `frontend/services/appVersion.ts` to attach version headers to every backend request.

Source the version from native/runtime using:
- `Updates.runtimeVersion` (primary)
- Fallback to package version

Send the following headers on every request:
- `x-sirat-app-version`
- `x-sirat-platform`
- `x-sirat-app-ownership`

### 2.2 Shared API Wrapper
Introduce a shared API wrapper so all callers stop duplicating raw `fetch`/`axios` calls. Update the following files to use the wrapper:
- `frontend/services/duaService.ts` (line 130)
- `frontend/services/prayerTimes.ts` (line 144)
- `frontend/services/holidayService.ts` (line 121)
- `frontend/services/getNearbyMosques.ts` (line 31)

---

## 3. Frontend Force-Update UX

### 3.1 Full-Screen Gate
Add a global, non-dismissible full-screen gate in `frontend/app/_layout.tsx` at the same layer where the splash/overlay is already controlled (line 265).

### 3.2 Version Check Trigger
On startup and foreground resume (using the existing `AppState` flow around line 229 of `frontend/app/_layout.tsx`), call the backend version-check endpoint.

### 3.3 Gate Behaviour
If the backend returns `update required` (or any API call returns `426`), display the gate with:
- "Update Required" messaging
- Current version and minimum required version
- An "Update Now" button that opens the `storeUrl` from the backend response

Block all interaction with app content while the gate is visible.

---

## 4. Rollout Strategy

> **Important:** Follow this order to avoid accidental lockout of existing users.

1. **Deploy backend in monitor mode** — set `ENFORCE_MIN_VERSION=false` and log incoming `x-sirat-app-version` values for ~24 hours to understand the version distribution.
2. **Ship frontend update** — the update that sends version headers and handles `426` responses gracefully.
3. **Enable enforcement** — flip backend to `ENFORCE_MIN_VERSION=true` with `MIN_SUPPORTED_APP_VERSION=1.0.10`.

---

## 5. Tests & Validation

### 5.1 Backend Tests
- Add middleware unit tests covering: pass (valid version), fail (outdated version), and missing header cases
- Verify the `426` payload shape matches the contract
- Update `backend/__tests__/env.test.ts` to cover the new environment variables

### 5.2 Frontend Validation
- App version `1.0.10` on launch/resume → passes through normally
- Older build → receives hard block with store button displayed
- Offline on startup → does not deadlock (handle gracefully)

### 5.3 Manual Checks
- Expo Go in dev → bypass enforcement
- Production standalone build → enforcement active

---

## Key Caveat

Old clients that predate the version-header code will send requests **with no version header**. You must decide upfront how to handle missing headers:

- **Treat missing header as outdated** → enforcement is immediate and hard (recommended for forced updates)
- **Treat missing header as allowed** → old clients pass through until they update

If you choose the first option, enforcement kicks in as soon as `ENFORCE_MIN_VERSION=true` is set, even for clients that never received the new header code.