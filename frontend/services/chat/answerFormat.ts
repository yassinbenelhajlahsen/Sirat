import type { ChatMessage } from "@/services/chat/chatStore";
import { sourceRefLine } from "@/services/chat/sources";

export type Inline = { kind: "text"; text: string; bold: boolean } | { kind: "ref"; n: number };
export type AnswerBlock = { kind: "paragraph"; inlines: Inline[] } | { kind: "bullets"; items: Inline[][] };

const BOLD = /\*\*(.+?)\*\*/g;
const REF = /\[(\d+)\]/g;

function withRefs(text: string, bold: boolean, out: Inline[]) {
  let last = 0;
  for (const m of text.matchAll(REF)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index), bold });
    out.push({ kind: "ref", n: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last), bold });
}

function parseInlines(line: string, sourceCount: number): Inline[] {
  // An out-of-range [n] goes with the space before it, so no stray space is left behind.
  const clean = line.replace(/\s*\[(\d+)\]/g, (all, n) => (Number(n) >= 1 && Number(n) <= sourceCount ? all : ""));
  const out: Inline[] = [];
  let last = 0;
  for (const m of clean.matchAll(BOLD)) {
    withRefs(clean.slice(last, m.index), false, out);
    withRefs(m[1], true, out);
    last = m.index + m[0].length;
  }
  withRefs(clean.slice(last), false, out);
  return out;
}

export function parseAnswer(text: string, sourceCount: number): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let para: string[] = [];
  let items: Inline[][] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "paragraph", inlines: parseInlines(para.join("\n"), sourceCount) });
    para = [];
  };
  const flushItems = () => {
    if (items.length) blocks.push({ kind: "bullets", items });
    items = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushItems();
    } else if (line.startsWith("- ")) {
      flushPara();
      items.push(parseInlines(line.slice(2), sourceCount));
    } else {
      flushItems();
      para.push(line);
    }
  }
  flushPara();
  flushItems();
  return blocks;
}

export function plainAnswer(text: string): string {
  return text.replace(BOLD, "$1").replace(/\s*\[\d+\]/g, "");
}

export function copyText(message: ChatMessage, surahName: (surah: number) => string): string {
  const refs = (message.citations ?? []).map((c) => sourceRefLine(c, surahName));
  const body = plainAnswer(message.text);
  return refs.length ? `${body}\n\n${refs.join("\n")}` : body;
}
