import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import type { Cell, HabitLog } from "./types";
import { nowMs } from "./util";

export const HABIT_LOG_STORAGE_KEY = "tracking:habit_log_v1";
export const HABIT_LOG_UPDATED_EVENT = "HABIT_LOG_UPDATED";

let cache: HabitLog | null = null;
let loadPromise: Promise<HabitLog> | null = null;

function emit(dateKey: string): void {
  try {
    DeviceEventEmitter.emit(HABIT_LOG_UPDATED_EVENT, { dateKey });
  } catch {
    // best-effort
  }
}

export async function getHabitLog(): Promise<HabitLog> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(HABIT_LOG_STORAGE_KEY);
        cache = raw ? (JSON.parse(raw) as HabitLog) : {};
      } catch {
        cache = {};
      } finally {
        loadPromise = null;
      }
      return cache as HabitLog;
    })();
  }
  return loadPromise;
}

export function getCachedHabitLog(): HabitLog {
  return cache ?? {};
}

export async function preloadHabitLog(): Promise<void> {
  await getHabitLog();
}

export async function getDayHabitDone(
  dateKey: string,
): Promise<Record<string, boolean>> {
  const log = await getHabitLog();
  const day = log[dateKey];
  if (!day) return {};
  const out: Record<string, boolean> = {};
  for (const habitId of Object.keys(day)) {
    out[habitId] = day[habitId].value;
  }
  return out;
}

export async function setHabitDone(
  dateKey: string,
  habitId: string,
  done: boolean,
): Promise<void> {
  const log = await getHabitLog();
  const day = log[dateKey] ?? {};
  const cell: Cell<boolean> = { value: done, updatedAt: nowMs() };
  log[dateKey] = { ...day, [habitId]: cell };
  cache = log;
  try {
    await AsyncStorage.setItem(HABIT_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // keep in-memory state even if persistence fails
  }
  emit(dateKey);
}

export async function replaceHabitLog(log: HabitLog): Promise<void> {
  cache = log;
  try {
    await AsyncStorage.setItem(HABIT_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // keep in-memory state even if persistence fails
  }
  DeviceEventEmitter.emit(HABIT_LOG_UPDATED_EVENT, { dateKey: null });
}
