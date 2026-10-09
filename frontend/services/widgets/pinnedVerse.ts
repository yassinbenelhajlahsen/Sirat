import AsyncStorage from "@react-native-async-storage/async-storage";

import type { NormalizedAyah } from "@/services/quranData";

export const PINNED_VERSE_KEY = "widget:pinned_verse_v1";

export async function readPinnedVerse(): Promise<NormalizedAyah | null> {
  const raw = await AsyncStorage.getItem(PINNED_VERSE_KEY);
  return raw ? (JSON.parse(raw) as NormalizedAyah) : null;
}

export async function writePinnedVerse(ayah: NormalizedAyah): Promise<void> {
  await AsyncStorage.setItem(PINNED_VERSE_KEY, JSON.stringify(ayah));
}
