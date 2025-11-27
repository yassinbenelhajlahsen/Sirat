import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_READ_INDEX_KEY = "quran:last-read:index";
const LAST_READ_POSITION_KEY = "quran:last-read:position";

type StoredPosition = {
  surahNumber: number;
  ayahNumber: number;
};

function safeParseNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getLastReadAyahIndex(): Promise<number | null> {
  try {
    const stored = await AsyncStorage.getItem(LAST_READ_INDEX_KEY);
    const parsed = safeParseNumber(stored);
    return parsed ?? null;
  } catch {
    return null;
  }
}

export async function saveLastReadAyahIndex(index: number): Promise<void> {
  try {
    if (!Number.isFinite(index) || index < 0) {
      return;
    }
    const normalizedIndex = Math.floor(index);
    await AsyncStorage.setItem(LAST_READ_INDEX_KEY, String(normalizedIndex));
  } catch {
    /** Unable to persist progress; silently ignore for now. */
  }
}

export async function getLastReadSurahAndAyah(): Promise<StoredPosition | null> {
  try {
    const stored = await AsyncStorage.getItem(LAST_READ_POSITION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<StoredPosition> | null;
    if (
      !parsed ||
      typeof parsed.surahNumber !== "number" ||
      typeof parsed.ayahNumber !== "number"
    ) {
      return null;
    }
    return parsed as StoredPosition;
  } catch {
    return null;
  }
}

export async function saveLastReadSurahAndAyah(
  surahNumber: number,
  ayahNumber: number
): Promise<void> {
  try {
    const normalizedSurah = Math.floor(surahNumber);
    const normalizedAyah = Math.floor(ayahNumber);
    if (
      !Number.isFinite(normalizedSurah) ||
      !Number.isFinite(normalizedAyah) ||
      normalizedSurah <= 0 ||
      normalizedAyah <= 0
    ) {
      return;
    }
    const payload: StoredPosition = {
      surahNumber: normalizedSurah,
      ayahNumber: normalizedAyah,
    };
    await AsyncStorage.setItem(LAST_READ_POSITION_KEY, JSON.stringify(payload));
  } catch {
    /** Unable to persist progress; silently ignore for now. */
  }
}
