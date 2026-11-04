import { quranProgressSetting, type QuranProgress } from "@/services/syncedSettings";

export type { QuranProgress };

export const getQuranProgress = () => quranProgressSetting.get();

export async function getLastReadAyahIndex(): Promise<number | null> {
  return (await quranProgressSetting.get()).index;
}

export async function getLastReadSurahAndAyah(): Promise<QuranProgress["position"]> {
  return (await quranProgressSetting.get()).position;
}

export async function saveLastReadAyahIndex(index: number): Promise<void> {
  if (!Number.isFinite(index) || index < 0) return;
  const current = await quranProgressSetting.get();
  await quranProgressSetting.set({ ...current, index: Math.floor(index) });
}

export async function saveLastReadSurahAndAyah(
  surahNumber: number,
  ayahNumber: number
): Promise<void> {
  const current = await quranProgressSetting.get();
  const next = { ...current, position: { surahNumber, ayahNumber } };
  // An invalid position normalizes to null; skip rather than erase the saved one.
  if (Math.floor(surahNumber) > 0 && Math.floor(ayahNumber) > 0) {
    await quranProgressSetting.set(next);
  }
}
