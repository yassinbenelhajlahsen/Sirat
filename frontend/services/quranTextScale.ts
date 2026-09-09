import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

/**
 * Reader text size for the Quran screen. Multiplies the Arabic, translation
 * and transliteration sizes together so the reading rhythm is preserved.
 * Device-local (not synced): it is a per-screen comfort setting.
 */
export const QURAN_TEXT_SCALE_OPTIONS = [0.9, 1, 1.15, 1.3] as const;
export type QuranTextScale = (typeof QURAN_TEXT_SCALE_OPTIONS)[number];

export const QURAN_TEXT_SCALE_LABELS: Record<QuranTextScale, string> = {
  0.9: "Small",
  1: "Default",
  1.15: "Large",
  1.3: "Larger",
};

export const QURAN_TEXT_SCALE_STORAGE_KEY = "quran_text_scale_v1";
export const QURAN_TEXT_SCALE_UPDATED_EVENT = "QURAN_TEXT_SCALE_UPDATED";
export const DEFAULT_QURAN_TEXT_SCALE: QuranTextScale = 1;

let cached: QuranTextScale | null = null;
let loadPromise: Promise<QuranTextScale> | null = null;

export function sanitizeQuranTextScale(input: unknown): QuranTextScale {
  const n = typeof input === "string" ? Number(input) : input;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_QURAN_TEXT_SCALE;
  // Snap to the nearest allowed step so a stale value can't produce odd sizes.
  return QURAN_TEXT_SCALE_OPTIONS.reduce((best, opt) =>
    Math.abs(opt - n) < Math.abs(best - n) ? opt : best,
  );
}

export async function getQuranTextScale(): Promise<QuranTextScale> {
  if (cached != null) return cached;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(QURAN_TEXT_SCALE_STORAGE_KEY);
        cached = raw == null ? DEFAULT_QURAN_TEXT_SCALE : sanitizeQuranTextScale(raw);
      } catch {
        cached = DEFAULT_QURAN_TEXT_SCALE;
      } finally {
        loadPromise = null;
      }
      return cached as QuranTextScale;
    })();
  }
  return loadPromise;
}

export function getCachedQuranTextScale(): QuranTextScale {
  return cached ?? DEFAULT_QURAN_TEXT_SCALE;
}

export async function preloadQuranTextScale(): Promise<void> {
  await getQuranTextScale();
}

export async function saveQuranTextScale(value: unknown): Promise<QuranTextScale> {
  const next = sanitizeQuranTextScale(value);
  cached = next;
  try {
    await AsyncStorage.setItem(QURAN_TEXT_SCALE_STORAGE_KEY, String(next));
  } catch {
    // Keep the in-memory value even if persistence fails.
  }
  try {
    DeviceEventEmitter.emit(QURAN_TEXT_SCALE_UPDATED_EVENT, next);
  } catch {
    // Best-effort event emission only.
  }
  return next;
}
