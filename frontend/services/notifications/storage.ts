import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_ENABLED } from "../../utils/notifications/constants";
import {
  STORAGE_DAYKEY,
  STORAGE_SCHEDULE_IDS,
  STORAGE_SEEN_KEYS,
} from "./constants";
import type { CityLike } from "./types";

export function normalizeCity(raw: unknown): CityLike | null {
  if (!raw) return null;
  const candidate = Array.isArray(raw) ? raw[0] : raw;

  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }

  const item = candidate as {
    name?: unknown;
    lat?: unknown;
    lng?: unknown;
    country?: unknown;
    id?: unknown;
  };

  const lat = Number(item.lat);
  const lng = Number(item.lng);

  if (typeof item.name !== "string" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return {
    name: item.name.trim(),
    lat,
    lng,
    country: typeof item.country === "string" ? item.country : undefined,
    id: typeof item.id === "string" ? item.id : undefined,
  };
}

export async function readMasterEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_ENABLED);
  return raw === "1";
}

export async function readDayFingerprint(): Promise<string> {
  return (await AsyncStorage.getItem(STORAGE_DAYKEY)) || "";
}

export async function writeDayFingerprint(key: string) {
  await AsyncStorage.setItem(STORAGE_DAYKEY, key);
}

export async function readScheduledIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_SCHEDULE_IDS);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function writeScheduledIds(ids: string[]) {
  await AsyncStorage.setItem(STORAGE_SCHEDULE_IDS, JSON.stringify(ids));
}

export async function readSeenKeys(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_SEEN_KEYS);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function writeSeenKeys(keys: string[]) {
  await AsyncStorage.setItem(STORAGE_SEEN_KEYS, JSON.stringify(keys));
}

export async function clearScheduleStorage() {
  await AsyncStorage.multiRemove([STORAGE_SCHEDULE_IDS, STORAGE_SEEN_KEYS]);
}
