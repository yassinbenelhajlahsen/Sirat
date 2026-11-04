import { APP_THEME_STORAGE_KEY, isThemeName, type ThemeName } from "@/constants/theme";
import { DEFAULT_QURAN_RECITER_ID, sanitizeQuranReciterId } from "@/services/quranAudio";
import type { QuranBookmark } from "@/services/quranBookmarks";
import type { QuranDisplayMode } from "@/services/quranDisplayModes";
import {
  DEFAULT_PREFS,
  DEFAULT_WINDOW_OFFSET,
  DEFAULT_WINDOW_PREFS,
  PRAYERS,
  STORAGE_FRIDAY,
  STORAGE_MAP,
  STORAGE_RAMADAN_MODE,
  STORAGE_SOUND_MODE,
  STORAGE_WINDOW_MAP,
  STORAGE_WINDOW_OFFSET,
  WINDOW_OFFSET_OPTIONS,
  WINDOW_PRAYERS,
  type SoundMode,
  type WindowPrefMap,
} from "@/utils/notifications/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CITIES, { cityKey, type City } from "@/utils/cities";
import { defineSetting } from "./core";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function booleanMap<K extends string>(
  keys: readonly K[],
  defaults: Record<K, boolean>,
  input: unknown,
): Record<K, boolean> | undefined {
  if (!isRecord(input)) return undefined;
  const next = { ...defaults };
  for (const key of keys) {
    if (typeof input[key] === "boolean") next[key] = input[key] as boolean;
  }
  return next;
}

export const DISPLAY_MODES: readonly QuranDisplayMode[] = ["arabic", "english", "transliteration"];
export const DEFAULT_DISPLAY_MODES: readonly QuranDisplayMode[] = ["arabic"];

