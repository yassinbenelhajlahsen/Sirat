import arabicData from "@/assets/data/quran/ar.json";
import englishData from "@/assets/data/quran/en.json";
import { fitVerse, MIN_ARABIC_SIZE } from "@/services/widgets/verseFit";

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
  it("shows Arabic and English at the comfortable size for a short verse", () => {
    const v = find("94:5");
    const layout = fitVerse(v.arabic, v.english);
    expect(layout.tier).toBe(1);
    expect(layout.englishSize).toBeGreaterThan(0);
  });

  it("drops the English once the verse gets long", () => {
    const v = find("2:255");
    const layout = fitVerse(v.arabic, v.english);
    expect(layout.tier).toBe(3);
    expect(layout.englishSize).toBe(0);
  });

  it("fits the longest verse (2:282) at a legible Arabic-only size", () => {
    const v = find("2:282");
    const layout = fitVerse(v.arabic, v.english);
    expect(layout.tier).toBe(3);
    expect(layout.arabicSize).toBeGreaterThanOrEqual(MIN_ARABIC_SIZE);
  });

  it("fits every verse in the Quran at or above the minimum size", () => {
    expect(allVerses).toHaveLength(6236);
    const tooSmall = allVerses.filter(
      (v) => fitVerse(v.arabic, v.english).arabicSize < MIN_ARABIC_SIZE,
    );
    expect(tooSmall.map((v) => v.ref)).toEqual([]);
  });

  it("never picks a bigger Arabic size for a longer verse", () => {
    const letters = (s: string) => s.replace(/[ً-ٰٟۖ-ۭ]/g, "").length;
    const sorted = [...allVerses].sort((a, b) => letters(a.arabic) - letters(b.arabic));
    let previous = Infinity;
    for (const v of sorted) {
      const { arabicSize } = fitVerse(v.arabic, "");
      expect(arabicSize).toBeLessThanOrEqual(previous);
      previous = arabicSize;
    }
  });
});
