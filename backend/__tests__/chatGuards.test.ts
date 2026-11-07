import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetQuranAyahs: jest.Mock = jest.fn();
const mockGetHadiths: jest.Mock = jest.fn();
const mockGetDuas: jest.Mock = jest.fn();

describe("chat guards", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetQuranAyahs.mockReset();
    mockGetHadiths.mockReset();
    mockGetDuas.mockReset();
    process.env.OPENAI_MODEL = "gpt-6-luna";
    delete process.env.CHAT_QURAN_QUOTES;
    jest.unstable_mockModule("../src/services/chat/sourceSearch.js", () => ({
      getQuranAyahs: (...a: unknown[]) => mockGetQuranAyahs(...a),
      getHadiths: (...a: unknown[]) => mockGetHadiths(...a),
      getDuas: (...a: unknown[]) => mockGetDuas(...a),
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

    it.each([
      'Prophet Muhammad said: "Whoever believes in the Last Day should speak good"',
      'In Surah Al-Baqarah (2:275): "Those who consume interest cannot stand"',
      '"Actions are judged by their intentions," the Prophet said.',
      'The verse says: "Indeed, with hardship comes ease."',
      'This ayah reads: "So remember Me and I will remember you"',
    ])("detects the quote in %s", async (text) => {
      const { findReligiousQuote } = await load();

      expect(findReligiousQuote(text)).toBe(true);
    });

    it("says the text was left out when there are no sources to point to", async () => {
      const { stripReligiousQuotes } = await load();

      const out = stripReligiousQuotes('The Prophet said: "Do not be angry, do not be angry" to a man.', false);

      expect(out).toBe("The Prophet said: (quotation left out) to a man.");
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

    it("treats a run of 4 or more Arabic words as quoted scripture and strips it", async () => {
      const { findReligiousQuote, stripReligiousQuotes } = await load();
      const text = "Ayat al-Kursi, in Arabic:\n\n\u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0644\u064e\u0627 \u0625\u0650\u0644\u064e\u0670\u0647\u064e \u0625\u0650\u0644\u0651\u064e\u0627 \u0647\u064f\u0648\u064e \u0627\u0644\u0652\u062d\u064e\u064a\u0651\u064f \u06da\n\nIt is recited after prayers.";

      expect(findReligiousQuote(text)).toBe(true);
      const stripped = stripReligiousQuotes(text);
      expect(stripped).not.toMatch(/[\u0600-\u06FF]{2,}/);
      expect(stripped).toContain("(see the sources below)");
      expect(stripped).toContain("It is recited after prayers.");
    });

    it("allows a short Arabic phrase and the salutation mark", async () => {
      const { findReligiousQuote } = await load();

      expect(findReligiousQuote("Say \u0625\u0646 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647 when you plan something.")).toBe(false);
      expect(findReligiousQuote("The Prophet \ufdfa taught kindness.")).toBe(false);
    });

    it("strips an Arabic quote inside an attributed English quote once", async () => {
      const { stripReligiousQuotes } = await load();
      const text = 'Allah says: "\u0625\u0650\u0646\u0651\u064e \u0645\u064e\u0639\u064e \u0627\u0644\u0652\u0639\u064f\u0633\u0652\u0631\u0650 \u064a\u064f\u0633\u0652\u0631\u064b\u0627" so be patient.';

      expect(stripReligiousQuotes(text)).toBe("Allah says: (see the sources below) so be patient.");
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

    it("returns every rendered source, since the cap moved to numberCitations", async () => {
      const refs = Array.from({ length: 7 }, (_, i) => ({ surah: 1, ayah: i + 1, textAr: "a", textEn: "e" }));
      (mockGetQuranAyahs as any).mockResolvedValue(refs);
      (mockGetHadiths as any).mockResolvedValue([]);
      const { renderCitations } = await load();
      const ids = refs.map((r) => `q:${r.surah}:${r.ayah}`);

      expect(await renderCitations(ids, new Set(ids))).toHaveLength(7);
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

      expect(await renderCitations(["q:9:9", "d:12"], new Set())).toEqual([]);
      expect(mockGetQuranAyahs).not.toHaveBeenCalled();
      expect(mockGetHadiths).not.toHaveBeenCalled();
      expect(mockGetDuas).not.toHaveBeenCalled();
    });

    describe("duas", () => {
      const dua = {
        id: 12, arabic: "سُبْحَانَ الَّذِي", transliteration: "Subhanal-ladhi",
        english: "Glory to Him who has subjected this to us", reference: "Quran 43:13",
      };

      it("renders a retrieved d:12 from the stored fields only", async () => {
        (mockGetQuranAyahs as any).mockResolvedValue([]);
        (mockGetHadiths as any).mockResolvedValue([]);
        (mockGetDuas as any).mockResolvedValue([{ ...dua, category: "travel", tags: ["x"], source: "Quran" }]);
        const { renderCitations } = await load();

        const out = await renderCitations(["d:12"], new Set(["d:12"]));

        expect(out).toEqual([{ kind: "dua", ...dua }]);
        expect(mockGetDuas).toHaveBeenCalledWith([12]);
      });

      it("drops an unretrieved or unknown d: ID and a malformed one", async () => {
        (mockGetDuas as any).mockResolvedValue([dua]);
        const { renderCitations } = await load();

        // d:12 was never retrieved; d:99 was retrieved but is not in the table; d:x is malformed.
        expect(await renderCitations(["d:12", "d:x"], new Set(["d:99", "d:x"]))).toEqual([]);
        expect(await renderCitations(["d:99"], new Set(["d:99"]))).toEqual([]);
        expect(mockGetDuas).toHaveBeenCalledTimes(1);
        expect(mockGetDuas).toHaveBeenCalledWith([99]);
      });

      it("keeps the model's order across kinds", async () => {
        (mockGetQuranAyahs as any).mockResolvedValue([ayah]);
        (mockGetHadiths as any).mockResolvedValue([]);
        const duas = Array.from({ length: 6 }, (_, i) => ({ ...dua, id: i + 1 }));
        (mockGetDuas as any).mockResolvedValue(duas);
        const { renderCitations } = await load();
        const ids = ["d:1", "q:2:275", ...duas.slice(1).map((d) => `d:${d.id}`)];

        const out = await renderCitations(ids, new Set(ids));

        expect(out).toHaveLength(7);
        expect(out[0]).toMatchObject({ kind: "dua", id: 1 });
        expect(out[1]).toMatchObject({ kind: "quran" });
      });
    });
  });

  describe("numberCitations", () => {
    type C = import("../src/services/chat/guards.js").Citation;
    const hadith = (id: number): C => ({ kind: "hadith", id, title: "t", text: "x", arabic: null, grade: "g", source: "s", credit: "c" });
    const quran = (surah: number, ayah: number): C => ({ kind: "quran", surah, ayah, arabic: "a", english: null });
    const dua = (id: number): C => ({ kind: "dua", id, arabic: "a", transliteration: "t", english: "e", reference: "r" });

    it("numbers markers by first appearance and reorders sources", async () => {
      const { numberCitations, citationId } = await load();
      const out = numberCitations("Pray. [h:1] It is fine [q:2:286].", [quran(2, 286), hadith(1)]);
      expect(out.text).toBe("Pray. [1] It is fine [2].");
      expect(out.citations.map(citationId)).toEqual(["h:1", "q:2:286"]);
    });
    it("keeps unmarked sources after marked ones, in model order", async () => {
      const { numberCitations, citationId } = await load();
      const out = numberCitations("A [d:3].", [hadith(1), quran(2, 286), dua(3)]);
      expect(out.citations.map(citationId)).toEqual(["d:3", "h:1", "q:2:286"]);
      expect(out.text).toBe("A [1].");
    });
    it("removes markers for ids not in the list without leaving spaces", async () => {
      const { numberCitations } = await load();
      expect(numberCitations("Be patient [q:9:9].", [hadith(1)]).text).toBe("Be patient.");
    });
    it("strips numbers the model wrote itself", async () => {
      const { numberCitations } = await load();
      expect(numberCitations("See [1] and [h:1].", [hadith(1)]).text).toBe("See and [1].");
    });
    it("splits a bracket holding several ids", async () => {
      const { numberCitations } = await load();
      expect(numberCitations("Yes [q:2:286, h:1].", [hadith(1), quran(2, 286)]).text).toBe("Yes [1][2].");
    });
    it("collapses repeats of the same source", async () => {
      const { numberCitations } = await load();
      expect(numberCitations("Yes [h:1] [h:1].", [hadith(1)]).text).toBe("Yes [1].");
    });
    it("caps at six after reordering, so marked sources win", async () => {
      const { numberCitations, citationId } = await load();
      const seven = [1, 2, 3, 4, 5, 6, 7].map(hadith);
      const out = numberCitations("Key [h:7].", seven);
      expect(out.citations).toHaveLength(6);
      expect(citationId(out.citations[0])).toBe("h:7");
      expect(out.citations.map(citationId)).not.toContain("h:6");
    });
    it("removes markers for sources cut by the cap", async () => {
      const { numberCitations, citationId } = await load();
      const seven = [1, 2, 3, 4, 5, 6, 7].map(hadith);
      const text = seven.map((h) => `x [${citationId(h)}]`).join(" ");
      expect(numberCitations(text, seven).text).not.toMatch(/\[7\]/);
    });
  });
});
