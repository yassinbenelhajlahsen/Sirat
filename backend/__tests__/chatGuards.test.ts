import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetQuranAyahs: jest.Mock = jest.fn();
const mockGetHadiths: jest.Mock = jest.fn();

describe("chat guards", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetQuranAyahs.mockReset();
    mockGetHadiths.mockReset();
    process.env.OPENAI_MODEL = "gpt-6-luna";
    delete process.env.CHAT_QURAN_QUOTES;
    jest.unstable_mockModule("../src/services/chat/sourceSearch.js", () => ({
      getQuranAyahs: (...a: unknown[]) => mockGetQuranAyahs(...a),
      getHadiths: (...a: unknown[]) => mockGetHadiths(...a),
    }));
  });

  const load = async () => await import("../src/services/chat/guards.js");

  describe("religious quotes", () => {
    it("detects and strips a quoted verse after an attribution", async () => {
      const { findReligiousQuote, stripReligiousQuotes } = await load();
      const text = 'Allah says: "Indeed, with hardship comes ease" so be patient.';

      expect(findReligiousQuote(text)).toBe(true);
      const stripped = stripReligiousQuotes(text);
      expect(stripped).not.toContain("with hardship comes ease");
      expect(stripped).toContain("(see the sources below)");
      expect(stripped).toContain("so be patient.");
    });

    it("ignores everyday quotes with no attribution", async () => {
      const { findReligiousQuote } = await load();

      expect(findReligiousQuote('I said "thank you" to my boss')).toBe(false);
      expect(findReligiousQuote('My boss said "we will close early on Friday" today')).toBe(false);
    });

    it("detects curly double and single quotes", async () => {
      const { findReligiousQuote } = await load();

      expect(findReligiousQuote("The Prophet said: “The strong man is not the good wrestler”")).toBe(true);
      expect(findReligiousQuote("It is narrated: ‘Actions are judged by intentions alone’")).toBe(true);
    });

    it("ignores short quoted words after an attribution", async () => {
      const { findReligiousQuote } = await load();

      expect(findReligiousQuote('The Quran uses the word "taqwa" often')).toBe(false);
    });

    it("ignores a quote more than 60 characters after the attribution", async () => {
      const { findReligiousQuote } = await load();
      const gap = "x".repeat(70);

      expect(findReligiousQuote(`Allah ${gap} "one two three four five"`)).toBe(false);
    });
  });

  describe("scrubInternals", () => {
    it("removes model and provider names", async () => {
      const { scrubInternals } = await load();
      const out = scrubInternals("I am GPT-6 by OpenAI, like ChatGPT, running gpt-6-luna");

      expect(out).not.toMatch(/gpt/i);
      expect(out).not.toMatch(/openai/i);
    });
  });

  describe("renderCitations", () => {
    const ayah = { surah: 2, ayah: 275, textAr: "الربا", textEn: "Allah has permitted trade" };
    const hadith = {
      id: 2962, title: "Actions are by intentions", textEn: "Real hadith text", textAr: "نص",
      grade: "Sahih/Authentic.", attribution: "Agreed upon.",
    };

    it("drops unretrieved, malformed and unknown IDs and renders real DB text in the model's order", async () => {
      (mockGetQuranAyahs as any).mockResolvedValue([ayah]);
      (mockGetHadiths as any).mockResolvedValue([hadith]);
      const { renderCitations } = await load();
      const retrieved = new Set(["h:2962", "q:2:275", "h:999", "q:abc"]);

      const out = await renderCitations(["h:2962", "q:1:1", "q:abc", "h:999", "q:2:275", "h:2962"], retrieved);

      expect(out).toEqual([
        {
          kind: "hadith", id: 2962, title: "Actions are by intentions", text: "Real hadith text", arabic: "نص",
          grade: "Sahih/Authentic.", source: "Agreed upon.", credit: "HadeethEnc.com",
        },
        { kind: "quran", surah: 2, ayah: 275, arabic: "الربا", english: "Allah has permitted trade" },
      ]);
      expect(mockGetQuranAyahs).toHaveBeenCalledWith([{ surah: 2, ayah: 275 }]);
      expect(mockGetHadiths).toHaveBeenCalledWith([2962, 999]);
    });

    it("keeps at most 6 citations", async () => {
      const refs = Array.from({ length: 8 }, (_, i) => ({ surah: 1, ayah: i + 1, textAr: "a", textEn: "e" }));
      (mockGetQuranAyahs as any).mockResolvedValue(refs);
      (mockGetHadiths as any).mockResolvedValue([]);
      const { renderCitations } = await load();
      const ids = refs.map((r) => `q:${r.surah}:${r.ayah}`);

      expect(await renderCitations(ids, new Set(ids))).toHaveLength(6);
    });

    it("leaves out the English in reference mode", async () => {
      process.env.CHAT_QURAN_QUOTES = "reference";
      (mockGetQuranAyahs as any).mockResolvedValue([ayah]);
      (mockGetHadiths as any).mockResolvedValue([]);
      const { renderCitations } = await load();

      const [c] = await renderCitations(["q:2:275"], new Set(["q:2:275"]));

      expect(c).toMatchObject({ kind: "quran", english: null, arabic: ayah.textAr });
    });

    it("skips the database when nothing valid is cited", async () => {
      const { renderCitations } = await load();

      expect(await renderCitations(["q:9:9"], new Set())).toEqual([]);
      expect(mockGetQuranAyahs).not.toHaveBeenCalled();
      expect(mockGetHadiths).not.toHaveBeenCalled();
    });
  });
});
