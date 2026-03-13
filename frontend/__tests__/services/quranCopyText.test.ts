import {
  formatArabicRef,
  formatEnglishRef,
  formatCopyText,
} from "@/services/quranCopyText";
import { NormalizedAyah } from "@/services/quranData";

const ayah: NormalizedAyah = {
  surahNumber: 2,
  surahNameAr: "البقرة",
  surahNameEn: "Al-Baqarah",
  juzNumber: 3,
  ayahNumber: 255,
  arabicText: "ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ",
  englishText: "Allah! There is no god but He.",
  transliteration: "Allahu la ilaha illa huwa",
};

describe("formatArabicRef", () => {
  it("uses Arabic-Indic numerals for surah and ayah numbers", () => {
    const result = formatArabicRef(ayah);
    expect(result).toBe("﴿البقرة ٢:٢٥٥﴾");
  });

  it("wraps in Arabic quotation marks", () => {
    expect(formatArabicRef(ayah)).toMatch(/^﴿.*﴾$/);
  });

  it("handles single-digit ayah number", () => {
    const shortAyah = { ...ayah, surahNumber: 1, surahNameAr: "الفاتحة", ayahNumber: 7 };
    expect(formatArabicRef(shortAyah)).toBe("﴿الفاتحة ١:٧﴾");
  });
});

describe("formatEnglishRef", () => {
  it("uses Western numerals", () => {
    expect(formatEnglishRef(ayah)).toBe("— Quran 2:255 (Al-Baqarah)");
  });

  it("includes English surah name in parentheses", () => {
    expect(formatEnglishRef(ayah)).toContain("(Al-Baqarah)");
  });
});

describe("formatCopyText", () => {
  it("formats Arabic-only correctly", () => {
    const result = formatCopyText(ayah, { arabic: true, english: false, transliteration: false });
    expect(result).toContain("﴿البقرة ٢:٢٥٥﴾");
    expect(result).toContain(ayah.arabicText);
    // Should still include English ref since no English block
    expect(result).toContain("— Quran 2:255 (Al-Baqarah)");
    expect(result).not.toContain(ayah.englishText);
  });

  it("formats English-only correctly", () => {
    const result = formatCopyText(ayah, { arabic: false, english: true, transliteration: false });
    expect(result).toContain(ayah.englishText);
    expect(result).toContain("— Quran 2:255 (Al-Baqarah)");
    expect(result).not.toContain("﴿");
    expect(result).not.toContain(ayah.arabicText);
  });

  it("formats transliteration-only correctly", () => {
    const result = formatCopyText(ayah, { arabic: false, english: false, transliteration: true });
    expect(result).toContain(ayah.transliteration);
    // Should append English ref since no English block
    expect(result).toContain("— Quran 2:255 (Al-Baqarah)");
  });

  it("formats all languages: Arabic ref at top, English ref at bottom", () => {
    const result = formatCopyText(ayah, { arabic: true, english: true, transliteration: true });
    const lines = result.split("\n\n");
    // Arabic block is first
    expect(lines[0]).toContain("﴿البقرة ٢:٢٥٥﴾");
    expect(lines[0]).toContain(ayah.arabicText);
    // Transliteration in middle
    expect(lines[1]).toBe(ayah.transliteration);
    // English block last
    expect(lines[2]).toContain(ayah.englishText);
    expect(lines[2]).toContain("— Quran 2:255 (Al-Baqarah)");
  });

  it("formats Arabic + English without transliteration", () => {
    const result = formatCopyText(ayah, { arabic: true, english: true, transliteration: false });
    const lines = result.split("\n\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(ayah.arabicText);
    expect(lines[1]).toContain(ayah.englishText);
    expect(lines[1]).toContain("— Quran 2:255");
  });

  it("handles missing transliteration gracefully", () => {
    const noTranslit = { ...ayah, transliteration: undefined };
    const result = formatCopyText(noTranslit, { arabic: true, english: true, transliteration: true });
    // transliteration block should be skipped
    expect(result).not.toContain("undefined");
    expect(result).toContain(ayah.arabicText);
    expect(result).toContain(ayah.englishText);
  });
});
