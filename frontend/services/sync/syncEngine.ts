import { DeviceEventEmitter } from "react-native";
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost } from "@/services/apiClient";
import { getAuthToken } from "@/services/auth/authToken";
import type { SyncPayload, SyncResponse } from "./types";
import { prayerLogAdapter } from "./adapters/prayerLogAdapter";
import { habitsAdapter } from "./adapters/habitsAdapter";
import { habitLogAdapter } from "./adapters/habitLogAdapter";
import { settingsAdapter } from "./adapters/settingsAdapter";

export const LAST_SYNCED_KEY = "sync:last_synced_v1";
export const SYNC_STATUS_EVENT = "SYNC_STATUS_UPDATED";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

let running = false;
let pendingRerun = false;
let applyingRemote = false;

export function isApplyingRemote(): boolean {
  return applyingRemote;
}

export async function getLastSyncedAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNCED_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function emitStatus(status: SyncStatus, lastSyncedAt?: number | null): void {
  DeviceEventEmitter.emit(SYNC_STATUS_EVENT, { status, lastSyncedAt });
}

async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected !== false;
  } catch {
    return true; // fail-open; the request itself will error and be retried
  }
}

export async function syncNow(_reason?: string): Promise<void> {
  if (running) {
    pendingRerun = true;
    return;
  }
  running = true;
  let didSync = false;
  try {
    const token = await getAuthToken();
    if (!token) return;
    if (!(await isOnline())) return;
    didSync = true;
    emitStatus("syncing");
    const payload: SyncPayload = {
      prayer_log: await prayerLogAdapter.read(),
      habits: await habitsAdapter.read(),
      habit_log: await habitLogAdapter.read(),
      settings: await settingsAdapter.read(),
    };
    const res = await apiPost<SyncResponse>("/api/sync", payload);

    applyingRemote = true;
    try {
      await prayerLogAdapter.applyMerged(res.prayer_log);
      await habitsAdapter.applyMerged(res.habits);
      await habitLogAdapter.applyMerged(res.habit_log);
      await settingsAdapter.applyMerged(res.settings);
    } finally {
      applyingRemote = false;
    }

    const at = Date.parse(res.syncedAt);
    const stamp = Number.isFinite(at) ? at : Date.now();
    await AsyncStorage.setItem(LAST_SYNCED_KEY, String(stamp));
    emitStatus("success", stamp);
  } catch {
    if (didSync) emitStatus("error");
  } finally {
    running = false;
    if (pendingRerun) {
      pendingRerun = false;
      void syncNow("rerun");
    }
  }
}
