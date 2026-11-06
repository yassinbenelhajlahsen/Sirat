// Usage: npm run import:quran -- <path to frontend/assets/data/quran>
// Loads the app's own Quran text into quran_ayahs. Safe to re-run.
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/db/prisma.js";
import { mapQuranFiles } from "../src/services/chat/sourceImport.js";

const EXPECTED_AYAHS = 6236;

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: npm run import:quran -- <path to frontend/assets/data/quran>");
  process.exit(1);
}

const read = (name: string) => JSON.parse(readFileSync(path.join(dir, name), "utf8"));
const rows = mapQuranFiles(read("ar.json"), read("en.json"));
if (rows.length !== EXPECTED_AYAHS) throw new Error(`Expected ${EXPECTED_AYAHS} ayahs, got ${rows.length}`);

await prisma.$executeRaw`
  INSERT INTO quran_ayahs (surah, ayah, text_ar, text_en)
  SELECT * FROM unnest(
    ${rows.map((r) => r.surah)}::int[],
    ${rows.map((r) => r.ayah)}::int[],
    ${rows.map((r) => r.textAr)}::text[],
    ${rows.map((r) => r.textEn)}::text[])
  ON CONFLICT (surah, ayah) DO UPDATE SET text_ar = EXCLUDED.text_ar, text_en = EXCLUDED.text_en`;

console.log(`quran_ayahs: ${await prisma.quranAyah.count()} rows`);
await prisma.$disconnect();
