import rawMetaData from "@/assets/data/quran/meta.json";
import rawQuranData from "@/assets/data/quran/quran.json";

/**
 * Raw data types as shipped in the JSON assets. These mirror the existing
 * content so the normalization logic can stay type-safe without guessing.
 */
type RawVerse = {
  id: number;
  text: string;
  translation: string;
};

type RawSurah = {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  type: string;
  total_verses: number;
  verses: RawVerse[];
};

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

export type NormalizedAyah = {
  surahNumber: number;
  surahNameAr: string;
  surahNameEn: string;
  juzNumber: number;
  ayahNumber: number;
  arabicText: string;
  englishText: string;
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

const rawQuran = rawQuranData as RawSurah[];
const rawMeta = rawMetaData as RawMetaRecord[];

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

  const ayatAccumulator: NormalizedAyah[] = [];
  const surahAccumulator: NormalizedSurahMeta[] = [];
  const lookup = new Map<string, number>();

  for (const surah of rawQuran) {
    const meta = metaBySurah.get(surah.id);
    if (!meta) {
      throw new Error(`Missing metadata entry for surah ${surah.id}`);
    }

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
          endAyah: Number.isFinite(endAyah) ? endAyah : surah.total_verses,
        };
      })
      .filter(Boolean) as NormalizedSurahMeta["juzRanges"];

    const sortedJuzRanges = [...juzRanges].sort(
      (a, b) => a.startAyah - b.startAyah
    );

    const arabicName = meta.titleAr?.trim() || surah.name;
    const englishName =
      meta.title?.trim() || surah.transliteration || surah.translation;
    const fallbackJuz = sortedJuzRanges[0]?.juzNumber ?? 1;

    const normalizedSurah: NormalizedSurahMeta = {
      surahNumber: surah.id,
      arabicName,
      englishName,
      ayahCount: surah.verses.length,
      revelationPlace: meta.place,
      revelationType: meta.type,
      pages: meta.pages,
      juzRanges: sortedJuzRanges,
    };

    surahAccumulator.push(normalizedSurah);

    for (const verse of surah.verses) {
      const matchingJuz = sortedJuzRanges.find(
        (range) => verse.id >= range.startAyah && verse.id <= range.endAyah
      );

      const normalizedAyah: NormalizedAyah = {
        surahNumber: surah.id,
        surahNameAr: arabicName,
        surahNameEn: englishName,
        juzNumber: matchingJuz?.juzNumber ?? fallbackJuz,
        ayahNumber: verse.id,
        arabicText: verse.text,
        englishText: verse.translation,
      };

      const globalIndex = ayatAccumulator.length;
      ayatAccumulator.push(normalizedAyah);
      lookup.set(buildLookupKey(surah.id, verse.id), globalIndex);
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
