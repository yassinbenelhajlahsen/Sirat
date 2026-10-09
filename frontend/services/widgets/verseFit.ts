export const VERSE_FAMILIES = ["systemMedium", "systemLarge"] as const;
export type VerseFamily = (typeof VERSE_FAMILIES)[number];

// Text area of each verse widget in points, after padding and the reference line.
const AREA: Record<VerseFamily, { width: number; height: number }> = {
  systemMedium: { width: 294, height: 100 },
  systemLarge: { width: 294, height: 260 },
};
const GAP = 8;

// shortcut: widths and line heights are averages for the system fonts, not a
// render. Calibrated on a device: 2:282 at 11pt wrapped to 9 lines (about 0.36
// em per character, 1.22 line height); these sit a little above that for margin.
const ARABIC_WIDTH = 0.38;
const ARABIC_LINE = 1.3;
const ENGLISH_WIDTH = 0.5;
const ENGLISH_LINE = 1.3;

// The 4x2 floor is lower so the two longest verses (2:282, 24:31) still show whole.
export const MIN_ARABIC_SIZE: Record<VerseFamily, number> = { systemMedium: 9, systemLarge: 11 };

export type VerseLayout = {
  arabicSize: number;
  // 0 when the English is dropped to make the Arabic fit. Not null: the native
  // widget storage cannot convert null.
  englishSize: number;
};

// Diacritics are zero-width, so they must not count toward line length.
const ARABIC_MARKS = /[ً-ٰٟۖ-ۭ࣓-ࣿ]/g;

function textHeight(text: string, size: number, width: number, line: number, areaWidth: number): number {
  const perLine = Math.max(1, Math.floor(areaWidth / (size * width)));
  return Math.ceil(text.length / perLine) * size * line;
}

// Arabic and English together, biggest first.
const WITH_ENGLISH: VerseLayout[] = [
  { arabicSize: 26, englishSize: 14 },
  { arabicSize: 20, englishSize: 12 },
  { arabicSize: 16, englishSize: 11 },
  { arabicSize: 14, englishSize: 11 },
];

/**
 * Picks the largest layout in which the whole verse fits: Arabic with English,
 * then Arabic alone shrunk until it fits. Never truncates.
 */
export function fitVerse(arabic: string, english: string, family: VerseFamily): VerseLayout {
  const { width, height } = AREA[family];
  const letters = arabic.replace(ARABIC_MARKS, "");
  const arabicHeight = (size: number) => textHeight(letters, size, ARABIC_WIDTH, ARABIC_LINE, width);
  const englishHeight = (size: number) => textHeight(english, size, ENGLISH_WIDTH, ENGLISH_LINE, width);

  for (const c of WITH_ENGLISH) {
    if (arabicHeight(c.arabicSize) + GAP + englishHeight(c.englishSize) <= height) return c;
  }

  const min = MIN_ARABIC_SIZE[family];
  for (let size = 20; size > min; size--) {
    if (arabicHeight(size) <= height) return { arabicSize: size, englishSize: 0 };
  }
  return { arabicSize: min, englishSize: 0 };
}
