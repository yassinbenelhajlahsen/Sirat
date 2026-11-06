import { describe, expect, it } from "@jest/globals";
import { mapDuasFile, mapHadeethEncItem, mapQuranFiles } from "../src/services/chat/sourceImport.js";

describe("mapQuranFiles", () => {
  it("joins the Arabic and English verses by chapter and verse", () => {
    const ar = { "1": [{ chapter: 1, verse: 1, text: "بِسۡمِ" }, { chapter: 1, verse: 2, text: "ٱلۡحَمۡدُ" }] };
    const en = { "1": [{ chapter: 1, verse: 2, text: "Praise" }, { chapter: 1, verse: 1, text: "In the name" }] };

    expect(mapQuranFiles(ar, en)).toEqual([
      { surah: 1, ayah: 1, textAr: "بِسۡمِ", textEn: "In the name" },
      { surah: 1, ayah: 2, textAr: "ٱلۡحَمۡدُ", textEn: "Praise" },
    ]);
  });

  it("throws when a verse exists in only one language", () => {
    const ar = { "1": [{ chapter: 1, verse: 1, text: "a" }] };
    const en = { "1": [{ chapter: 1, verse: 1, text: "e" }, { chapter: 1, verse: 2, text: "f" }] };

    expect(() => mapQuranFiles(ar, en)).toThrow();
  });
});

describe("mapHadeethEncItem", () => {
  const item = {
    id: "2962",
    title: "Actions are only by intentions",
    hadeeth: "  Umar reported: I heard the Messenger of Allah say: \"Actions are only by intentions...\"\n",
    attribution: "Agreed upon.",
    grade: "Sahih/Authentic.",
    explanation: "This hadith ...",
    hadeeth_ar: "إنما الأعمال بالنيات",
  };

  it("keeps the text, grade and attribution verbatim", () => {
    expect(mapHadeethEncItem(item)).toEqual({
      id: 2962,
      title: "Actions are only by intentions",
      textEn: item.hadeeth,
      textAr: "إنما الأعمال بالنيات",
      grade: "Sahih/Authentic.",
      attribution: "Agreed upon.",
      explanation: "This hadith ...",
    });
  });

  it("returns null without an id", () => {
    expect(mapHadeethEncItem({ ...item, id: undefined })).toBeNull();
    expect(mapHadeethEncItem({ ...item, id: "abc" })).toBeNull();
  });

  it("returns null without English text", () => {
    expect(mapHadeethEncItem({ ...item, hadeeth: "" })).toBeNull();
    expect(mapHadeethEncItem({ ...item, hadeeth: undefined })).toBeNull();
  });

  it("returns null for something that is not an object", () => {
    expect(mapHadeethEncItem(null)).toBeNull();
    expect(mapHadeethEncItem("x")).toBeNull();
  });

  it("stores a missing Arabic text or explanation as null", () => {
    expect(mapHadeethEncItem({ ...item, hadeeth_ar: "", explanation: undefined })).toMatchObject({
      textAr: null,
      explanation: null,
    });
  });
});

describe("mapDuasFile", () => {
  const dua = {
    id: 12,
    category: "travel",
    tags: ["journey", "safety"],
    arabic: "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا",
    english: "Glory to Him who has subjected this to us",
    transliteration: "Subhanal-ladhi sakhkhara lana hadha",
    reference: "Quran 43:13",
    source: "Quran",
  };

  it("reads the app's { duas: [...] } file and keeps every field", () => {
    expect(mapDuasFile({ duas: [dua] })).toEqual([dua]);
  });

  it("also reads a plain array or an object keyed by id", () => {
    expect(mapDuasFile([dua])).toEqual([dua]);
    expect(mapDuasFile({ duas: { "12": dua } })).toEqual([dua]);
  });

  it.each([
    ["a quoted list", `["journey", "safety"]`],
    ["a bracketed list with single quotes", "['journey', 'safety']"],
    ["a comma list", "journey, safety"],
  ])("parses tags given as %s", (_name, tags) => {
    expect(mapDuasFile({ duas: [{ ...dua, tags }] })[0].tags).toEqual(["journey", "safety"]);
  });

  it("stores missing tags as an empty list", () => {
    expect(mapDuasFile({ duas: [{ ...dua, tags: undefined }] })[0].tags).toEqual([]);
  });

  it("sorts by id", () => {
    expect(mapDuasFile({ duas: [{ ...dua, id: 30 }, { ...dua, id: 4 }] }).map((d) => d.id)).toEqual([4, 30]);
  });

  it.each([
    ["no id", { ...dua, id: undefined }],
    ["a non-positive id", { ...dua, id: 0 }],
    ["no Arabic", { ...dua, arabic: "" }],
    ["no English", { ...dua, english: " " }],
    ["no reference", { ...dua, reference: undefined }],
  ])("throws on a dua with %s, so a bad file never half-imports", (_name, bad) => {
    expect(() => mapDuasFile({ duas: [bad] })).toThrow();
  });

  it("throws on a duplicate id", () => {
    expect(() => mapDuasFile({ duas: [dua, dua] })).toThrow(/12/);
  });

  it("throws when the file holds no duas", () => {
    expect(() => mapDuasFile({})).toThrow();
  });
});
