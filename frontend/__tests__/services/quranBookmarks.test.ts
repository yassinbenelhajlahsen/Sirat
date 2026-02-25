import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  deleteBookmark,
  getBookmarks,
  getBookmarkKey,
  upsertBookmark,
} from "@/services/quranBookmarks";

describe("quranBookmarks", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("sanitizes stored bookmarks and sorts by updatedAt desc", async () => {
    await AsyncStorage.setItem(
      "quran:bookmarks",
      JSON.stringify([
        {
          id: "  keep-me  ",
          surahNumber: "2",
          ayahNumber: "255",
          ayahGlobalIndex: "42",
          title: "  Ayatul Kursi  ",
          note: 123,
          createdAt: 100,
          updatedAt: 300,
        },
        {
          id: "bad-title",
          surahNumber: 1,
          ayahNumber: 1,
          ayahGlobalIndex: 1,
          title: "   ",
          createdAt: 100,
          updatedAt: 200,
        },
        {
          id: "bad-numbers",
          surahNumber: "x",
          ayahNumber: 1,
          ayahGlobalIndex: 1,
          title: "valid",
          createdAt: 100,
          updatedAt: 200,
        },
        {
          id: "keep-2",
          surahNumber: 36,
          ayahNumber: 58,
          ayahGlobalIndex: 99,
          title: "Salam",
          note: "note",
          createdAt: 100,
          updatedAt: 200,
        },
      ])
    );

    const result = await getBookmarks();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "keep-me",
      surahNumber: 2,
      ayahNumber: 255,
      ayahGlobalIndex: 42,
      title: "Ayatul Kursi",
      note: undefined,
      createdAt: 100,
      updatedAt: 300,
    });
    expect(result[1]).toMatchObject({
      id: "keep-2",
      surahNumber: 36,
      ayahNumber: 58,
      ayahGlobalIndex: 99,
      title: "Salam",
      note: "note",
      createdAt: 100,
      updatedAt: 200,
    });
  });

  it("dedupes by surah+ayah and updates existing bookmark", async () => {
    jest.spyOn(Date, "now").mockReturnValue(10_000);

    await AsyncStorage.setItem(
      "quran:bookmarks",
      JSON.stringify([
        {
          id: "bm-1",
          surahNumber: 18,
          ayahNumber: 10,
          ayahGlobalIndex: 20,
          title: "Old",
          note: "keep",
          createdAt: 1_000,
          updatedAt: 2_000,
        },
      ])
    );

    const next = await upsertBookmark({
      surahNumber: 18,
      ayahNumber: 10,
      ayahGlobalIndex: 21,
      title: "  Updated title  ",
      note: "   ",
    });

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: "bm-1",
      surahNumber: 18,
      ayahNumber: 10,
      ayahGlobalIndex: 21,
      title: "Updated title",
      note: undefined,
      createdAt: 1_000,
      updatedAt: 10_000,
    });

    (Date.now as jest.Mock).mockRestore();
  });

  it("returns existing bookmarks when title is empty after trim", async () => {
    await AsyncStorage.setItem(
      "quran:bookmarks",
      JSON.stringify([
        {
          id: "bm-1",
          surahNumber: 1,
          ayahNumber: 1,
          ayahGlobalIndex: 1,
          title: "Al-Fatihah",
          createdAt: 1,
          updatedAt: 1,
        },
      ])
    );

    const next = await upsertBookmark({
      surahNumber: 1,
      ayahNumber: 1,
      ayahGlobalIndex: 1,
      title: "   ",
    });

    expect(next).toHaveLength(1);
    expect(next[0].title).toBe("Al-Fatihah");
  });

  it("deletes by id and keeps state unchanged for blank id", async () => {
    await AsyncStorage.setItem(
      "quran:bookmarks",
      JSON.stringify([
        {
          id: "bm-1",
          surahNumber: 1,
          ayahNumber: 1,
          ayahGlobalIndex: 1,
          title: "A",
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "bm-2",
          surahNumber: 2,
          ayahNumber: 2,
          ayahGlobalIndex: 2,
          title: "B",
          createdAt: 2,
          updatedAt: 2,
        },
      ])
    );

    const unchanged = await deleteBookmark("   ");
    expect(unchanged).toHaveLength(2);

    const next = await deleteBookmark("bm-1");
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("bm-2");
  });

  it("builds stable bookmark keys", () => {
    expect(getBookmarkKey(2, 255)).toBe("2:255");
  });
});
