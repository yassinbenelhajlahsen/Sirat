import rawMetaData from "@/assets/data/quran/meta.json";
import rawArabicData from "@/assets/data/quran/ar.json";
import rawEnglishData from "@/assets/data/quran/en.json";
import rawTransliterationData from "@/assets/data/quran/transliteration.json";

/**
 * Raw data types as shipped in the JSON assets.
 */
type RawVerseDatasetItem = {
  chapter: number;
  verse: number;
  text: string;
};

type RawQuranDataset = Record<string, RawVerseDatasetItem[]>;

type RawMetaJuzRange = {
  index: string;
  verse: {
    start: string;
    end: string;
  };
};

type RawMetaRecord = {
  place: string;
  type: string;
  count: number;
  title: string;
  titleAr: string;
  index: string;
  pages: string;
  juz: RawMetaJuzRange[];
};

type VerseTextLookupInput = {
  datasetName: string;
  surahNumber: number;
  verses: RawVerseDatasetItem[] | undefined;
};

const rawArabic = rawArabicData as RawQuranDataset;
const rawEnglish = rawEnglishData as RawQuranDataset;
const rawTransliteration = rawTransliterationData as RawQuranDataset;
const rawMeta = rawMetaData as RawMetaRecord[];

export type NormalizedAyah = {
  surahNumber: number;
  surahNameAr: string;
  surahNameEn: string;
  juzNumber: number;
  ayahNumber: number;
  arabicText: string;
  englishText: string;
  transliteration?: string;
};

export type NormalizedSurahMeta = {
  surahNumber: number;
  arabicName: string;
  englishName: string;
  ayahCount: number;
  revelationPlace: string;
  revelationType: string;
  pages: string;
  juzRanges: {
    juzNumber: number;
    startAyah: number;
    endAyah: number;
  }[];
};

let cachedAyat: NormalizedAyah[] | null = null;
let cachedSurahs: NormalizedSurahMeta[] | null = null;
let ayahIndexLookup: Map<string, number> | null = null;
let preloadPromise: Promise<void> | null = null;

/** Converts a padded string index (e.g. "001") into a number. */
function parseIndex(value: string | undefined | null): number {
  if (!value) return NaN;
  const numeric = parseInt(value, 10);
  return Number.isNaN(numeric) ? NaN : numeric;
}

/** Extracts the numeric portion from identifiers such as "verse_12". */
function parseVerseIdentifier(value: string | undefined | null): number {
  if (!value) return NaN;
  const match = value.match(/verse_(\d+)/i);
  if (!match) return NaN;
  const numeric = parseInt(match[1], 10);
  return Number.isNaN(numeric) ? NaN : numeric;
}

function ensureLoaded() {
  if (!cachedAyat || !cachedSurahs || !ayahIndexLookup) {
    throw new Error(
      "Quran data has not been preloaded. Call preloadQuranData() during app startup first."
    );
  }
}

function buildLookupKey(surahNumber: number, ayahNumber: number): string {
  return `${surahNumber}:${ayahNumber}`;
}

function buildVerseTextLookup({
  datasetName,
  surahNumber,
  verses,
}: VerseTextLookupInput): Map<number, string> {
  const lookup = new Map<number, string>();

  if (!Array.isArray(verses)) {
    return lookup;
  }

  for (const entry of verses) {
    const chapter = Number(entry.chapter);
    const verseNumber = Number(entry.verse);

    if (!Number.isFinite(chapter) || !Number.isFinite(verseNumber)) {
      continue;
    }

    if (Math.floor(chapter) !== surahNumber) {
      throw new Error(
        `Invalid ${datasetName} verse chapter ${chapter} for surah ${surahNumber}.`
      );
    }

    const normalizedVerseNumber = Math.floor(verseNumber);
    if (normalizedVerseNumber <= 0) {
      continue;
    }

    lookup.set(
      normalizedVerseNumber,
      typeof entry.text === "string" ? entry.text : ""
    );
  }

  return lookup;
}

