import { recordRequestFailure } from "@/services/diagnostics";
import { DeviceEventEmitter } from "react-native";
import { getVersionHeaders } from "./appVersion";
import { getAuthToken } from "./auth/authToken";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

export class AppUpdateRequiredError extends Error {
  constructor(
    public readonly minVersion: string,
    public readonly currentVersion: string,
  ) {
    super("APP_UPDATE_REQUIRED");
    this.name = "AppUpdateRequiredError";
  }
}

/**
 * Emits FORCE_UPDATE_REQUIRED event and throws AppUpdateRequiredError.
 * Call this when a 426 response is detected.
 */
export function handleForceUpdate(body: unknown): never {
  const err = (body as any)?.error ?? {};
  const payload = {
    minVersion: err.minVersion ?? "",
    currentVersion: err.currentVersion ?? "",
  };
  DeviceEventEmitter.emit("FORCE_UPDATE_REQUIRED", payload);
  throw new AppUpdateRequiredError(payload.minVersion, payload.currentVersion);
}

/** `fetch` that logs failures for bug reports. `path` must leave out the query string: it can hold coordinates. */
export async function loggedFetch(
  path: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const method = init?.method ?? "GET";
  try {
    const res = await fetch(url, init);
    if (!res.ok) recordRequestFailure(method, path, res.status);
    return res;
  } catch (err) {
    recordRequestFailure(method, path, "offline");
    throw err;
  }
}

export async function apiFetch<T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    params?: Record<string, string | number>;
    headers?: Record<string, string>;
  },
): Promise<T> {
  let url = `${API_BASE}${path}`;
  if (options?.params) {
    const qs = Object.entries(options.params)
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&");
    url += `?${qs}`;
  }

  const token = await getAuthToken();
  const res = await loggedFetch(path, url, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...getVersionHeaders(),
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const responseBody = await res.json().catch(() => null);
  throwIfFailed(res, responseBody);
  return responseBody as T;
}

function throwIfFailed(res: Response, responseBody: any) {
  if (res.status === 426) {
    handleForceUpdate(responseBody);
  }

  if (!res.ok) {
    const err = responseBody?.error;
    const message =
      typeof err === "string"
        ? err
        : typeof err?.message === "string" && err.message
          ? err.message
          : `API error (${res.status})`;
    throw new Error(message);
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body });
}
