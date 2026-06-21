import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import type { PrayerSettings } from "../prayerTimes";
import {
  STORAGE_ENABLED,
  STORAGE_MAP,
  STORAGE_SOUND_MODE,
} from "../../utils/notifications/constants";
import {
  STORAGE_DAYKEY,
  STORAGE_SCHEDULE_IDS,
  STORAGE_SEEN_KEYS,
} from "./constants";
import {
  DEFAULT_PREFS,
  type CityLike,
  type PrefMap,
  type RawPrayerSettings,
  type SoundMode,
} from "./types";

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

export async function readSoundMode(): Promise<SoundMode> {
  const raw = await AsyncStorage.getItem(STORAGE_SOUND_MODE);
  if (raw === "adhan") {
    return raw;
  }
  return "default";
}

export async function readMasterEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_ENABLED);
  return raw === "1";
}

export async function readPrefs(): Promise<PrefMap> {
  const raw = await AsyncStorage.getItem(STORAGE_MAP);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

export async function readPrayerSettings(): Promise<RawPrayerSettings> {
  const raw = await AsyncStorage.getItem("prayerSettings");
  if (!raw) {
    return {
      useLocation: true,
      method: -1,
      city: null,
    };
  }

  const parsed = JSON.parse(raw) as {
    useLocation?: unknown;
    method?: unknown;
    city?: unknown;
  };

  return {
    useLocation: Boolean(parsed.useLocation ?? true),
    method: typeof parsed.method === "number" ? parsed.method : -1,
    city: normalizeCity(parsed.city),
  };
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

export async function writePrayerSettings(value: unknown): Promise<void> {
  await AsyncStorage.setItem("prayerSettings", JSON.stringify(value));
  DeviceEventEmitter.emit("settingsChanged", value);
}

export function buildEffectiveSettings(
  s: RawPrayerSettings,
  canUse: boolean,
): PrayerSettings {
  const manualCity = s.city ?? null;

  if (!s.useLocation) {
    return { useLocation: false, method: s.method, city: manualCity as any };
  }

  if (s.useLocation && !canUse) {
    return { useLocation: false, method: s.method, city: manualCity as any };
  }

  return { useLocation: true, method: s.method, city: manualCity as any };
}
