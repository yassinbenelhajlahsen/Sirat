import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockQueryRaw: jest.Mock = jest.fn();
const mockAyahFindMany: jest.Mock = jest.fn();
const mockHadithFindMany: jest.Mock = jest.fn();
const mockDuaFindMany: jest.Mock = jest.fn();

describe("source search", () => {
  beforeEach(() => {
    jest.resetModules();
    mockQueryRaw.mockReset();
    mockAyahFindMany.mockReset();
    mockHadithFindMany.mockReset();
    mockDuaFindMany.mockReset();
    jest.unstable_mockModule("../src/db/prisma.js", () => ({
      prisma: {
        $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
        quranAyah: { findMany: (...a: unknown[]) => mockAyahFindMany(...a) },
        hadith: { findMany: (...a: unknown[]) => mockHadithFindMany(...a) },
        chatDua: { findMany: (...a: unknown[]) => mockDuaFindMany(...a) },
      },
    }));
  });

  const load = async () => await import("../src/services/chat/sourceSearch.js");
  const injection = "riba'); DROP TABLE quran_ayahs; --";

  it("passes the Quran query as a bound parameter, never in the SQL text", async () => {
    (mockQueryRaw as any).mockResolvedValue([]);
    const { searchQuran } = await load();

    await searchQuran(injection);

    const [strings, ...values] = mockQueryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join("")).not.toContain("DROP TABLE");
    expect(values).toContain(injection);
    expect(strings.join("")).toMatch(/websearch_to_tsquery\('english'/);
  });

  it("returns Quran hits as q:<surah>:<ayah> with text cut to 800 characters", async () => {
    (mockQueryRaw as any).mockResolvedValue([{ surah: 2, ayah: 275, text_en: "x".repeat(1000) }]);
    const { searchQuran } = await load();

    const [hit] = await searchQuran("riba");

    expect(hit.id).toBe("q:2:275");
    expect(hit.text).toHaveLength(800);
  });

  it("returns hadith hits as h:<id> with their grade, binding the query", async () => {
    (mockQueryRaw as any).mockResolvedValue([{ id: 2962, title: "Intentions", text_en: "Umar reported...", grade: "Sahih/Authentic." }]);
    const { searchHadith } = await load();

    const hits = await searchHadith(injection, 3);

    const [strings, ...values] = mockQueryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join("")).not.toContain("DROP TABLE");
    expect(values).toEqual(expect.arrayContaining([injection, 3]));
    expect(hits).toEqual([{ id: "h:2962", text: "Intentions: Umar reported...", grade: "Sahih/Authentic." }]);
  });

  it("retries with any-word matching when every-word matching finds nothing", async () => {
    (mockQueryRaw as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ surah: 94, ayah: 5, text_en: "with hardship [will be] ease" }]);
    const { searchQuran } = await load();

    const hits = await searchQuran("patience hardship ease");

    expect(hits.map((h) => h.id)).toEqual(["q:94:5"]);
    const [, ...retryValues] = mockQueryRaw.mock.calls[1] as [TemplateStringsArray, ...unknown[]];
    expect(retryValues).toContain("patience or hardship or ease");
  });

  it("does not retry a one-word query", async () => {
    (mockQueryRaw as any).mockResolvedValue([]);
    const { searchHadith } = await load();

    await searchHadith("riba");

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns nothing for a blank query without touching the database", async () => {
    const { searchQuran, searchHadith } = await load();

    expect(await searchQuran("   ")).toEqual([]);
    expect(await searchHadith("")).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("looks up ayahs and hadiths by key, skipping the query when empty", async () => {
    (mockAyahFindMany as any).mockResolvedValue([{ surah: 2, ayah: 275, textAr: "a", textEn: "e" }]);
    (mockHadithFindMany as any).mockResolvedValue([]);
    const { getQuranAyahs, getHadiths } = await load();

    expect(await getQuranAyahs([{ surah: 2, ayah: 275 }])).toEqual([{ surah: 2, ayah: 275, textAr: "a", textEn: "e" }]);
    expect(mockAyahFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ surah: 2, ayah: 275 }] },
    }));
    expect(await getQuranAyahs([])).toEqual([]);
    expect(await getHadiths([])).toEqual([]);
    expect(mockAyahFindMany).toHaveBeenCalledTimes(1);
    expect(mockHadithFindMany).not.toHaveBeenCalled();
  });

  it("returns dua hits as d:<id> with category and English, binding the query", async () => {
    (mockQueryRaw as any).mockResolvedValue([{ id: 12, category: "travel", english: "Glory to Him who has subjected this to us" }]);
    const { searchDuas } = await load();

    const hits = await searchDuas(injection, 3);

    const [strings, ...values] = mockQueryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join("");
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).toMatch(/websearch_to_tsquery\('english'/);
    expect(sql).toMatch(/FROM duas/);
    expect(sql).toMatch(/english/);
    expect(sql).toMatch(/category/);
    expect(sql).toMatch(/tags/);
    expect(values).toEqual(expect.arrayContaining([injection, 3]));
    expect(hits).toEqual([{ id: "d:12", text: "travel: Glory to Him who has subjected this to us" }]);
  });

  it("retries a dua search with any-word matching, and skips a blank one", async () => {
    (mockQueryRaw as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 2, category: "anxiety", english: "Allah is sufficient for me" }]);
    const { searchDuas } = await load();

    expect((await searchDuas("exam stress")).map((h) => h.id)).toEqual(["d:2"]);
    const [, ...retryValues] = mockQueryRaw.mock.calls[1] as [TemplateStringsArray, ...unknown[]];
    expect(retryValues).toContain("exam or stress");

    mockQueryRaw.mockClear();
    expect(await searchDuas("  ")).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("looks up duas by id, skipping the query when empty", async () => {
    (mockDuaFindMany as any).mockResolvedValue([{ id: 12, arabic: "a", transliteration: "t", english: "e", reference: "Quran 43:13" }]);
    const { getDuas } = await load();

    expect(await getDuas([12])).toEqual([{ id: 12, arabic: "a", transliteration: "t", english: "e", reference: "Quran 43:13" }]);
    expect(mockDuaFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [12] } } }));
    expect(await getDuas([])).toEqual([]);
    expect(mockDuaFindMany).toHaveBeenCalledTimes(1);
  });
});
