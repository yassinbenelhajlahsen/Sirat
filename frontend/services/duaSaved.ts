import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

const SAVED_DUAS_STORAGE_KEY = "dua_saved_v1";

export const DUA_SAVED_UPDATED_EVENT = "DUA_SAVED_UPDATED";

/** Saved dua ids, newest first. Ids missing from the dataset are skipped at display time. */
export async function getSavedDuaIds(): Promise<number[]> {
  try {
    const stored = await AsyncStorage.getItem(SAVED_DUAS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is number => Number.isInteger(id)))];
  } catch {
    return [];
  }
}

/** Returns whether the dua is saved after the toggle. */
export async function toggleSavedDua(id: number): Promise<boolean> {
  const existing = await getSavedDuaIds();
  const saved = !existing.includes(id);
  const next = saved ? [id, ...existing] : existing.filter((x) => x !== id);
  await AsyncStorage.setItem(SAVED_DUAS_STORAGE_KEY, JSON.stringify(next));
  DeviceEventEmitter.emit(DUA_SAVED_UPDATED_EVENT);
  return saved;
}

export async function replaceSavedDuaIds(ids: number[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_DUAS_STORAGE_KEY, JSON.stringify(ids));
  DeviceEventEmitter.emit(DUA_SAVED_UPDATED_EVENT);
}
