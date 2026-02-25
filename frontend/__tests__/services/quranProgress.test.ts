import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getLastReadAyahIndex,
  getLastReadSurahAndAyah,
  saveLastReadAyahIndex,
  saveLastReadSurahAndAyah,
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
    await saveLastReadAyahIndex(12.8);
    expect(await AsyncStorage.getItem("quran:last-read:index")).toBe("12");

    await saveLastReadAyahIndex(-1);
    expect(await AsyncStorage.getItem("quran:last-read:index")).toBe("12");

    await saveLastReadAyahIndex(Number.NaN);
    expect(await AsyncStorage.getItem("quran:last-read:index")).toBe("12");
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
    await saveLastReadSurahAndAyah(2.9, 255.4);
    expect(await getLastReadSurahAndAyah()).toEqual({ surahNumber: 2, ayahNumber: 255 });

    await saveLastReadSurahAndAyah(0, 5);
    expect(await getLastReadSurahAndAyah()).toEqual({ surahNumber: 2, ayahNumber: 255 });

    await saveLastReadSurahAndAyah(3, -1);
    expect(await getLastReadSurahAndAyah()).toEqual({ surahNumber: 2, ayahNumber: 255 });
  });
});
