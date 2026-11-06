import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockQueryRaw: jest.Mock = jest.fn();
const mockAyahFindMany: jest.Mock = jest.fn();
const mockHadithFindMany: jest.Mock = jest.fn();

describe("source search", () => {
  beforeEach(() => {
    jest.resetModules();
    mockQueryRaw.mockReset();
    mockAyahFindMany.mockReset();
    mockHadithFindMany.mockReset();
    jest.unstable_mockModule("../src/db/prisma.js", () => ({
      prisma: {
        $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
        quranAyah: { findMany: (...a: unknown[]) => mockAyahFindMany(...a) },
        hadith: { findMany: (...a: unknown[]) => mockHadithFindMany(...a) },
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
});
