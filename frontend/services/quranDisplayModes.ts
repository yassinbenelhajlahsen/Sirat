import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

export type QuranDisplayMode = "arabic" | "english" | "transliteration";

export const QURAN_DISPLAY_MODES_STORAGE_KEY = "quran_display_modes";
export const QURAN_DISPLAY_MODES_UPDATED_EVENT = "QURAN_DISPLAY_MODES_UPDATED";
export const DEFAULT_QURAN_DISPLAY_MODES: readonly QuranDisplayMode[] = [
  "arabic",
];

const VALID_DISPLAY_MODES: readonly QuranDisplayMode[] = [
  "arabic",
  "english",
  "transliteration",
];

let cachedDisplayModes: QuranDisplayMode[] | null = null;
let loadDisplayModesPromise: Promise<QuranDisplayMode[]> | null = null;

function sanitizeDisplayModes(input: unknown): QuranDisplayMode[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_QURAN_DISPLAY_MODES];
  }

  const deduped: QuranDisplayMode[] = [];
  for (const value of input) {
    if (
      typeof value === "string" &&
      VALID_DISPLAY_MODES.includes(value as QuranDisplayMode) &&
      !deduped.includes(value as QuranDisplayMode)
    ) {
      deduped.push(value as QuranDisplayMode);
    }
  }

  if (deduped.length === 0) {
    return [...DEFAULT_QURAN_DISPLAY_MODES];
  }

  return deduped;
}

function emitDisplayModesUpdated(modes: readonly QuranDisplayMode[]): void {
  try {
    DeviceEventEmitter.emit(QURAN_DISPLAY_MODES_UPDATED_EVENT, [...modes]);
  } catch {
    // Best-effort event emission only.
  }
}

export async function getQuranDisplayModes(): Promise<QuranDisplayMode[]> {
  if (cachedDisplayModes) {
    return [...cachedDisplayModes];
  }

  if (!loadDisplayModesPromise) {
    loadDisplayModesPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(QURAN_DISPLAY_MODES_STORAGE_KEY);
        if (!raw) {
          cachedDisplayModes = [...DEFAULT_QURAN_DISPLAY_MODES];
          return [...cachedDisplayModes];
        }

        const parsed = JSON.parse(raw);
        const sanitized = sanitizeDisplayModes(parsed);
        cachedDisplayModes = sanitized;
        return [...sanitized];
      } catch {
        cachedDisplayModes = [...DEFAULT_QURAN_DISPLAY_MODES];
        return [...cachedDisplayModes];
      } finally {
        loadDisplayModesPromise = null;
      }
    })();
  }

  return loadDisplayModesPromise;
}

export function getCachedQuranDisplayModes(): QuranDisplayMode[] {
  return cachedDisplayModes
    ? [...cachedDisplayModes]
    : [...DEFAULT_QURAN_DISPLAY_MODES];
}

export async function preloadQuranDisplayModes(): Promise<void> {
  await getQuranDisplayModes();
}

export async function saveQuranDisplayModes(
  modes: readonly QuranDisplayMode[]
): Promise<QuranDisplayMode[]> {
  const sanitized = sanitizeDisplayModes(modes);
  cachedDisplayModes = sanitized;

  try {
    await AsyncStorage.setItem(
      QURAN_DISPLAY_MODES_STORAGE_KEY,
      JSON.stringify(sanitized)
    );
  } catch {
    // Keep in-memory state even if persistence fails.
  }

  emitDisplayModesUpdated(sanitized);
  return [...sanitized];
}

export async function toggleQuranDisplayMode(
  mode: QuranDisplayMode
): Promise<QuranDisplayMode[]> {
  const current = await getQuranDisplayModes();
  const isEnabled = current.includes(mode);

  if (isEnabled) {
    if (current.length <= 1) {
      return current;
    }
    return saveQuranDisplayModes(current.filter((value) => value !== mode));
  }

  return saveQuranDisplayModes([...current, mode]);
}
