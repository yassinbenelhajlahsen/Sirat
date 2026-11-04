import {
  DEFAULT_DISPLAY_MODES,
  quranDisplayModesSetting,
} from "@/services/syncedSettings";

export type QuranDisplayMode = "arabic" | "english" | "transliteration";

export const DEFAULT_QURAN_DISPLAY_MODES: readonly QuranDisplayMode[] = DEFAULT_DISPLAY_MODES;

export const getQuranDisplayModes = () => quranDisplayModesSetting.get();

export const getCachedQuranDisplayModes = () => [...quranDisplayModesSetting.peek()];

export async function preloadQuranDisplayModes(): Promise<void> {
  await quranDisplayModesSetting.get();
}

export const saveQuranDisplayModes = (modes: readonly QuranDisplayMode[]) =>
  quranDisplayModesSetting.set([...modes]);

export async function toggleQuranDisplayMode(
  mode: QuranDisplayMode
): Promise<QuranDisplayMode[]> {
  const current = await quranDisplayModesSetting.get();
  if (!current.includes(mode)) return saveQuranDisplayModes([...current, mode]);
  if (current.length <= 1) return current;
  return saveQuranDisplayModes(current.filter((value) => value !== mode));
}
