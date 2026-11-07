import { ENV } from "../../config/env.js";
import { getDuas, getHadiths, getQuranAyahs } from "./sourceSearch.js";

const ATTRIBUTION = /\b(?:Allah|God|Prophet|Messenger|Qur'an|Qur’an|Quran|Surah|verses?|ayahs?|ayat|hadith|narrated|reported)\b/gi;
const HAS_ATTRIBUTION = new RegExp(ATTRIBUTION.source, "i");
// Straight single quotes only count away from letters, so apostrophes ("Allah's") don't open a quote.
const QUOTED = /"([^"]+)"|“([^”]+)”|‘([^’]+)’|(?<!\w)'([^']+)'(?!\w)/g;
const MAX_GAP = 60;
const MAX_GAP_AFTER = 40; // "...", the Prophet said.
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

/**
 * Quoted spans of 4+ words with an attribution word up to 60 characters before
 * or 40 after, plus Arabic runs of 4+ words. Deliberately broad: a stripped
 * everyday quote costs less than a model-written verse shown as scripture.
 */
function religiousQuoteSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const m of text.matchAll(ARABIC_RUN)) spans.push([m.index!, m.index! + m[0].length]);
  for (const m of text.matchAll(QUOTED)) {
    const inner = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    if (inner.trim().split(/\s+/).length < MIN_WORDS) continue;
    const start = m.index!;
    const window = text.slice(Math.max(0, start - MAX_GAP - 20), start);
    const end = start + m[0].length;
    const before = [...window.matchAll(ATTRIBUTION)].some((a) => window.length - (a.index! + a[0].length) <= MAX_GAP);
    const after = HAS_ATTRIBUTION.test(text.slice(end, end + MAX_GAP_AFTER));
    if (before || after) spans.push([start, end]);
  }
  return merge(spans);
}

/** True when the model quoted what looks like a verse or hadith instead of citing it by ID. */
export function findReligiousQuote(text: string): boolean {
  return religiousQuoteSpans(text).length > 0;
}

export function stripReligiousQuotes(text: string, hasSources = true): string {
  const placeholder = hasSources ? "(see the sources below)" : "(quotation left out)";
  let out = text;
  for (const [start, end] of religiousQuoteSpans(text).reverse()) {
    out = `${out.slice(0, start)}${placeholder}${out.slice(end)}`;
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
  | { kind: "hadith"; id: number; title: string; text: string; arabic: string | null; grade: string; source: string; credit: string }
  | { kind: "dua"; id: number; arabic: string; transliteration: string; english: string; reference: string };

type Ref = { kind: "quran"; surah: number; ayah: number } | { kind: "hadith"; id: number } | { kind: "dua"; id: number };

function parseId(id: string): Ref | null {
  const q = /^q:(\d{1,3}):(\d{1,3})$/.exec(id);
  if (q) return { kind: "quran", surah: Number(q[1]), ayah: Number(q[2]) };
  const h = /^h:(\d{1,9})$/.exec(id);
  if (h) return { kind: "hadith", id: Number(h[1]) };
  const d = /^d:(\d{1,9})$/.exec(id);
  if (d) return { kind: "dua", id: Number(d[1]) };
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

  const duaIds = refs.flatMap((r) => (r.kind === "dua" ? [r.id] : []));

  const [ayahs, hadiths, duas] = await Promise.all([
    quranRefs.length ? getQuranAyahs(quranRefs) : [],
    hadithIds.length ? getHadiths(hadithIds) : [],
    duaIds.length ? getDuas(duaIds) : [],
  ]);
  const ayahByKey = new Map(ayahs.map((a) => [`${a.surah}:${a.ayah}`, a]));
  const hadithById = new Map(hadiths.map((h) => [h.id, h]));
  const duaById = new Map(duas.map((d) => [d.id, d]));
  const withEnglish = ENV.CHAT_QURAN_QUOTES === "text";

  const out: Citation[] = [];
  for (const ref of refs) {
    if (ref.kind === "quran") {
      const a = ayahByKey.get(`${ref.surah}:${ref.ayah}`);
      if (a) out.push({ kind: "quran", surah: a.surah, ayah: a.ayah, arabic: a.textAr, english: withEnglish ? a.textEn : null });
    } else if (ref.kind === "dua") {
      const d = duaById.get(ref.id);
      if (d) out.push({ kind: "dua", id: d.id, arabic: d.arabic, transliteration: d.transliteration, english: d.english, reference: d.reference });
    } else {
      const h = hadithById.get(ref.id);
      // HadeethEnc exposes no translator name, so the credit is the site alone.
      if (h) out.push({ kind: "hadith", id: h.id, title: h.title, text: h.textEn, arabic: h.textAr, grade: h.grade, source: h.attribution, credit: "HadeethEnc.com" });
    }
  }
  return out;
}

export function citationId(c: Citation): string {
  return c.kind === "quran" ? `q:${c.surah}:${c.ayah}` : `${c.kind === "hadith" ? "h" : "d"}:${c.id}`;
}

const MARKER_GROUP = /([^\S\n]*)\[((?:[qhd]:[\d:]+)(?:\s*,\s*[qhd]:[\d:]+)*)\]/g;

/**
 * Turns the model's [q:2:286] / [h:1] / [d:3] markers into [n] matching the
 * returned citations. Sources are ordered by first marker, then capped, so a
 * referenced source is never the one the cap cuts. Runs after every other text
 * edit, because it is the step that settles the final numbering.
 */
export function numberCitations(text: string, citations: Citation[]): { text: string; citations: Citation[] } {
  // Models imitate the numbered form and write [1] themselves; those would collide with ours.
  const clean = text.replace(/[^\S\n]*\[\d{1,3}\]/g, "");
  const available = new Set(citations.map(citationId));
  const marked = new Set<string>();
  for (const m of clean.matchAll(MARKER_GROUP)) {
    for (const id of m[2].split(",")) if (available.has(id.trim())) marked.add(id.trim());
  }
  const byId = new Map(citations.map((c) => [citationId(c), c]));
  const kept = [...[...marked].map((id) => byId.get(id)!), ...citations.filter((c) => !marked.has(citationId(c)))].slice(0, MAX_CITATIONS);
  const position = new Map(kept.map((c, i) => [citationId(c), i + 1]));
  const numbered = clean.replace(MARKER_GROUP, (_, ws: string, ids: string) => {
    const nums = ids.split(",").flatMap((id) => position.get(id.trim()) ?? []);
    return nums.length ? ws + nums.map((n) => `[${n}]`).join("") : "";
  });
  const tidy = numbered.replace(/(\[\d+\])(\s*\1)+/g, "$1").replace(/ {2,}/g, " ");
  return { text: tidy, citations: kept };
}
