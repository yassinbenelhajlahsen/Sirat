import { describe, expect, it } from "@jest/globals";
import { mapHadeethEncItem, mapQuranFiles } from "../src/services/chat/sourceImport.js";

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
