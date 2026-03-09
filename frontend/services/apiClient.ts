import { DeviceEventEmitter } from "react-native";
import { getVersionHeaders } from "./appVersion";

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

export async function apiFetch<T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    params?: Record<string, string | number>;
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

  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...getVersionHeaders(),
    },
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const responseBody = await res.json().catch(() => null);

  if (res.status === 426) {
    handleForceUpdate(responseBody);
  }

  if (!res.ok) {
    const message =
      typeof responseBody?.error === "string"
        ? responseBody.error
        : `API error (${res.status})`;
    throw new Error(message);
  }

  return responseBody as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body });
}
