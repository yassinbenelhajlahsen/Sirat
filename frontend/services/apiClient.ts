import { recordRequestFailure } from "@/services/diagnostics";
import { fetch as streamingFetch } from "expo/fetch";
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
  send: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<Response> {
  const method = init?.method ?? "GET";
  try {
    const res = await send(url, init);
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

/**
 * POSTs and reads an `application/x-ndjson` reply, calling `onEvent` once per line. Errors are handled
 * like `apiFetch`. Resolves `undefined` after a streamed reply, or with the parsed body when the server
 * answered with plain JSON instead (one that predates streaming).
 */
export async function apiStream(
  path: string,
  options: { body: unknown; headers?: Record<string, string> },
  onEvent: (event: any) => void,
): Promise<unknown> {
  const token = await getAuthToken();
  const res = await loggedFetch(
    path,
    `${API_BASE}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
        ...getVersionHeaders(),
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(options.body),
    },
    streamingFetch as unknown as typeof fetch,
  );

  if (!res.ok || !res.headers.get("content-type")?.includes("application/x-ndjson") || !res.body) {
    const responseBody = await res.json().catch(() => null);
    throwIfFailed(res, responseBody);
    return responseBody;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const emit = (line: string) => {
    if (line.trim()) onEvent(JSON.parse(line));
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop()!;
      lines.forEach(emit);
      if (done) return undefined;
    }
  } catch (err) {
    reader.cancel().catch(() => {});
    throw err;
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body });
}
