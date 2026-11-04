import { quranProgressSetting, type QuranProgress } from "@/services/syncedSettings";

export type { QuranProgress };

export const getQuranProgress = () => quranProgressSetting.get();

export async function getLastReadAyahIndex(): Promise<number | null> {
  return (await quranProgressSetting.get()).index;
}

export async function getLastReadSurahAndAyah(): Promise<QuranProgress["position"]> {
  return (await quranProgressSetting.get()).position;
}

/**
 * Saves the reading spot in one write: two separate read-then-write saves fired together would each
 * put back the other's old half. An invalid half keeps its saved value.
 */
export async function saveLastRead(
  index: number,
  surahNumber: number,
  ayahNumber: number,
): Promise<void> {
  const validIndex = Number.isFinite(index) && index >= 0;
  const validPosition = Math.floor(surahNumber) > 0 && Math.floor(ayahNumber) > 0;
  if (!validIndex && !validPosition) return;
  const current = await quranProgressSetting.get();
  await quranProgressSetting.set({
    index: validIndex ? Math.floor(index) : current.index,
    position: validPosition ? { surahNumber, ayahNumber } : current.position,
  });
}
