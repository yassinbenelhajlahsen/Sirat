// Text area of the 4x4 verse widget, in points, after padding and the reference line.
const AREA_WIDTH = 294;
const AREA_HEIGHT = 260;
const GAP = 10;

// shortcut: widths and line heights are averages for the system fonts, not a
// render. Calibrated on a device: 2:282 at 11pt wrapped to 9 lines (about 0.36
// em per character, 1.22 line height); these sit a little above that for margin.
const ARABIC_WIDTH = 0.38;
const ARABIC_LINE = 1.3;
const ENGLISH_WIDTH = 0.5;
const ENGLISH_LINE = 1.3;

export const MIN_ARABIC_SIZE = 11;

export type VerseLayout = {
  tier: 1 | 2 | 3;
  arabicSize: number;
  // 0 when the English is dropped to make the Arabic fit. Not null: the native
  // widget storage cannot convert null.
  englishSize: number;
};

// Diacritics are zero-width, so they must not count toward line length.
const ARABIC_MARKS = /[ً-ٰٟۖ-ۭ࣓-ࣿ]/g;

function textHeight(text: string, size: number, width: number, line: number): number {
  const perLine = Math.max(1, Math.floor(AREA_WIDTH / (size * width)));
  return Math.ceil(text.length / perLine) * size * line;
}

/**
 * Picks the largest layout in which the whole verse fits: Arabic with English,
 * then smaller Arabic with English, then Arabic alone shrunk until it fits.
 * Never truncates.
 */
export function fitVerse(arabic: string, english: string): VerseLayout {
  const letters = arabic.replace(ARABIC_MARKS, "");
  const arabicHeight = (size: number) => textHeight(letters, size, ARABIC_WIDTH, ARABIC_LINE);
  const englishHeight = (size: number) => textHeight(english, size, ENGLISH_WIDTH, ENGLISH_LINE);

  const withEnglish: { tier: 1 | 2; arabicSize: number; englishSize: number }[] = [
    { tier: 1, arabicSize: 26, englishSize: 14 },
    { tier: 2, arabicSize: 20, englishSize: 12 },
  ];
  for (const c of withEnglish) {
    if (arabicHeight(c.arabicSize) + GAP + englishHeight(c.englishSize) <= AREA_HEIGHT) {
      return c;
    }
  }

  for (let size = 20; size > MIN_ARABIC_SIZE; size--) {
    if (arabicHeight(size) <= AREA_HEIGHT) {
      return { tier: 3, arabicSize: size, englishSize: 0 };
    }
  }
  return { tier: 3, arabicSize: MIN_ARABIC_SIZE, englishSize: 0 };
}
