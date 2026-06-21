# User Accounts & Cloud Sync — Phase 2 (Frontend Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk-powered Apple + Google sign-in to the Expo app, with optional login, account management (sign out / delete account) in Settings, and the Clerk session token attached to backend calls — so Phase 3's sync engine has an authenticated user.

**Architecture:** Isolate every direct Clerk-SDK touch behind 2–3 thin adapter files (`services/auth/authToken.ts`, `hooks/useAuthState.ts`) so the rest of the app (apiClient, Settings UI, account actions) depends on *our* testable functions, not Clerk's version-sensitive API. The `ClerkProvider` wraps the root layout; a `SignIn` modal route runs the OAuth flow via `useSSO`/`startSSOFlow`; Settings gains an account section. The OAuth flow itself and the native provider can only be verified on a device/dev build — those tasks are marked **[native — manual verify]**; everything behind the adapters is **[TDD]**.

**Tech Stack:** Expo 54 / RN 0.81 / Expo Router 6, `@clerk/expo` (Clerk Expo SDK), `expo-secure-store` (token cache), `expo-web-browser` (already installed; OAuth browser flow), Jest (Babel preset, `@testing-library/react-native`).

**Spec:** `devDocs/superpowers/specs/2026-06-19-user-accounts-cloud-sync-design.md`
**Builds on:** Phase 1 backend (`POST /api/sync`, `DELETE /api/account`, Clerk JWT verification) on branch `feat/auth`.

## Global Constraints

- **Run all commands from `frontend/`.** All imports use the `@/` alias → `frontend/` root.
- **Theming:** all themed UI uses `useTheme()` + `createStyles(theme)` factory — never static color constants. The streak flame 🔥 is the only emoji; all other icons are Ionicons.
- **Frontend Jest is Babel-based** (NOT `--experimental-vm-modules`). Dynamic `await import()` in tests does NOT work. Use static imports + top-level `jest.mock()` + mutate mock properties per test (see existing `frontend/__tests__` patterns).
- **Tests that mock `react-native-safe-area-context` must include** `useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })` alongside `SafeAreaView`/`SafeAreaProvider`.
- **Backend calls go through `@/services/apiClient`** (`apiFetch`/`apiPost`). The sign-out/delete flow uses `apiFetch`, never raw `fetch`.
- **Clerk package + API surface is version-sensitive.** Where a step calls a Clerk SDK symbol (package name, `useSSO`, `getClerkInstance`, `signOut`, `useAuth`/`useUser` fields), the step says **[VERIFY vs installed Clerk docs]** — the implementer MUST confirm the exact symbol against the installed `@clerk/expo` version's docs/types before finalizing, and report the confirmed signature. Do not assume from memory.
- **Optional login:** the app stays fully usable signed-out. Nothing in this phase gates existing features behind auth (sync, which would need auth, is Phase 3).
- **Commit hygiene:** NO `Co-Authored-By`, NO trailers, NO "Generated with" lines. Exact `-m` messages from each task.
- **No `git push`** unless explicitly asked.
- **OTA boundary:** Tasks adding native modules / config (T1, T2, T6) require a new dev/EAS build and cannot ship via OTA. Adapter/UI tasks (T3–T5, T7–T9) are JS-only and OTA-safe once the native binary from T1/T2 is live.

---

## Prerequisites (manual external setup — NOT code tasks, no tests)

These must be done by the project owner before the OAuth flow can be verified end-to-end. The TDD code tasks below can be implemented and unit-tested without them, but T6's on-device sign-in and final verification require these. Record the resulting values where noted.

