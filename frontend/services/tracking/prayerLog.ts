import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import type { Cell, PrayerLog, PrayerName, PrayerStatus } from "./types";
import { nowMs } from "./util";

export const PRAYER_LOG_STORAGE_KEY = "tracking:prayer_log_v1";
export const PRAYER_LOG_UPDATED_EVENT = "PRAYER_LOG_UPDATED";

let cache: PrayerLog | null = null;
let loadPromise: Promise<PrayerLog> | null = null;

function emit(dateKey: string): void {
  try {
    DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey });
  } catch {
    // best-effort
  }
}

export async function getPrayerLog(): Promise<PrayerLog> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(PRAYER_LOG_STORAGE_KEY);
        cache = raw ? (JSON.parse(raw) as PrayerLog) : {};
      } catch {
        cache = {};
      } finally {
        loadPromise = null;
      }
      return cache as PrayerLog;
    })();
  }
  return loadPromise;
}

export function getCachedPrayerLog(): PrayerLog {
  return cache ?? {};
}

export async function preloadPrayerLog(): Promise<void> {
  await getPrayerLog();
}

export async function getDayStatuses(
  dateKey: string,
): Promise<Partial<Record<PrayerName, PrayerStatus>>> {
  const log = await getPrayerLog();
  const day = log[dateKey];
  if (!day) return {};
  const out: Partial<Record<PrayerName, PrayerStatus>> = {};
  for (const prayer of Object.keys(day) as PrayerName[]) {
    const cell = day[prayer];
    if (cell) out[prayer] = cell.value;
  }
  return out;
}

async function persist(log: PrayerLog): Promise<void> {
  try {
    await AsyncStorage.setItem(PRAYER_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // keep in-memory state even if persistence fails
  }
}

export async function setPrayerStatus(
  dateKey: string,
  prayer: PrayerName,
  status: PrayerStatus,
): Promise<void> {
  const log = await getPrayerLog();
  const day = log[dateKey] ?? {};
  const cell: Cell<PrayerStatus> = { value: status, updatedAt: nowMs() };
  log[dateKey] = { ...day, [prayer]: cell };
  cache = log;
  await persist(log);
  emit(dateKey);
}

export async function clearPrayerStatus(
  dateKey: string,
  prayer: PrayerName,
): Promise<void> {
  const log = await getPrayerLog();
  const day = log[dateKey];
  if (!day || !day[prayer]) return;
  const next = { ...day };
  delete next[prayer];
  if (Object.keys(next).length === 0) {
    delete log[dateKey];
  } else {
    log[dateKey] = next;
  }
  cache = log;
  await persist(log);
  emit(dateKey);
}
