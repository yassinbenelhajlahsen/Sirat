import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getLastReadAyahIndex,
  getLastReadSurahAndAyah,
  saveLastRead,
  getQuranProgress,
} from "@/services/quranProgress";

describe("quranProgress", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("returns null when last-read index is missing or invalid", async () => {
    expect(await getLastReadAyahIndex()).toBeNull();

    await AsyncStorage.setItem("quran:last-read:index", "not-a-number");
    expect(await getLastReadAyahIndex()).toBeNull();
  });

  it("saves floored non-negative index and ignores invalid values", async () => {
    await saveLastRead(12.8, 1, 1);
    expect(await AsyncStorage.getItem("quran:last-read:index")).toBe("12");

    await saveLastRead(-1, 1, 1);
    expect(await AsyncStorage.getItem("quran:last-read:index")).toBe("12");

    await saveLastRead(Number.NaN, 1, 1);
    expect(await AsyncStorage.getItem("quran:last-read:index")).toBe("12");
  });

  it("keeps the newest spot when saves overlap", async () => {
    for (let i = 6; i <= 9; i++) {
      void saveLastRead(i, 1, i);
    }
    await saveLastRead(10, 1, 10);
    expect(await getQuranProgress()).toEqual({
      index: 10,
      position: { surahNumber: 1, ayahNumber: 10 },
    });
  });

  it("returns null for malformed position payloads", async () => {
    expect(await getLastReadSurahAndAyah()).toBeNull();

    await AsyncStorage.setItem("quran:last-read:position", "{bad json");
    expect(await getLastReadSurahAndAyah()).toBeNull();

    await AsyncStorage.setItem(
      "quran:last-read:position",
      JSON.stringify({ surahNumber: "2", ayahNumber: 255 })
    );
    expect(await getLastReadSurahAndAyah()).toBeNull();
  });

  it("saves floored surah/ayah and rejects non-positive inputs", async () => {
    await saveLastRead(0, 2.9, 255.4);
    expect(await getLastReadSurahAndAyah()).toEqual({ surahNumber: 2, ayahNumber: 255 });

    await saveLastRead(0, 0, 5);
    expect(await getLastReadSurahAndAyah()).toEqual({ surahNumber: 2, ayahNumber: 255 });

    await saveLastRead(0, 3, -1);
    expect(await getLastReadSurahAndAyah()).toEqual({ surahNumber: 2, ayahNumber: 255 });
  });

  it("getQuranProgress returns nulls when empty", async () => {
    expect(await getQuranProgress()).toEqual({ index: null, position: null });
  });
});
