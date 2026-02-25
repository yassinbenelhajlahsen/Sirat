type QuranDataModule = typeof import("@/services/quranData");

function loadQuranDataModule(): QuranDataModule {
  jest.resetModules();
  return require("@/services/quranData") as QuranDataModule;
}

describe("services/quranData preload contract", () => {
  it("throws before preload when reading ayat", () => {
    const mod = loadQuranDataModule();

    expect(() => mod.getAllAyat()).toThrow(
      "Quran data has not been preloaded. Call preloadQuranData() during app startup first."
    );
  });

  it("preloads successfully and exposes stable cached collections", async () => {
    const mod = loadQuranDataModule();

    await expect(mod.preloadQuranData()).resolves.toBeUndefined();

    const ayatFirstRead = mod.getAllAyat();
    const surahsFirstRead = mod.getSurahMeta();

    await expect(mod.preloadQuranData()).resolves.toBeUndefined();

    const ayatSecondRead = mod.getAllAyat();
    const surahsSecondRead = mod.getSurahMeta();

    expect(ayatFirstRead).toBe(ayatSecondRead);
    expect(surahsFirstRead).toBe(surahsSecondRead);
    expect(ayatFirstRead.length).toBeGreaterThan(6000);
    expect(surahsFirstRead.length).toBe(114);
  });

  it("returns ayah index for existing surah/ayah and throws for missing pair", async () => {
    const mod = loadQuranDataModule();
    await mod.preloadQuranData();

    const firstAyah = mod.getAllAyat()[0];
    const index = mod.getAyatIndexForSurahAndAyah(
      firstAyah.surahNumber,
      firstAyah.ayahNumber
    );

    expect(index).toBe(0);
    expect(mod.getAllAyat()[index]).toMatchObject({
      surahNumber: firstAyah.surahNumber,
      ayahNumber: firstAyah.ayahNumber,
    });

    expect(() => mod.getAyatIndexForSurahAndAyah(999, 999)).toThrow(
      "Ayah 999:999 was not found in the Quran dataset."
    );
  });

  it("produces normalized ayah and surah shapes", async () => {
    const mod = loadQuranDataModule();
    await mod.preloadQuranData();

    const ayah = mod.getAllAyat()[0];
    const surah = mod.getSurahMeta()[0];

    expect(ayah).toEqual(
      expect.objectContaining({
        surahNumber: expect.any(Number),
        surahNameAr: expect.any(String),
        surahNameEn: expect.any(String),
        juzNumber: expect.any(Number),
        ayahNumber: expect.any(Number),
        arabicText: expect.any(String),
        englishText: expect.any(String),
      })
    );
    expect(typeof ayah.transliteration === "string" || ayah.transliteration === undefined).toBe(
      true
    );

    expect(surah).toEqual(
      expect.objectContaining({
        surahNumber: expect.any(Number),
        arabicName: expect.any(String),
        englishName: expect.any(String),
        ayahCount: expect.any(Number),
        revelationPlace: expect.any(String),
        revelationType: expect.any(String),
        pages: expect.any(String),
      })
    );
    expect(Array.isArray(surah.juzRanges)).toBe(true);
    expect(surah.juzRanges.length).toBeGreaterThan(0);
    expect(surah.juzRanges[0]).toEqual(
      expect.objectContaining({
        juzNumber: expect.any(Number),
        startAyah: expect.any(Number),
        endAyah: expect.any(Number),
      })
    );
  });
});
