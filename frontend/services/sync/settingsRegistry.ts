import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import type { SettingEntry } from "./types";
import { APP_THEME_STORAGE_KEY, THEME_CHANGED_EVENT } from "@/constants/theme";
import { writePrayerSettings } from "@/services/notifications/storage";
import {
  getQuranDisplayModes,
  saveQuranDisplayModes,
  QURAN_DISPLAY_MODES_UPDATED_EVENT,
} from "@/services/quranDisplayModes";
import {
  getBookmarks,
  replaceBookmarks,
  QURAN_BOOKMARKS_UPDATED_EVENT,
} from "@/services/quranBookmarks";
import {
  getQuranProgress,
  replaceQuranProgress,
  QURAN_PROGRESS_UPDATED_EVENT,
} from "@/services/quranProgress";
import {
  getMissedFastDays,
  replaceMissedFastDays,
  RAMADAN_TRACKER_UPDATED_EVENT,
} from "@/services/ramadanTracker";

async function readJson(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export const SETTINGS_REGISTRY: SettingEntry[] = [
  {
    key: "theme",
    changeEvent: THEME_CHANGED_EVENT,
    read: async () => (await AsyncStorage.getItem(APP_THEME_STORAGE_KEY)) ?? null,
    applyValue: async (v) => {
      if (typeof v === "string") {
        await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, v);
        DeviceEventEmitter.emit(THEME_CHANGED_EVENT);
      }
    },
  },
  {
    key: "prayerSettings",
    changeEvent: "settingsChanged",
    read: () => readJson("prayerSettings"),
    applyValue: (v) => writePrayerSettings(v),
  },
  {
    key: "quranDisplayModes",
    changeEvent: QURAN_DISPLAY_MODES_UPDATED_EVENT,
    read: () => getQuranDisplayModes(),
    applyValue: async (v) => { if (Array.isArray(v)) await saveQuranDisplayModes(v); },
  },
  {
    key: "quranBookmarks",
    changeEvent: QURAN_BOOKMARKS_UPDATED_EVENT,
    read: () => getBookmarks(),
    applyValue: async (v) => { if (Array.isArray(v)) await replaceBookmarks(v as never); },
  },
  {
    key: "quranProgress",
    changeEvent: QURAN_PROGRESS_UPDATED_EVENT,
    read: () => getQuranProgress(),
    applyValue: async (v) => {
      if (v && typeof v === "object") await replaceQuranProgress(v as never);
    },
  },
  {
    key: "ramadanTracker",
    changeEvent: RAMADAN_TRACKER_UPDATED_EVENT,
    read: () => getMissedFastDays(),
    applyValue: async (v) => {
      if (v && typeof v === "object") await replaceMissedFastDays(v as Record<string, boolean>);
    },
  },
];
