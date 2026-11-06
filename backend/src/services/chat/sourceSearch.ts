import { prisma } from "../../db/prisma.js";

/** What the model sees from a search. IDs: `q:<surah>:<ayah>` and `h:<hadeethencId>`. */
export type SourceHit = { id: string; text: string; grade?: string };

const MAX_HIT_TEXT = 800;
const clip = (text: string) => text.slice(0, MAX_HIT_TEXT);

// websearch_to_tsquery needs every word to match, which often finds nothing for
// a model-written query. When it does, try again needing any one word.
async function withAnyWordFallback<T>(query: string, run: (q: string) => Promise<T[]>): Promise<T[]> {
  const rows = await run(query);
  const words = query.trim().split(/\s+/);
  if (rows.length || words.length < 2 || /\bor\b|"/i.test(query)) return rows;
  return run(words.join(" or "));
}

export async function searchQuran(query: string, limit = 5): Promise<SourceHit[]> {
  if (!query.trim()) return [];
  const rows = await withAnyWordFallback(query, (q) => prisma.$queryRaw<{ surah: number; ayah: number; text_en: string }[]>`
    SELECT surah, ayah, text_en
    FROM quran_ayahs, websearch_to_tsquery('english', ${q}) q
    WHERE to_tsvector('english', text_en) @@ q
    ORDER BY ts_rank(to_tsvector('english', text_en), q) DESC
    LIMIT ${limit}`);
  return rows.map((r) => ({ id: `q:${r.surah}:${r.ayah}`, text: clip(r.text_en) }));
}

export async function searchHadith(query: string, limit = 5): Promise<SourceHit[]> {
  if (!query.trim()) return [];
  const rows = await withAnyWordFallback(query, (q) => prisma.$queryRaw<{ id: number; title: string; text_en: string; grade: string }[]>`
    SELECT id, title, text_en, grade
    FROM hadiths, websearch_to_tsquery('english', ${q}) q
    WHERE to_tsvector('english', title || ' ' || text_en) @@ q
    ORDER BY ts_rank(to_tsvector('english', title || ' ' || text_en), q) DESC
    LIMIT ${limit}`);
  return rows.map((r) => ({ id: `h:${r.id}`, text: clip(`${r.title}: ${r.text_en}`), grade: r.grade }));
}

export async function getQuranAyahs(
  refs: { surah: number; ayah: number }[],
): Promise<{ surah: number; ayah: number; textAr: string; textEn: string }[]> {
  if (!refs.length) return [];
  return prisma.quranAyah.findMany({
    where: { OR: refs.map(({ surah, ayah }) => ({ surah, ayah })) },
    select: { surah: true, ayah: true, textAr: true, textEn: true },
  });
}

export async function getHadiths(
  ids: number[],
): Promise<{ id: number; title: string; textEn: string; textAr: string | null; grade: string; attribution: string }[]> {
  if (!ids.length) return [];
  return prisma.hadith.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, textEn: true, textAr: true, grade: true, attribution: true },
  });
}
