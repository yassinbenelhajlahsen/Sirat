import type { Citation } from "@/services/chat/chatApi";
import { getSurahMeta } from "@/services/quranData";

export type GradeTone = "authentic" | "good" | "other";

// Matches the server's citation id format. Empty for a kind this build does not know (saved by a newer one).
export function citationKey(c: Citation): string {
  if (c.kind === "quran") return `q:${c.surah}:${c.ayah}`;
  if (c.kind === "hadith") return `h:${c.id}`;
  if (c.kind === "dua") return `d:${c.id}`;
  return "";
}

export function gradeTone(grade: string): GradeTone {
  const g = grade.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/authentic|sahih/.test(g)) return "authentic";
  if (/good|hasan/.test(g)) return "good";
  return "other";
}

export function surahLabel(surah: number): string {
  try {
    return getSurahMeta().find((s) => s.surahNumber === surah)?.englishName ?? `Surah ${surah}`;
  } catch {
    // Quran data is preloaded at startup but can still be missing here.
    return `Surah ${surah}`;
  }
}

export function sourceRefLine(c: Citation, surahName: (surah: number) => string): string {
  if (c.kind === "quran") return `Quran ${c.surah}:${c.ayah} (${surahName(c.surah)})`;
  if (c.kind === "hadith") return `${c.source} (${c.grade})`;
  return c.reference;
}
