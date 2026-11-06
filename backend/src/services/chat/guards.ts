import { ENV } from "../../config/env.js";
import { getHadiths, getQuranAyahs } from "./sourceSearch.js";

const ATTRIBUTION = /\b(?:Allah|God|the Prophet|Messenger|Qur'an|Qur’an|Quran|hadith|narrated|reported)\b/gi;
// Straight single quotes only count away from letters, so apostrophes ("Allah's") don't open a quote.
const QUOTED = /"([^"]+)"|“([^”]+)”|‘([^’]+)’|(?<!\w)'([^']+)'(?!\w)/g;
const MAX_GAP = 60;
const MIN_WORDS = 4;
const MAX_CITATIONS = 6;

// Answers are English, so 4+ Arabic words in a row are almost always quoted verse or hadith text.
const ARABIC_WORD = "[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+";
const ARABIC_RUN = new RegExp(`${ARABIC_WORD}(?:[^\\S\\n]+${ARABIC_WORD}){3,}`, "g");

const merge = (spans: [number, number][]): [number, number][] =>
  spans
    .sort((a, b) => a[0] - b[0])
    .reduce<[number, number][]>((out, span) => {
      const last = out[out.length - 1];
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else out.push([...span]);
      return out;
    }, []);

/** Quoted spans of 4+ words that open within 60 characters after an attribution word, plus Arabic runs of 4+ words. */
function religiousQuoteSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const m of text.matchAll(ARABIC_RUN)) spans.push([m.index!, m.index! + m[0].length]);
  for (const m of text.matchAll(QUOTED)) {
    const inner = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    if (inner.trim().split(/\s+/).length < MIN_WORDS) continue;
    const start = m.index!;
    const window = text.slice(Math.max(0, start - MAX_GAP - 20), start);
    const attributed = [...window.matchAll(ATTRIBUTION)].some((a) => window.length - (a.index! + a[0].length) <= MAX_GAP);
    if (attributed) spans.push([start, start + m[0].length]);
  }
  return merge(spans);
}

/** True when the model quoted what looks like a verse or hadith instead of citing it by ID. */
export function findReligiousQuote(text: string): boolean {
  return religiousQuoteSpans(text).length > 0;
}

export function stripReligiousQuotes(text: string): string {
  let out = text;
  for (const [start, end] of religiousQuoteSpans(text).reverse()) {
    out = `${out.slice(0, start)}(see the sources below)${out.slice(end)}`;
  }
  return out;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Removes model and provider names from an answer. */
export function scrubInternals(text: string): string {
  const patterns = [new RegExp(escapeRegex(ENV.OPENAI_MODEL), "gi"), /chatgpt/gi, /\bgpt-\S+/gi, /openai/gi];
  return patterns.reduce((t, p) => t.replace(p, ""), text).replace(/ {2,}/g, " ");
}

export type Citation =
  | { kind: "quran"; surah: number; ayah: number; arabic: string; english: string | null }
  | { kind: "hadith"; id: number; title: string; text: string; arabic: string | null; grade: string; source: string; credit: string };

type Ref = { kind: "quran"; surah: number; ayah: number } | { kind: "hadith"; id: number };

function parseId(id: string): Ref | null {
  const q = /^q:(\d{1,3}):(\d{1,3})$/.exec(id);
  if (q) return { kind: "quran", surah: Number(q[1]), ayah: Number(q[2]) };
  const h = /^h:(\d{1,9})$/.exec(id);
  if (h) return { kind: "hadith", id: Number(h[1]) };
  return null;
}

/**
 * Turns the model's citation IDs into real stored text. Only IDs this
 * request's searches returned are accepted; anything else is dropped.
 */
export async function renderCitations(ids: string[], retrieved: Set<string>): Promise<Citation[]> {
  const refs = [...new Set(ids)]
    .filter((id) => retrieved.has(id))
    .map(parseId)
    .filter((r): r is Ref => r !== null);
  const quranRefs = refs.flatMap((r) => (r.kind === "quran" ? [{ surah: r.surah, ayah: r.ayah }] : []));
  const hadithIds = refs.flatMap((r) => (r.kind === "hadith" ? [r.id] : []));

  const [ayahs, hadiths] = await Promise.all([
    quranRefs.length ? getQuranAyahs(quranRefs) : [],
    hadithIds.length ? getHadiths(hadithIds) : [],
  ]);
  const ayahByKey = new Map(ayahs.map((a) => [`${a.surah}:${a.ayah}`, a]));
  const hadithById = new Map(hadiths.map((h) => [h.id, h]));
  const withEnglish = ENV.CHAT_QURAN_QUOTES === "text";

  const out: Citation[] = [];
  for (const ref of refs) {
    if (ref.kind === "quran") {
      const a = ayahByKey.get(`${ref.surah}:${ref.ayah}`);
      if (a) out.push({ kind: "quran", surah: a.surah, ayah: a.ayah, arabic: a.textAr, english: withEnglish ? a.textEn : null });
    } else {
      const h = hadithById.get(ref.id);
      // HadeethEnc exposes no translator name, so the credit is the site alone.
      if (h) out.push({ kind: "hadith", id: h.id, title: h.title, text: h.textEn, arabic: h.textAr, grade: h.grade, source: h.attribution, credit: "HadeethEnc.com" });
    }
  }
  return out.slice(0, MAX_CITATIONS);
}
