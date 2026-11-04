import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import {
  DEFAULT_QURAN_RECITER_ID,
  sanitizeQuranReciterId,
} from "@/services/quranAudio";

export const QURAN_RECITER_STORAGE_KEY = "quran_reciter_v1";
export const QURAN_RECITER_UPDATED_EVENT = "QURAN_RECITER_UPDATED";

let cached: string | null = null;
let loadPromise: Promise<string> | null = null;

export async function getQuranReciter(): Promise<string> {
  if (cached != null) return cached;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        cached = sanitizeQuranReciterId(
          await AsyncStorage.getItem(QURAN_RECITER_STORAGE_KEY)
        );
      } catch {
        cached = DEFAULT_QURAN_RECITER_ID;
      } finally {
        loadPromise = null;
      }
      return cached as string;
    })();
  }
  return loadPromise;
}

export function getCachedQuranReciter(): string {
  return cached ?? DEFAULT_QURAN_RECITER_ID;
}

export async function saveQuranReciter(value: unknown): Promise<string> {
  const next = sanitizeQuranReciterId(value);
  cached = next;
  try {
    await AsyncStorage.setItem(QURAN_RECITER_STORAGE_KEY, next);
  } catch {
    // Keep the in-memory value even if persistence fails.
  }
  try {
    DeviceEventEmitter.emit(QURAN_RECITER_UPDATED_EVENT, next);
  } catch {
    // Best-effort event emission only.
  }
  return next;
}
