import { NormalizedAyah } from "@/services/quranData";

const ARABIC_INDIC = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toArabicNumerals(n: number): string {
  return String(n)
    .split("")
    .map((d) => ARABIC_INDIC[parseInt(d, 10)] ?? d)
    .join("");
}

export function formatArabicRef(ayah: NormalizedAyah): string {
  const surah = toArabicNumerals(ayah.surahNumber);
  const ayahNum = toArabicNumerals(ayah.ayahNumber);
  return `﴿${ayah.surahNameAr} ${surah}:${ayahNum}﴾`;
}

export function formatEnglishRef(ayah: NormalizedAyah): string {
  return `— Quran ${ayah.surahNumber}:${ayah.ayahNumber} (${ayah.surahNameEn})`;
}

export type CopyOptions = {
  arabic: boolean;
  english: boolean;
  transliteration: boolean;
};

/**
 * Formats ayah text for clipboard.
 *
 * Format rules:
 * - Arabic block: prefixed with the Arabic reference ﴿سورة ٢:٢٥٥﴾
 * - English block: suffixed with the English reference — Quran 2:255 (Name)
 * - If no English block, append English ref after last block
 * - Blocks separated by double newline
 */
export function formatCopyText(ayah: NormalizedAyah, options: CopyOptions): string {
  const hasArabic = options.arabic && Boolean(ayah.arabicText);
  const hasTranslit = options.transliteration && Boolean(ayah.transliteration);
  const hasEnglish = options.english && Boolean(ayah.englishText);

  const parts: string[] = [];

  if (hasArabic) {
    parts.push(`${formatArabicRef(ayah)}\n${ayah.arabicText}`);
  }

  if (hasTranslit) {
    parts.push(ayah.transliteration!);
  }

  if (hasEnglish) {
    parts.push(`${ayah.englishText}\n${formatEnglishRef(ayah)}`);
  } else {
    // No English block — append English ref to last block for context
    if (parts.length > 0) {
      parts[parts.length - 1] += `\n${formatEnglishRef(ayah)}`;
    }
  }

  return parts.join("\n\n");
}