export function generateBookmarkId(): string {
  return `bm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeBookmark(entry: unknown): QuranBookmark | null {
  if (!isRecord(entry)) return null;
  const surahNumber = Number(entry.surahNumber);
  const ayahNumber = Number(entry.ayahNumber);
  const ayahGlobalIndex = Number(entry.ayahGlobalIndex);
  const createdAt = Number(entry.createdAt ?? Date.now());
  const updatedAt = Number(entry.updatedAt ?? createdAt);
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  if (
    !Number.isFinite(surahNumber) ||
    !Number.isFinite(ayahNumber) ||
    !Number.isFinite(ayahGlobalIndex) ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(updatedAt) ||
    !title
  ) {
    return null;
  }
  const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : generateBookmarkId();
  return { id, surahNumber, ayahNumber, ayahGlobalIndex, title, createdAt, updatedAt };
}

export type QuranProgress = {
  index: number | null;
  position: { surahNumber: number; ayahNumber: number } | null;
};

const PROGRESS_INDEX_KEY = "quran:last-read:index";
const PROGRESS_POSITION_KEY = "quran:last-read:position";

function normalizeProgress(input: unknown): QuranProgress | undefined {
  if (!isRecord(input)) return undefined;
  const index =
    typeof input.index === "number" && Number.isFinite(input.index) && input.index >= 0
      ? Math.floor(input.index)
      : null;
  let position: QuranProgress["position"] = null;
  if (isRecord(input.position)) {
    const { surahNumber, ayahNumber } = input.position;
    if (typeof surahNumber === "number" && typeof ayahNumber === "number") {
      const s = Math.floor(surahNumber);
      const a = Math.floor(ayahNumber);
      if (s > 0 && a > 0) position = { surahNumber: s, ayahNumber: a };
    }
  }
  return { index, position };
}

export const themeSetting = defineSetting<ThemeName>({
  envelopeKey: "theme",
  storageKey: APP_THEME_STORAGE_KEY,
  encoding: "string",
  defaultValue: "default",
  normalize: (v) => (typeof v === "string" && isThemeName(v) ? v : undefined),
});

export const DEFAULT_PRAYER_METHOD = -1;
/** The city shown, and used, when location is off and none was ever picked. */
export const DEFAULT_PRAYER_CITY: City = CITIES[0];

/**
 * What the user chose. `cityKey` is still written so an older build on another device can read it.
 * Never holds the OS permission: that is applied on read, see `getEffectivePrayerSettings`.
 */
export type PrayerSettingsValue = {
  useLocation: boolean;
  method: number;
  city: City | null;
  cityKey?: string;
};

function normalizeCity(input: unknown): City | null {
  if (!isRecord(input)) return null;
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (typeof input.name !== "string" || !input.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return {
    name: input.name.trim(),
    country: typeof input.country === "string" ? input.country : "",
    lat,
    lng,
  };
}

const cityFromKey = (key: unknown): City | null =>
  typeof key === "string" ? (CITIES.find((c) => cityKey(c) === key) ?? null) : null;

function normalizePrayerSettings(input: unknown): PrayerSettingsValue | undefined {
  if (!isRecord(input)) return undefined;
  const city = normalizeCity(input.city) ?? cityFromKey(input.cityKey);
  return {
    useLocation: typeof input.useLocation === "boolean" ? input.useLocation : true,
    method: typeof input.method === "number" ? input.method : DEFAULT_PRAYER_METHOD,
    city,
    ...(city ? { cityKey: cityKey(city) } : {}),
  };
}

const PRAYER_SETTINGS_KEY = "prayerSettings";
// Written by builds before prayerSettings existed; only read when prayerSettings is missing.
const LEGACY_SELECTED_CITY_KEY = "selectedCity";

export const prayerSettingsSetting = defineSetting<PrayerSettingsValue>({
  envelopeKey: "prayerSettings",
  storageKey: PRAYER_SETTINGS_KEY,
  encoding: "json",
  defaultValue: { useLocation: true, method: DEFAULT_PRAYER_METHOD, city: null },
  normalize: normalizePrayerSettings,
  io: {
    async load() {
      const raw = await AsyncStorage.getItem(PRAYER_SETTINGS_KEY);
      if (raw != null) {
        try {
          return JSON.parse(raw);
        } catch {
          return undefined;
        }
      }
      return { cityKey: await AsyncStorage.getItem(LEGACY_SELECTED_CITY_KEY) };
    },
    async save(value) {
      await AsyncStorage.setItem(PRAYER_SETTINGS_KEY, JSON.stringify(value));
    },
  },
});

export const quranDisplayModesSetting = defineSetting<QuranDisplayMode[]>({
  envelopeKey: "quranDisplayModes",
  storageKey: "quran_display_modes",
  encoding: "json",
  defaultValue: [...DEFAULT_DISPLAY_MODES],
  normalize: (v) => {
    if (!Array.isArray(v)) return undefined;
    const modes = [...new Set(v)].filter((m): m is QuranDisplayMode =>
      DISPLAY_MODES.includes(m as QuranDisplayMode),
    );
    return modes.length ? modes : [...DEFAULT_DISPLAY_MODES];
  },
});

export const quranReciterSetting = defineSetting<string>({
  envelopeKey: "quranReciter",
  storageKey: "quran_reciter_v1",
  encoding: "string",
  defaultValue: DEFAULT_QURAN_RECITER_ID,
  // An id this build doesn't know (newer app on another device) is rejected, not reset to default.
  normalize: (v) => (typeof v === "string" && sanitizeQuranReciterId(v) === v ? v : undefined),
});

export const quranBookmarksSetting = defineSetting<QuranBookmark[]>({
  envelopeKey: "quranBookmarks",
  storageKey: "quran:bookmarks",
  encoding: "json",
  defaultValue: [],
  normalize: (v) =>
    Array.isArray(v)
      ? v
          .map(sanitizeBookmark)
          .filter((b): b is QuranBookmark => b !== null)
          .sort((a, b) => b.updatedAt - a.updatedAt)
      : undefined,
});

export const quranProgressSetting = defineSetting<QuranProgress>({
  envelopeKey: "quranProgress",
  storageKey: PROGRESS_INDEX_KEY,
  encoding: "json",
  defaultValue: { index: null, position: null },
  normalize: normalizeProgress,
  io: {
    async load() {
      const [[, rawIndex], [, rawPosition]] = await AsyncStorage.multiGet([
        PROGRESS_INDEX_KEY,
        PROGRESS_POSITION_KEY,
      ]);
      let position: unknown = null;
      try {
        position = rawPosition ? JSON.parse(rawPosition) : null;
      } catch {
        // Corrupt position: treat as unset.
      }
      return { index: rawIndex ? Number(rawIndex) : null, position };
    },
    async save({ index, position }) {
      // Only write what is set, so a partial remote value never erases the other half.
      if (index !== null) await AsyncStorage.setItem(PROGRESS_INDEX_KEY, String(index));
      if (position) await AsyncStorage.setItem(PROGRESS_POSITION_KEY, JSON.stringify(position));
    },
  },
});

export const ramadanTrackerSetting = defineSetting<Record<string, boolean>>({
  envelopeKey: "ramadanTracker",
  storageKey: "ramadan_tracker_v1",
  encoding: "json",
  defaultValue: {},
  normalize: (v) =>
    isRecord(v)
      ? Object.fromEntries(Object.entries(v).filter(([, missed]) => missed === true)) as Record<string, boolean>
      : undefined,
});

export const duaSavedSetting = defineSetting<number[]>({
  envelopeKey: "duaSaved",
  storageKey: "dua_saved_v1",
  encoding: "json",
  defaultValue: [],
  normalize: (v) =>
    Array.isArray(v) ? [...new Set(v.filter((id): id is number => Number.isInteger(id)))] : undefined,
});

export const notifPrefsSetting = defineSetting<Record<(typeof PRAYERS)[number], boolean>>({
  envelopeKey: "notifPrefs",
  storageKey: STORAGE_MAP,
  encoding: "json",
  defaultValue: { ...DEFAULT_PREFS },
  normalize: (v) => booleanMap(PRAYERS, DEFAULT_PREFS, v),
});

export const notifSoundModeSetting = defineSetting<SoundMode>({
  envelopeKey: "notifSoundMode",
  storageKey: STORAGE_SOUND_MODE,
  encoding: "string",
  defaultValue: "default",
  normalize: (v) => (v === "default" || v === "adhan" ? v : undefined),
});

export const notifWindowMapSetting = defineSetting<WindowPrefMap>({
  envelopeKey: "notifWindowMap",
  storageKey: STORAGE_WINDOW_MAP,
  encoding: "json",
  defaultValue: { ...DEFAULT_WINDOW_PREFS },
  normalize: (v) => booleanMap(WINDOW_PRAYERS, DEFAULT_WINDOW_PREFS, v),
});

export const notifWindowOffsetSetting = defineSetting<number>({
  envelopeKey: "notifWindowOffset",
  storageKey: STORAGE_WINDOW_OFFSET,
  encoding: "string",
  defaultValue: DEFAULT_WINDOW_OFFSET,
  normalize: (v) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    return (WINDOW_OFFSET_OPTIONS as readonly number[]).includes(n) ? n : undefined;
  },
});

export const notifFridaySetting = defineSetting<boolean>({
  envelopeKey: "notifFriday",
  storageKey: STORAGE_FRIDAY,
  encoding: "bool01",
  defaultValue: true,
  normalize: (v) => (typeof v === "boolean" ? v : undefined),
});

export const ramadanModeSetting = defineSetting<boolean>({
  envelopeKey: "ramadanMode",
  storageKey: STORAGE_RAMADAN_MODE,
  encoding: "bool01",
  defaultValue: true,
  normalize: (v) => (typeof v === "boolean" ? v : undefined),
});
