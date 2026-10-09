import arabicData from "@/assets/data/quran/ar.json";
import englishData from "@/assets/data/quran/en.json";
import {
  fitVerse,
  MIN_ARABIC_SIZE,
  VERSE_FAMILIES,
  type VerseFamily,
} from "@/services/widgets/verseFit";

type Raw = Record<string, { chapter: number; verse: number; text: string }[]>;
const ar = arabicData as Raw;
const en = englishData as Raw;

const allVerses = Object.keys(ar).flatMap((surah) =>
  ar[surah].map((v, i) => ({
    ref: `${v.chapter}:${v.verse}`,
    arabic: v.text,
    english: en[surah][i].text,
  })),
);
const find = (ref: string) => allVerses.find((v) => v.ref === ref)!;

describe("fitVerse", () => {
  it("shows a short verse large, with its English, on the 4x4", () => {
    const v = find("94:5");
    const layout = fitVerse(v.arabic, v.english, "systemLarge");
    expect(layout.arabicSize).toBe(26);
    expect(layout.englishSize).toBeGreaterThan(0);
  });

  it("keeps the English for a short verse on the 4x2 too", () => {
    const v = find("94:5");
    expect(fitVerse(v.arabic, v.english, "systemMedium").englishSize).toBeGreaterThan(0);
  });

  it.each(VERSE_FAMILIES)("drops the English for the longest verse (2:282) on %s", (family) => {
    const v = find("2:282");
    const layout = fitVerse(v.arabic, v.english, family);
    expect(layout.englishSize).toBe(0);
    expect(layout.arabicSize).toBeGreaterThanOrEqual(MIN_ARABIC_SIZE[family]);
  });

  it("drops the English sooner on the 4x2 than on the 4x4", () => {
    const v = find("2:255");
    expect(fitVerse(v.arabic, v.english, "systemMedium").englishSize).toBe(0);
    expect(fitVerse(v.arabic, v.english, "systemLarge").englishSize).toBeGreaterThan(0);
  });

  it.each(VERSE_FAMILIES)("fits every verse in the Quran at or above the minimum size on %s", (family) => {
    expect(allVerses).toHaveLength(6236);
    const tooSmall = allVerses.filter(
      (v) => fitVerse(v.arabic, v.english, family).arabicSize < MIN_ARABIC_SIZE[family],
    );
    expect(tooSmall.map((v) => v.ref)).toEqual([]);
  });

  it.each(VERSE_FAMILIES)("never picks a bigger Arabic size for a longer verse on %s", (family: VerseFamily) => {
    const letters = (s: string) => s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").length;
    const sorted = [...allVerses].sort((a, b) => letters(a.arabic) - letters(b.arabic));
    let previous = Infinity;
    for (const v of sorted) {
      const { arabicSize } = fitVerse(v.arabic, "", family);
      expect(arabicSize).toBeLessThanOrEqual(previous);
      previous = arabicSize;
    }
  });
});
