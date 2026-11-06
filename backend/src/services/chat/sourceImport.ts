// Pure mappers for scripts/importQuran.ts and scripts/importHadeethEnc.ts.

export type QuranRow = { surah: number; ayah: number; textAr: string; textEn: string };
export type HadithRow = {
  id: number;
  title: string;
  textEn: string;
  textAr: string | null;
  grade: string;
  attribution: string;
  explanation: string | null;
};

type VerseFile = Record<string, { chapter: number; verse: number; text: string }[]>;

const verseMap = (file: unknown): Map<string, string> => {
  const map = new Map<string, string>();
  for (const verses of Object.values(file as VerseFile)) {
    for (const v of verses) map.set(`${v.chapter}:${v.verse}`, v.text);
  }
  return map;
};

/** Joins the app's `frontend/assets/data/quran/{ar,en}.json` by chapter and verse. */
export function mapQuranFiles(ar: unknown, en: unknown): QuranRow[] {
  const arabic = verseMap(ar);
  const english = verseMap(en);
  if (arabic.size !== english.size) throw new Error("Arabic and English Quran files differ in verse count");
  const rows: QuranRow[] = [];
  for (const [key, textEn] of english) {
    const textAr = arabic.get(key);
    if (textAr === undefined) throw new Error(`No Arabic text for ${key}`);
    const [surah, ayah] = key.split(":").map(Number);
    rows.push({ surah, ayah, textAr, textEn });
  }
  return rows.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * One `/hadeeths/one` record. HadeethEnc's terms forbid altering the text,
 * so every string is kept exactly as served.
 */
export function mapHadeethEncItem(item: unknown): HadithRow | null {
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const id = Number(r.id);
  const textEn = str(r.hadeeth);
  if (!Number.isInteger(id) || id <= 0 || !textEn.trim()) return null;
  return {
    id,
    title: str(r.title),
    textEn,
    textAr: str(r.hadeeth_ar) || null,
    grade: str(r.grade),
    attribution: str(r.attribution),
    explanation: str(r.explanation) || null,
  };
}
