// Pure mappers for scripts/importQuran.ts, importHadeethEnc.ts and importDuas.ts.

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

export type DuaRow = {
  id: number;
  category: string;
  tags: string[];
  arabic: string;
  english: string;
  transliteration: string;
  reference: string;
  source: string;
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

// The app's file holds real arrays, but a list-looking string ("['a', 'b']") is tolerated.
const parseTags = (v: unknown): string[] => {
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.replace(/^\s*\[|\]\s*$/g, "").split(",") : [];
  return items.map((t) => str(t).trim().replace(/^["']|["']$/g, "").trim()).filter(Boolean);
};

/**
 * `frontend/assets/data/duas.json`: `{ duas: [...] }`, or a bare array or object of duas.
 * Throws on any bad dua so a broken file never half-imports.
 */
export function mapDuasFile(file: unknown): DuaRow[] {
  const root = (file as { duas?: unknown } | null)?.duas ?? file;
  const items = root && typeof root === "object" ? Object.values(root) : [];
  if (!items.length) throw new Error("No duas in file");
  const seen = new Set<number>();
  const rows = items.map((item) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const id = Number(r.id);
    const row = {
      id,
      category: str(r.category),
      tags: parseTags(r.tags),
      arabic: str(r.arabic),
      english: str(r.english),
      transliteration: str(r.transliteration),
      reference: str(r.reference),
      source: str(r.source),
    };
    if (!Number.isInteger(id) || id <= 0) throw new Error(`Dua has no valid id: ${JSON.stringify(r.id)}`);
    if (!row.arabic.trim() || !row.english.trim() || !row.reference.trim()) throw new Error(`Dua ${id} is missing Arabic, English or reference`);
    if (seen.has(id)) throw new Error(`Duplicate dua id ${id}`);
    seen.add(id);
    return row;
  });
  return rows.sort((a, b) => a.id - b.id);
}
