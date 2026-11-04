import { apiFetch } from "@/services/apiClient";
import type { BackendProxyResponse } from "./types";

export async function fetchPrayerProxy<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const body = await apiFetch<BackendProxyResponse<T> | null>(path, { params });
  if (!body?.success || body.data === undefined) {
    throw new Error("Invalid response from prayer times API");
  }
  return body.data;
}
