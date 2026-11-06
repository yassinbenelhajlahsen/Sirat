// Usage: npm run import:hadith
// Copies every English hadith from the HadeethEnc API into `hadiths`.
// HadeethEnc's terms require keeping the copy current: re-run monthly. Safe to re-run.
import "dotenv/config";
import { prisma } from "../src/db/prisma.js";
import { mapHadeethEncItem, type HadithRow } from "../src/services/chat/sourceImport.js";

const API = "https://hadeethenc.com/api/v1";
const REQUEST_GAP_MS = 200; // about 5 requests per second
const BATCH = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(pathAndQuery: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    await sleep(REQUEST_GAP_MS);
    try {
      const res = await fetch(`${API}${pathAndQuery}`, { signal: AbortSignal.timeout(15_000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 3) throw new Error(`${pathAndQuery} failed: ${(err as Error).message}`);
      await sleep(1000 * attempt);
    }
  }
}

async function save(rows: HadithRow[]): Promise<void> {
  if (!rows.length) return;
  await prisma.$executeRaw`
    INSERT INTO hadiths (id, title, text_en, text_ar, grade, attribution, explanation, updated_at)
    SELECT *, now() FROM unnest(
      ${rows.map((r) => r.id)}::int[],
      ${rows.map((r) => r.title)}::text[],
      ${rows.map((r) => r.textEn)}::text[],
      ${rows.map((r) => r.textAr)}::text[],
      ${rows.map((r) => r.grade)}::text[],
      ${rows.map((r) => r.attribution)}::text[],
      ${rows.map((r) => r.explanation)}::text[])
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title, text_en = EXCLUDED.text_en, text_ar = EXCLUDED.text_ar,
      grade = EXCLUDED.grade, attribution = EXCLUDED.attribution,
      explanation = EXCLUDED.explanation, updated_at = EXCLUDED.updated_at`;
}

// Root categories include their sub-categories' hadiths, so listing the roots finds every id.
const roots = (await get("/categories/roots/?language=en")) as { id: string }[];
const ids = new Set<number>();
for (const root of roots) {
  const page = (await get(`/hadeeths/list/?language=en&category_id=${root.id}&page=1&per_page=5000`)) as {
    data: { id: string }[];
    meta: { last_page: number };
  };
  if (page.meta.last_page > 1) throw new Error(`Category ${root.id} has more than one page; raise per_page`);
  for (const h of page.data) ids.add(Number(h.id));
}
console.log(`Found ${ids.size} hadith ids`);

let saved = 0;
let skipped = 0;
let batch: HadithRow[] = [];
for (const id of ids) {
  const row = mapHadeethEncItem(await get(`/hadeeths/one/?language=en&id=${id}`));
  if (row) batch.push(row);
  else skipped++;
  if (batch.length >= BATCH) {
    await save(batch);
    saved += batch.length;
    batch = [];
    console.log(`${saved} saved`);
  }
}
await save(batch);
saved += batch.length;

console.log(`Done: ${saved} saved, ${skipped} skipped. hadiths: ${await prisma.hadith.count()} rows`);
await prisma.$disconnect();
