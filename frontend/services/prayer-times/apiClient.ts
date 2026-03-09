import type {
  BackendErrorShape,
  BackendProxyResponse,
} from "./types";
import { handleForceUpdate } from "@/services/apiClient";
import { getVersionHeaders } from "@/services/appVersion";

const PRAYER_API_BASE =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

function buildQueryString(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

function backendErrorMessage(
  status: number,
  body: BackendErrorShape | null,
): string {
  if (typeof body?.error === "string") {
    return body.error;
  }

  const fromBody = body?.error?.message;
  if (typeof fromBody === "string" && fromBody.length > 0) {
    return fromBody;
  }

  return `Prayer times API error (${status})`;
}

export async function fetchPrayerProxy<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const query = buildQueryString(params);
  const url = `${PRAYER_API_BASE}${path}?${query}`;

  const res = await fetch(url, { headers: getVersionHeaders() });
  const body = (await res
    .json()
    .catch(() => null)) as BackendProxyResponse<T> | null;

  if (res.status === 426) {
    handleForceUpdate(body);
  }

  if (!res.ok) {
    throw new Error(backendErrorMessage(res.status, body));
  }

  if (!body?.success || body.data === undefined) {
    throw new Error("Invalid response from prayer times API");
  }

  return body.data;
}
