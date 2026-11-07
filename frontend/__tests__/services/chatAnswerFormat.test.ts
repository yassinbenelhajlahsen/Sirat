import { copyText, parseAnswer, plainAnswer } from "@/services/chat/answerFormat";
import type { Citation } from "@/services/chat/chatApi";
import type { ChatMessage } from "@/services/chat/chatStore";

const quran = (surah: number, ayah: number): Citation => ({ kind: "quran", surah, ayah, arabic: "", english: null });
const hadith = (o: Partial<Extract<Citation, { kind: "hadith" }>> = {}): Citation => ({
  kind: "hadith", id: 1, title: "", text: "", arabic: null, grade: "Authentic hadith", source: "Bukhari 1", credit: "", ...o,
});
const dua = (o: Partial<Extract<Citation, { kind: "dua" }>> = {}): Citation => ({
  kind: "dua", id: 1, arabic: "", transliteration: "", english: "", reference: "Muslim 1", ...o,
});
const answerWith = (text: string, citations: Citation[]): ChatMessage => ({
  id: "a1", role: "assistant", text, createdAt: 0, citations,
});
const t = (text: string, bold = false) => ({ kind: "text" as const, text, bold });

it("splits paragraphs on blank lines and reads bold", () => {
  expect(parseAnswer("**Yes**, it is allowed.\n\nTake them off.", 0)).toEqual([
    { kind: "paragraph", inlines: [t("Yes", true), t(", it is allowed.")] },
    { kind: "paragraph", inlines: [t("Take them off.")] },
  ]);
});

it("reads consecutive '- ' lines as one bullet list", () => {
  const [, list] = parseAnswer("Intro\n- one\n- two", 0);
  expect(list).toEqual({ kind: "bullets", items: [[t("one")], [t("two")]] });
});

it("turns [n] into a ref only when a matching source exists", () => {
  expect(parseAnswer("a [1] b [3]", 2)[0]).toEqual({
    kind: "paragraph",
    inlines: [t("a "), { kind: "ref", n: 1 }, t(" b")],
  });
});

it("drops [0] and refs when there are no sources", () => {
  expect(parseAnswer("a [0] b [1].", 0)).toEqual([{ kind: "paragraph", inlines: [t("a b.")] }]);
});

it("reads refs inside bullets", () => {
  expect(parseAnswer("- one [1]", 1)).toEqual([{ kind: "bullets", items: [[t("one "), { kind: "ref", n: 1 }]] }]);
});

it("renders old plain answers unchanged", () => {
  expect(parseAnswer("Plain answer.", 0)).toEqual([{ kind: "paragraph", inlines: [t("Plain answer.")] }]);
});

it("leaves a lone asterisk as text", () => {
  expect(parseAnswer("5 * 2", 0)[0]).toEqual({ kind: "paragraph", inlines: [t("5 * 2")] });
});

it("plainAnswer drops bold markers and numbers but keeps bullets", () => {
  expect(plainAnswer("**Yes** [1].\n- one [2]")).toBe("Yes.\n- one");
});

it("copyText adds one reference line per source", () => {
  const msg = answerWith("**Yes** [1].", [
    quran(2, 286),
    hadith({ source: "Bukhari 386", grade: "Authentic hadith" }),
    dua({ reference: "Muslim 1342" }),
  ]);
  expect(copyText(msg, () => "Al-Baqarah")).toBe(
    "Yes.\n\nQuran 2:286 (Al-Baqarah)\nBukhari 386 (Authentic hadith)\nMuslim 1342",
  );
});

it("copyText has no trailing block without sources", () => {
  expect(copyText(answerWith("Plain.", []), () => "x")).toBe("Plain.");
});

it("copyText skips a source of a kind this build does not know", () => {
  const unknown = { kind: "fatwa", id: 1 } as unknown as Citation;
  expect(copyText(answerWith("Yes.", [unknown, dua({ reference: "Muslim 1342" })]), () => "x")).toBe("Yes.\n\nMuslim 1342");
});