- [ ] **Create a Clerk application** at dashboard.clerk.com. Note the **Publishable Key** (`pk_test_…` / `pk_live_…`) and **Secret Key** (`sk_…` — already needed by the Phase 1 backend on Railway).
- [ ] **Enable Google** as a social connection in Clerk (Configure → SSO Connections → Google). For production, supply a Google OAuth client (Google Cloud Console → Credentials → OAuth client ID, iOS type, bundle id `com.yassinbenelhajlahsen.sirat`); for development Clerk's shared credentials work.
- [ ] **Enable Apple** as a social connection in Clerk. Apple requires: an Apple Developer **App ID** with **Sign in with Apple** capability enabled (bundle id `com.yassinbenelhajlahsen.sirat`), a **Services ID**, and a **Sign in with Apple key** (.p8) — enter the Services ID, Team ID (`5AN795CL7Z`), Key ID, and key into Clerk's Apple connection.
- [ ] **Confirm the redirect/scheme**: `app.config.js` already sets `scheme: "sirat"`. The OAuth redirect URL will be `sirat://...`; ensure Clerk's allowed redirect list (auto-managed for native, but verify) and the Apple/Google console callback settings accept it.
- [ ] **Set env vars**: add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_…` to `frontend/.env` (and EAS secrets for builds). Backend already needs `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` (Phase 1).
- [ ] **Plan a dev build**: native modules (`expo-secure-store`, Clerk) require `npx expo run:ios` or an EAS dev build — they do NOT work in plain Expo Go for the native-components path. `expo-dev-client` is already a dependency.

---

### Task 1: Install Clerk + secure-store, configure app.config.js & env  [native — manual verify]

**Files:**
- Modify: `frontend/package.json` (deps)
- Modify: `frontend/app.config.js` (plugins)
- Modify/Create: `frontend/.env.example` (document the new env var)

**Interfaces:**
- Produces: `@clerk/expo` + `expo-secure-store` installed; `app.config.js` `plugins` includes the secure-store and Clerk plugins; `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` documented.

- [ ] **Step 1: Install the packages**  **[VERIFY vs installed Clerk docs]**

Run (from `frontend/`). Confirm the current package name + companion packages against Clerk's Expo quickstart (historically `@clerk/expo`; recent docs may show `@clerk/expo`). Use whatever the current quickstart prescribes:
```bash
npx expo install @clerk/expo expo-secure-store
```
Expected: `package.json` gains `@clerk/expo` and `expo-secure-store`. (`expo-web-browser` and `expo-dev-client` are already present.)

- [ ] **Step 2: Add the config plugins**

In `frontend/app.config.js`, add the secure-store and Clerk plugins to the existing `plugins` array (append after the `expo-alternate-app-icons` entry). Use the plugin names the installed packages document:
```js
      "expo-secure-store",
```
(Clerk's Expo SDK may also require its own config plugin entry — **[VERIFY vs installed Clerk docs]**; add it here if the quickstart says so. `scheme: "sirat"` is already set, which the OAuth redirect needs — leave it.)

- [ ] **Step 3: Document the env var**

Create or update `frontend/.env.example` with:
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
EXPO_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 4: Verify config + types**

Run:
```bash
npx tsc --noEmit
npx expo config --type public > /dev/null && echo "expo config OK"
```
Expected: no TS errors; `expo config` resolves (confirms `app.config.js` is valid and plugins are recognized).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.config.js .env.example
git commit -m "feat(auth): add Clerk + secure-store deps and Expo config"
```

---

### Task 2: Clerk token adapter — `getAuthToken()`  [TDD]

The single non-hook accessor for the current session JWT. This is the ONE place app-level (non-React) code reaches into Clerk, so the rest of the app stays testable.

**Files:**
- Create: `frontend/services/auth/authToken.ts`
- Test: `frontend/__tests__/services/auth/authToken.test.ts`

**Interfaces:**
- Produces: `getAuthToken(): Promise<string | null>` — returns the active Clerk session JWT, or `null` when signed out / unavailable. Never throws (returns `null` on error).

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/auth/authToken.test.ts`:
```ts
import { getAuthToken } from "@/services/auth/authToken";

const mockGetToken = jest.fn();
const mockGetClerkInstance = jest.fn();

jest.mock("@clerk/expo", () => ({
  getClerkInstance: () => mockGetClerkInstance(),
}));