function normalizeQuranData(): {
  ayat: NormalizedAyah[];
  surahs: NormalizedSurahMeta[];
  lookup: Map<string, number>;
} {
  const metaBySurah = new Map<number, RawMetaRecord>();
  for (const record of rawMeta) {
    const surahNumber = parseIndex(record.index);
    if (!Number.isFinite(surahNumber) || surahNumber <= 0) {
      continue;
    }
    metaBySurah.set(surahNumber, record);
  }

  const surahNumbers = Array.from(metaBySurah.keys()).sort((a, b) => a - b);
  const ayatAccumulator: NormalizedAyah[] = [];
  const surahAccumulator: NormalizedSurahMeta[] = [];
  const lookup = new Map<string, number>();

  for (const surahNumber of surahNumbers) {
    const meta = metaBySurah.get(surahNumber);
    if (!meta) {
      continue;
    }

    const arabicVerses = rawArabic[String(surahNumber)];
    if (!Array.isArray(arabicVerses) || arabicVerses.length === 0) {
      throw new Error(`Missing Arabic verses for surah ${surahNumber}`);
    }

    const ayahCount = arabicVerses.length;

    const juzRanges = (meta.juz || [])
      .map((entry) => {
        const juzNumber = parseIndex(entry.index);
        const startAyah = parseVerseIdentifier(entry.verse?.start);
        const endAyah = parseVerseIdentifier(entry.verse?.end);

        if (!Number.isFinite(juzNumber) || juzNumber <= 0) {
          return null;
        }

        return {
          juzNumber,
          startAyah: Number.isFinite(startAyah) ? startAyah : 1,
          endAyah: Number.isFinite(endAyah) ? endAyah : ayahCount,
        };
      })
      .filter(Boolean) as NormalizedSurahMeta["juzRanges"];

    const sortedJuzRanges = [...juzRanges].sort(
      (a, b) => a.startAyah - b.startAyah
    );

    const arabicName = meta.titleAr?.trim() || "";
    const englishName = meta.title?.trim() || `Surah ${surahNumber}`;
    const fallbackJuz = sortedJuzRanges[0]?.juzNumber ?? 1;

    const normalizedSurah: NormalizedSurahMeta = {
      surahNumber,
      arabicName,
      englishName,
      ayahCount,
      revelationPlace: meta.place,
      revelationType: meta.type,
      pages: meta.pages,
      juzRanges: sortedJuzRanges,
    };

    surahAccumulator.push(normalizedSurah);

    const englishVerseLookup = buildVerseTextLookup({
      datasetName: "English",
      surahNumber,
      verses: rawEnglish[String(surahNumber)],
    });
    const transliterationVerseLookup = buildVerseTextLookup({
      datasetName: "transliteration",
      surahNumber,
      verses: rawTransliteration[String(surahNumber)],
    });

    for (const verse of arabicVerses) {
      const chapter = Number(verse.chapter);
      const ayahNumber = Number(verse.verse);
      if (!Number.isFinite(chapter) || !Number.isFinite(ayahNumber)) {
        continue;
      }

      const normalizedChapter = Math.floor(chapter);
      const normalizedAyahNumber = Math.floor(ayahNumber);
      if (
        normalizedChapter !== surahNumber ||
        !Number.isFinite(normalizedAyahNumber) ||
        normalizedAyahNumber <= 0
      ) {
        continue;
      }

      const matchingJuz = sortedJuzRanges.find(
        (range) =>
          normalizedAyahNumber >= range.startAyah &&
          normalizedAyahNumber <= range.endAyah
      );

      const normalizedAyah: NormalizedAyah = {
        surahNumber,
        surahNameAr: arabicName,
        surahNameEn: englishName,
        juzNumber: matchingJuz?.juzNumber ?? fallbackJuz,
        ayahNumber: normalizedAyahNumber,
        arabicText: typeof verse.text === "string" ? verse.text : "",
        englishText: englishVerseLookup.get(normalizedAyahNumber) ?? "",
        transliteration:
          transliterationVerseLookup.get(normalizedAyahNumber) ?? "",
      };

      const globalIndex = ayatAccumulator.length;
      ayatAccumulator.push(normalizedAyah);
      lookup.set(buildLookupKey(surahNumber, normalizedAyahNumber), globalIndex);
    }
  }

  return { ayat: ayatAccumulator, surahs: surahAccumulator, lookup };
}

export async function preloadQuranData(): Promise<void> {
  if (cachedAyat && cachedSurahs && ayahIndexLookup) {
    return;
  }

  if (!preloadPromise) {
    preloadPromise = (async () => {
      try {
        const { ayat, surahs, lookup } = normalizeQuranData();
        cachedAyat = ayat;
        cachedSurahs = surahs;
        ayahIndexLookup = lookup;
      } finally {
        preloadPromise = null;
      }
    })().catch((error) => {
      cachedAyat = null;
      cachedSurahs = null;
      ayahIndexLookup = null;
      throw error;
    });
  }

  return preloadPromise;
}

export function getAllAyat(): readonly NormalizedAyah[] {
  ensureLoaded();
  return cachedAyat!;
}

export function getSurahMeta(): readonly NormalizedSurahMeta[] {
  ensureLoaded();
  return cachedSurahs!;
}

export function getAyatIndexForSurahAndAyah(
  surahNumber: number,
  ayahNumber: number
): number {
  ensureLoaded();
  const key = buildLookupKey(surahNumber, ayahNumber);
  const index = ayahIndexLookup!.get(key);

  if (typeof index !== "number") {
    throw new Error(
      `Ayah ${surahNumber}:${ayahNumber} was not found in the Quran dataset.`
    );
  }

  return index;
}