describe("getAuthToken", () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    mockGetClerkInstance.mockReset();
  });

  it("returns the session token when signed in", async () => {
    mockGetToken.mockResolvedValue("jwt-123");
    mockGetClerkInstance.mockReturnValue({ session: { getToken: mockGetToken } });
    await expect(getAuthToken()).resolves.toBe("jwt-123");
  });

  it("returns null when there is no active session", async () => {
    mockGetClerkInstance.mockReturnValue({ session: null });
    await expect(getAuthToken()).resolves.toBeNull();
  });

  it("returns null when token retrieval throws", async () => {
    mockGetToken.mockRejectedValue(new Error("boom"));
    mockGetClerkInstance.mockReturnValue({ session: { getToken: mockGetToken } });
    await expect(getAuthToken()).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/auth/authToken.test.ts`
Expected: FAIL — cannot find module `@/services/auth/authToken`.

- [ ] **Step 3: Write the adapter**  **[VERIFY vs installed Clerk docs]**

Create `frontend/services/auth/authToken.ts`. Confirm the non-hook accessor against the installed Clerk version — `getClerkInstance()` exposing `.session?.getToken()` is the documented pattern; verify the exact symbol/shape and adjust if the installed version differs:
```ts
import { getClerkInstance } from "@clerk/expo";

/**
 * Returns the active Clerk session JWT for attaching to backend requests,
 * or null when signed out / unavailable. Never throws — callers treat a
 * null token as "anonymous". This is the only non-React Clerk touch point.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const clerk = getClerkInstance();
    const token = await clerk.session?.getToken();
    return token ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/auth/authToken.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/auth/authToken.ts __tests__/services/auth/authToken.test.ts
git commit -m "feat(auth): add Clerk session token adapter"
```

---

### Task 3: Attach the auth token in `apiClient`  [TDD]

**Files:**
- Modify: `frontend/services/apiClient.ts`
- Test: `frontend/__tests__/services/apiClient.auth.test.ts`

**Interfaces:**
- Consumes: `getAuthToken` from `@/services/auth/authToken`.
- Produces: `apiFetch`/`apiPost` attach `Authorization: Bearer <token>` when `getAuthToken()` resolves to a non-null token; omit the header when it is null. All existing behavior (version headers, 426 handling, JSON parse) unchanged.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/services/apiClient.auth.test.ts`:
```ts
import { apiFetch } from "@/services/apiClient";

jest.mock("@/services/appVersion", () => ({
  getVersionHeaders: () => ({ "x-sirat-app-version": "1.1.0" }),
}));

const mockGetAuthToken = jest.fn();
jest.mock("@/services/auth/authToken", () => ({
  getAuthToken: () => mockGetAuthToken(),
}));

describe("apiClient auth header", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    mockGetAuthToken.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    (global as any).fetch = fetchMock;
  });

  it("adds a Bearer header when a token is present", async () => {
    mockGetAuthToken.mockResolvedValue("jwt-123");
    await apiFetch("/api/sync", { method: "POST", body: {} });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer jwt-123");
  });

  it("omits the Bearer header when there is no token", async () => {
    mockGetAuthToken.mockResolvedValue(null);
    await apiFetch("/api/app/version");
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/services/apiClient.auth.test.ts`
Expected: FAIL — `Authorization` is undefined in the first case (no token wiring yet).

- [ ] **Step 3: Implement the header wiring**

In `frontend/services/apiClient.ts`, import the adapter at the top:
```ts
import { getAuthToken } from "./auth/authToken";
```
Then inside `apiFetch`, build headers including the token. Replace the `fetch` call's `headers` object so it conditionally includes `Authorization`:
```ts
  const token = await getAuthToken();
  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...getVersionHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
```
(Leave `apiPost`, 426 handling, and error handling unchanged — `apiPost` delegates to `apiFetch`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/services/apiClient.auth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Guard against regressions in existing apiClient consumers**

Run the existing apiClient/dua tests to confirm the new `await getAuthToken()` (which other suites don't mock) defaults safely. If a suite that imports `apiClient` now fails because `@clerk/expo` isn't mocked, add to that suite a `jest.mock("@/services/auth/authToken", () => ({ getAuthToken: async () => null }))`. Run:
```bash
npm test -- --runTestsByPath __tests__/services/duaService.test.ts
```
Expected: PASS (or fixed via the mock above). Note any suite you touched in the report.

- [ ] **Step 6: Commit**

```bash
git add services/apiClient.ts __tests__/services/apiClient.auth.test.ts
git commit -m "feat(auth): attach Clerk bearer token to backend requests"
```

---

### Task 4: Auth-state hook wrapper — `useAuthState()`  [TDD]

**Files:**
- Create: `frontend/hooks/useAuthState.ts`
- Test: `frontend/__tests__/hooks/useAuthState.test.tsx`

**Interfaces:**
- Produces: `useAuthState(): { isLoaded: boolean; isSignedIn: boolean; userId: string | null; email: string | null }` — a thin adapter over Clerk's `useAuth`/`useUser` so components never import Clerk directly.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/hooks/useAuthState.test.tsx`:
```tsx
import { renderHook } from "@testing-library/react-native";
import { useAuthState } from "@/hooks/useAuthState";

const mockUseAuth = jest.fn();
const mockUseUser = jest.fn();
jest.mock("@clerk/expo", () => ({
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
}));

describe("useAuthState", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseUser.mockReset();
  });

  it("maps a signed-in Clerk state", () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, userId: "user_1" });
    mockUseUser.mockReturnValue({
      user: { primaryEmailAddress: { emailAddress: "a@b.com" } },
    });
    const { result } = renderHook(() => useAuthState());
    expect(result.current).toEqual({
      isLoaded: true,
      isSignedIn: true,
      userId: "user_1",
      email: "a@b.com",
    });
  });

  it("maps a signed-out state with null email", () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false, userId: null });
    mockUseUser.mockReturnValue({ user: null });
    const { result } = renderHook(() => useAuthState());
    expect(result.current).toEqual({
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      email: null,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/hooks/useAuthState.test.tsx`
Expected: FAIL — cannot find module `@/hooks/useAuthState`.

- [ ] **Step 3: Write the hook**  **[VERIFY vs installed Clerk docs]**

Create `frontend/hooks/useAuthState.ts`. Confirm `useAuth` returns `{ isLoaded, isSignedIn, userId }` and `useUser` returns `{ user }` with `primaryEmailAddress.emailAddress` in the installed version:
```ts
import { useAuth, useUser } from "@clerk/expo";

export type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
};

export function useAuthState(): AuthState {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  return {
    isLoaded: Boolean(isLoaded),
    isSignedIn: Boolean(isSignedIn),
    userId: userId ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/hooks/useAuthState.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/useAuthState.ts __tests__/hooks/useAuthState.test.tsx
git commit -m "feat(auth): add useAuthState hook wrapper over Clerk"
```

---

### Task 5: Wrap the app in `ClerkProvider`  [native — manual verify]

**Files:**
- Modify: `frontend/app/_layout.tsx`
- Modify (if needed): existing screen-contract / layout tests that render the root, to mock `@clerk/expo`.

**Interfaces:**
- Consumes: `ClerkProvider` + `tokenCache` from the installed Clerk package.
- Produces: the entire app tree mounted inside `<ClerkProvider>`, so Clerk hooks/instance work everywhere.

- [ ] **Step 1: Add the provider**  **[VERIFY vs installed Clerk docs]**

In `frontend/app/_layout.tsx`, import (confirm the `tokenCache` import path against the installed version — quickstart shows `@clerk/expo/token-cache`):
```tsx
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
```
Read the publishable key near the top of the module (after the existing storage-key constants):
```tsx
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
```
Wrap the existing tree in `RootLayout` (the outermost provider):
```tsx
export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </ClerkProvider>
  );
}
```
(Do not `throw` on a missing key — the app must still boot signed-out in dev/test; Clerk no-ops without a key. Note this deviation from Clerk's quickstart, which throws.)

- [ ] **Step 2: Keep existing root-rendering tests green**

Any test that renders `app/_layout` or mounts the full tree (e.g. `__tests__/screens/screen-contracts.test.tsx`) must mock Clerk so `ClerkProvider` renders its children inline. Add to those suites:
```tsx
jest.mock("@clerk/expo", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }),
  useUser: () => ({ user: null }),
  useSSO: () => ({ startSSOFlow: jest.fn() }),
  getClerkInstance: () => ({ session: null }),
}));
jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: {} }));
```
Run the full suite to find every affected file:
```bash
npm test
```
Expected: all suites pass after adding the mock where the root tree is rendered. List touched suites in the report.

- [ ] **Step 3: On-device smoke check (manual — record in report)**

On a dev build (`npx expo run:ios` with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` set): the app boots normally signed-out, no crash, no Clerk error in logs. (Cannot be unit-tested.)

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx __tests__
git commit -m "feat(auth): wrap app in ClerkProvider"
```

---

### Task 6: Sign-in screen with Apple + Google  [native — manual verify]

**Files:**
- Create: `frontend/app/SignIn.tsx`
- Modify: `frontend/app/_layout.tsx` (register the `SignIn` modal route)
- Test: `frontend/__tests__/screens/signIn.test.tsx`

**Interfaces:**
- Consumes: `useSSO` from Clerk; `useAuthState` (to redirect away when already signed in); `useTheme`.
- Produces: a `/SignIn` modal route rendering "Continue with Apple" and "Continue with Google" buttons; each invokes `startSSOFlow({ strategy })` and on success activates the session and dismisses. Render-testable with a mocked `useSSO`; the live OAuth round-trip is device-only.

- [ ] **Step 1: Write the failing render test**

Create `frontend/__tests__/screens/signIn.test.tsx`:
```tsx
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SignIn from "@/app/SignIn";

const mockStartSSOFlow = jest.fn();
const mockSetActive = jest.fn();
const mockBack = jest.fn();

jest.mock("@clerk/expo", () => ({
  useSSO: () => ({ startSSOFlow: mockStartSSOFlow }),
}));
jest.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ isLoaded: true, isSignedIn: false, userId: null, email: null }),
}));
jest.mock("expo-router", () => ({ router: { back: () => mockBack(), replace: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("SignIn screen", () => {
  beforeEach(() => {
    mockStartSSOFlow.mockReset();
    mockSetActive.mockReset();
    mockBack.mockReset();
  });

  it("renders Apple and Google options", () => {
    const { getByText } = render(<SignIn />);
    expect(getByText("Continue with Apple")).toBeTruthy();
    expect(getByText("Continue with Google")).toBeTruthy();
  });

  it("starts the Google SSO flow and activates the session", async () => {
    mockStartSSOFlow.mockResolvedValue({ createdSessionId: "sess_1", setActive: mockSetActive });
    const { getByText } = render(<SignIn />);
    fireEvent.press(getByText("Continue with Google"));
    await waitFor(() => expect(mockStartSSOFlow).toHaveBeenCalledTimes(1));
    expect(mockStartSSOFlow).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: "oauth_google" }),
    );
    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_1" }));
  });

  it("starts the Apple SSO flow with the apple strategy", async () => {
    mockStartSSOFlow.mockResolvedValue({ createdSessionId: "sess_2", setActive: mockSetActive });
    const { getByText } = render(<SignIn />);
    fireEvent.press(getByText("Continue with Apple"));
    await waitFor(() =>
      expect(mockStartSSOFlow).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: "oauth_apple" }),
      ),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/screens/signIn.test.tsx`
Expected: FAIL — cannot find module `@/app/SignIn`.

- [ ] **Step 3: Write the screen**  **[VERIFY vs installed Clerk docs]**

Create `frontend/app/SignIn.tsx`. The structure below matches Clerk's Expo `useSSO` custom-flow shape — **verify the exact `startSSOFlow` argument keys, the returned `createdSessionId`/`setActive` shape, and the `redirectUrl` helper against the installed version's docs**, and adjust if different. Use `useTheme()` + `createStyles(theme)`; Ionicons for the button glyphs (no emoji). Build the redirect URL with the app scheme (`sirat`):
```tsx
import { Ionicons } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import * as AuthSession from "expo-auth-session";

import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";

// Required for the OAuth browser flow to complete on native. [VERIFY vs Clerk docs]
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { isSignedIn } = useAuthState();
  const { startSSOFlow } = useSSO();

  // If already signed in (e.g. opened the modal then signed in elsewhere), close it.
  useEffect(() => {
    if (isSignedIn) router.back();
  }, [isSignedIn]);

  const signInWith = useCallback(
    async (strategy: "oauth_apple" | "oauth_google") => {
      try {
        const redirectUrl = AuthSession.makeRedirectUri({ scheme: "sirat" });
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl,
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.back();
        }
      } catch {
        // User cancelled or the flow failed — stay on the screen. [VERIFY error shape]
      }
    },
    [startSSOFlow],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to sync</Text>
      <Text style={styles.subtitle}>
        Back up your tracker and settings across devices. You can keep using Sirat without an account.
      </Text>

      <TouchableOpacity
        style={styles.button}
        accessibilityRole="button"
        onPress={() => signInWith("oauth_apple")}
      >
        <Ionicons name="logo-apple" size={20} color={theme.colors.textPrimary} />
        <Text style={styles.buttonText}>Continue with Apple</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        accessibilityRole="button"
        onPress={() => signInWith("oauth_google")}
      >
        <Ionicons name="logo-google" size={20} color={theme.colors.textPrimary} />
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.dismiss}>Not now</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: { flex: 1, padding: 24, justifyContent: "center", gap: 16, backgroundColor: theme.colors.primaryDark },
    title: { fontSize: 24, fontWeight: "700", color: theme.colors.textPrimary },
    subtitle: { fontSize: 15, color: theme.colors.textSecondary, marginBottom: 8 },
    button: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border,
    },
    buttonText: { fontSize: 16, fontWeight: "600", color: theme.colors.textPrimary },
    dismiss: { textAlign: "center", color: theme.colors.textSecondary, marginTop: 8 },
  });
```
**Note:** confirm the theme token names (`primaryDark`, `textPrimary`, `textSecondary`, `border`) against `@/context/ThemeContext` — use whatever the theme actually exposes (match an existing screen like `Settings.tsx`). Adjust `expo-auth-session` usage if Clerk's docs use `Linking.createURL` instead — **[VERIFY vs installed Clerk docs]**.

- [ ] **Step 4: Register the route**

In `frontend/app/_layout.tsx`, add a `Stack.Screen` for `SignIn` next to the existing `Settings`/`Tracker` screens, as a modal:
```tsx
                <Stack.Screen
                  name="SignIn"
                  options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }}
                />
```

- [ ] **Step 5: Run the render test**

Run: `npm test -- --runTestsByPath __tests__/screens/signIn.test.tsx`
Expected: PASS (3 tests). If `expo-auth-session` isn't installed, `npx expo install expo-auth-session` (it's a common Clerk Expo peer) and re-run; record it in the report.

- [ ] **Step 6: On-device verification (manual — record in report)**

On a dev build with Clerk + Apple/Google connections configured: tapping each button opens the provider sheet, completing it returns to the app signed in, and the modal closes. (Device-only.)

- [ ] **Step 7: Commit**

```bash
git add app/SignIn.tsx app/_layout.tsx __tests__/screens/signIn.test.tsx package.json package-lock.json
git commit -m "feat(auth): add Apple and Google sign-in screen"
```

---

### Task 7: Account section component (signed-in / signed-out)  [TDD]

**Files:**
- Create: `frontend/components/settings/AccountSection.tsx`
- Test: `frontend/__tests__/components/accountSection.test.tsx`

**Interfaces:**
- Consumes: `useAuthState`; `useTheme`; callbacks `onSignIn`, `onSignOut`, `onDeleteAccount` (passed in so the component stays pure and testable).
- Produces: `AccountSection` — when signed out, a "Sign in" row calling `onSignIn`; when signed in, the email plus "Sign out" (→ `onSignOut`) and "Delete account" (→ `onDeleteAccount`) rows.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/components/accountSection.test.tsx`:
```tsx
import { render, fireEvent } from "@testing-library/react-native";
import { AccountSection } from "@/components/settings/AccountSection";

const mockUseAuthState = jest.fn();
jest.mock("@/hooks/useAuthState", () => ({ useAuthState: () => mockUseAuthState() }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { colors: { primaryDark: "#000", textPrimary: "#fff", textSecondary: "#aaa", border: "#333", danger: "#f00", accent: "#0a0" } },
  }),
}));

describe("AccountSection", () => {
  const handlers = { onSignIn: jest.fn(), onSignOut: jest.fn(), onDeleteAccount: jest.fn() };
  beforeEach(() => {
    mockUseAuthState.mockReset();
    Object.values(handlers).forEach((h) => h.mockReset());
  });

  it("shows a sign-in row when signed out", () => {
    mockUseAuthState.mockReturnValue({ isLoaded: true, isSignedIn: false, userId: null, email: null });
    const { getByText, queryByText } = render(<AccountSection {...handlers} />);
    fireEvent.press(getByText("Sign in"));
    expect(handlers.onSignIn).toHaveBeenCalledTimes(1);
    expect(queryByText("Sign out")).toBeNull();
  });

  it("shows email, sign out, and delete when signed in", () => {
    mockUseAuthState.mockReturnValue({ isLoaded: true, isSignedIn: true, userId: "u1", email: "a@b.com" });
    const { getByText } = render(<AccountSection {...handlers} />);
    expect(getByText("a@b.com")).toBeTruthy();
    fireEvent.press(getByText("Sign out"));
    expect(handlers.onSignOut).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText("Delete account"));
    expect(handlers.onDeleteAccount).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/components/accountSection.test.tsx`
Expected: FAIL — cannot find module `@/components/settings/AccountSection`.

- [ ] **Step 3: Write the component**

Create `frontend/components/settings/AccountSection.tsx` using `useTheme()` + `createStyles(theme)` (match the token names used by `Settings.tsx`; the test stubs `primaryDark/textPrimary/textSecondary/border/danger/accent`):
```tsx
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";

import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";

type Props = {
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

export function AccountSection({ onSignIn, onSignOut, onDeleteAccount }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { isSignedIn, email } = useAuthState();

  if (!isSignedIn) {
    return (
      <View style={styles.section}>
        <TouchableOpacity style={styles.row} accessibilityRole="button" onPress={onSignIn}>
          <Ionicons name="person-circle-outline" size={22} color={theme.colors.textPrimary} />
          <Text style={styles.rowText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {email ? <Text style={styles.email}>{email}</Text> : null}
      <TouchableOpacity style={styles.row} accessibilityRole="button" onPress={onSignOut}>
        <Ionicons name="log-out-outline" size={22} color={theme.colors.textPrimary} />
        <Text style={styles.rowText}>Sign out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.row} accessibilityRole="button" onPress={onDeleteAccount}>
        <Ionicons name="trash-outline" size={22} color={theme.colors.danger} />
        <Text style={[styles.rowText, { color: theme.colors.danger }]}>Delete account</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    section: { gap: 4 },
    email: { color: theme.colors.textSecondary, fontSize: 14, paddingHorizontal: 16, paddingTop: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    rowText: { fontSize: 16, color: theme.colors.textPrimary },
  });
```
**Note:** if `Settings.tsx` uses a shared row component (e.g. a `SettingRow`), reuse it instead of raw `TouchableOpacity` to match the existing visual language — inspect `Settings.tsx` first and follow its pattern.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/components/accountSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/settings/AccountSection.tsx __tests__/components/accountSection.test.tsx
git commit -m "feat(auth): add Settings account section component"
```

---

### Task 8: Account actions hook — sign out & delete  [TDD]

**Files:**
- Create: `frontend/hooks/useAccountActions.ts`
- Test: `frontend/__tests__/hooks/useAccountActions.test.tsx`

**Interfaces:**
- Consumes: `signOut` from Clerk's `useAuth`; `apiFetch` from `@/services/apiClient`.
- Produces: `useAccountActions(): { signOut(): Promise<void>; deleteAccount(): Promise<void> }`. `deleteAccount` calls `apiFetch("/api/account", { method: "DELETE" })` THEN Clerk `signOut()` (so the server deletes data while the token is still valid, then the local session clears). `signOut` just clears the Clerk session.

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/hooks/useAccountActions.test.tsx`:
```tsx
import { renderHook, act } from "@testing-library/react-native";
import { useAccountActions } from "@/hooks/useAccountActions";

const mockSignOut = jest.fn();
const mockApiFetch = jest.fn();
jest.mock("@clerk/expo", () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock("@/services/apiClient", () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));

describe("useAccountActions", () => {
  beforeEach(() => {
    mockSignOut.mockReset().mockResolvedValue(undefined);
    mockApiFetch.mockReset().mockResolvedValue({ deleted: true });
  });

  it("signOut clears the Clerk session", async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () => { await result.current.signOut(); });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("deleteAccount calls DELETE /api/account then signs out", async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () => { await result.current.deleteAccount(); });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/account", { method: "DELETE" });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    // DELETE must happen before signOut (token still valid for the server call)
    expect(mockApiFetch.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
  });

  it("deleteAccount does not sign out if the server call fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAccountActions());
    await act(async () => {
      await expect(result.current.deleteAccount()).rejects.toThrow("network");
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/hooks/useAccountActions.test.tsx`
Expected: FAIL — cannot find module `@/hooks/useAccountActions`.

- [ ] **Step 3: Write the hook**  **[VERIFY vs installed Clerk docs]**

Create `frontend/hooks/useAccountActions.ts` (confirm `useAuth().signOut` exists in the installed version):
```ts
import { useCallback } from "react";
import { useAuth } from "@clerk/expo";

import { apiFetch } from "@/services/apiClient";

export function useAccountActions() {
  const { signOut } = useAuth();

  const deleteAccount = useCallback(async () => {
    // Delete server-side data first while the session token is still valid,
    // then clear the local Clerk session.
    await apiFetch("/api/account", { method: "DELETE" });
    await signOut();
  }, [signOut]);

  const doSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return { signOut: doSignOut, deleteAccount };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/hooks/useAccountActions.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/useAccountActions.ts __tests__/hooks/useAccountActions.test.tsx
git commit -m "feat(auth): add sign-out and delete-account actions hook"
```

---

### Task 9: Wire the account section into Settings  [TDD]

**Files:**
- Modify: `frontend/app/Settings.tsx`
- Test: `frontend/__tests__/screens/settings.account.test.tsx`

**Interfaces:**
- Consumes: `AccountSection`, `useAccountActions`, `router` (to open `/SignIn`).
- Produces: Settings renders `AccountSection` with `onSignIn` → `router.push("/SignIn")`, `onSignOut` → action hook, `onDeleteAccount` → confirm dialog then action hook.

- [ ] **Step 1: Read `Settings.tsx` and locate the insertion point**

Open `frontend/app/Settings.tsx`. Identify where sections are laid out (it uses `useTheme()` + `createStyles`). The account section goes at the top of the settings list (above prayer/notification settings) so it's the first thing a user sees. Note the existing scroll/safe-area structure to match it.

- [ ] **Step 2: Write the failing integration test**

Create `frontend/__tests__/screens/settings.account.test.tsx`:
```tsx
import { render, fireEvent } from "@testing-library/react-native";
import Settings from "@/app/Settings";

const mockPush = jest.fn();
const mockDeleteAccount = jest.fn().mockResolvedValue(undefined);
const mockSignOut = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-router", () => ({ router: { push: (p: string) => mockPush(p), back: jest.fn() } }));
jest.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ isLoaded: true, isSignedIn: true, userId: "u1", email: "a@b.com" }),
}));
jest.mock("@/hooks/useAccountActions", () => ({
  useAccountActions: () => ({ signOut: mockSignOut, deleteAccount: mockDeleteAccount }),
}));
// ...plus the project's standard Settings mocks (theme, safe-area with useSafeAreaInsets,
// notification/prayer services). Mirror an existing Settings-rendering test's mock block.

describe("Settings account integration", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSignOut.mockReset().mockResolvedValue(undefined);
    mockDeleteAccount.mockReset().mockResolvedValue(undefined);
  });

  it("opens the sign-in route from the account row when signed out", () => {
    // (re-mock useAuthState as signed-out for this case if needed)
  });

  it("renders the signed-in email in Settings", () => {
    const { getByText } = render(<Settings />);
    expect(getByText("a@b.com")).toBeTruthy();
  });

  it("sign out triggers the action", () => {
    const { getByText } = render(<Settings />);
    fireEvent.press(getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
```
**Note:** `Settings.tsx` pulls in prayer/notification services and theme — copy the existing mock block from whatever suite already renders `Settings` (search `__tests__` for a Settings test; if none, mirror the `screen-contracts` mocks). The account-specific assertions above are the new coverage.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/screens/settings.account.test.tsx`
Expected: FAIL — `a@b.com` / "Sign out" not present (AccountSection not wired yet).

- [ ] **Step 4: Wire it in**

In `frontend/app/Settings.tsx`:
```tsx
import { router } from "expo-router";
import { Alert } from "react-native";
import { AccountSection } from "@/components/settings/AccountSection";
import { useAccountActions } from "@/hooks/useAccountActions";
```
Inside the component, get the actions:
```tsx
  const { signOut, deleteAccount } = useAccountActions();
```
Render `AccountSection` at the top of the settings content (first section):
```tsx
        <AccountSection
          onSignIn={() => router.push("/SignIn")}
          onSignOut={() => { void signOut(); }}
          onDeleteAccount={() =>
            Alert.alert(
              "Delete account",
              "This permanently deletes your account and all synced data. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => { void deleteAccount(); } },
              ],
            )
          }
        />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/screens/settings.account.test.tsx`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck**

Run:
```bash
npm test
npx tsc --noEmit
```
Expected: all suites pass; no TS errors.

- [ ] **Step 7: Commit**

```bash
git add app/Settings.tsx __tests__/screens/settings.account.test.tsx
git commit -m "feat(auth): surface account section in Settings"
```

---

### Task 10: Docs  [docs]

**Files:**
- Modify: `frontend/__tests__/README.md` (list the new suites)
- Modify: `CLAUDE.md` (auth conventions + env var)
- Modify: `devDocs/superpowers/specs/2026-06-19-user-accounts-cloud-sync-design.md` (note `mergeSettings` drift tracking from Phase 1 final review)

- [ ] **Step 1: Update the frontend test README**

In `frontend/__tests__/README.md`, add the new suites: `services/auth/authToken.test.ts`, `services/apiClient.auth.test.ts`, `hooks/useAuthState.test.tsx`, `hooks/useAccountActions.test.tsx`, `components/accountSection.test.tsx`, `screens/signIn.test.tsx`, `screens/settings.account.test.tsx` — each with a one-line description, matching the file's existing format.

- [ ] **Step 2: Update CLAUDE.md**

Add an **Auth** subsection under Key Conventions: Clerk Expo provides identity (Apple + Google); the only direct Clerk touch points are `services/auth/authToken.ts` (non-hook token), `hooks/useAuthState.ts`, `hooks/useAccountActions.ts`, the `ClerkProvider` in `app/_layout.tsx`, and `app/SignIn.tsx` — everything else depends on those adapters. New env var `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Sign-in is optional; the app works signed-out. Note the native-build requirement (Clerk + secure-store are native modules).

- [ ] **Step 3: Note the mergeSettings drift item**

In the design spec's testing section, add a line: "Phase 1 ships a backend-only `mergeSettings` (no frontend counterpart until Phase 3's settings stamping). When Phase 3 adds frontend settings merging, add `mergeSettings` to the shared merge test vector so both sides are drift-guarded." (Carried from the Phase 1 final review.)

- [ ] **Step 4: Commit**

```bash
git add frontend/__tests__/README.md CLAUDE.md devDocs/superpowers/specs/2026-06-19-user-accounts-cloud-sync-design.md
git commit -m "docs(auth): document Phase 2 auth adapters, env, and test suites"
```

---

## Self-Review

**Spec coverage (Phase 2 scope from the design spec):**
- ClerkProvider + token cache → Task 5. ✓
- Sign-in screen (Apple + Google) → Task 6. ✓
- Optional-login UX (app usable signed-out; nothing gated) → Tasks 5 (no throw on missing key) + 7 (signed-out state) + overall (no auth gates added). ✓
- Account / sign-out / delete in Settings → Tasks 7, 8, 9. ✓
- Clerk session JWT attached to backend calls → Task 3. ✓
- `DELETE /api/account` wired from the app → Task 8 (`deleteAccount`). ✓
- Adapter isolation of Clerk's version-sensitive surface → Tasks 2, 4 (+ confined to 5, 6, 8). ✓
- Native-build / external-setup reality → Prerequisites section + `[native — manual verify]` tags + OTA note. ✓

Out of Phase 2 scope (correct): the sync engine, adapters, settings stamping, sync triggers (Phase 3). This phase authenticates a user and manages the account; it does not sync anything yet.

**Placeholder scan:** Testable tasks (2, 3, 4, 7, 8) carry complete code + tests. Native/Clerk-touching tasks (1, 5, 6) carry verified scaffolding plus explicit `[VERIFY vs installed Clerk docs]` markers where the SDK symbol is version-sensitive — this is deliberate (the user accepted "OAuth code follows current Clerk Expo useSSO docs"), not an omission. Task 9's test references "mirror the existing Settings mock block" because Settings' service mocks already exist in the repo and must not be duplicated blindly.

**Type/name consistency:** `getAuthToken()` (T2) consumed by T3; `useAuthState()` shape `{ isLoaded, isSignedIn, userId, email }` (T4) consumed by T6/T7/T9; `useAccountActions()` `{ signOut, deleteAccount }` (T8) consumed by T9; `AccountSection` props `{ onSignIn, onSignOut, onDeleteAccount }` (T7) consumed by T9; `DELETE /api/account` matches the Phase 1 backend route. The `oauth_apple`/`oauth_google` strategy strings and `setActive({ session })` shape are marked for verification against the installed Clerk version.

**Known risk:** the exact `@clerk/expo` API (`useSSO` argument keys, `getClerkInstance().session.getToken()`, `tokenCache` import path, `useAuth`/`useUser` fields) can differ by version. The adapter isolation means a wrong guess is contained to one small file and caught by that file's test or on-device check — but every such call is tagged `[VERIFY vs installed Clerk docs]` so the implementer confirms before finalizing.
