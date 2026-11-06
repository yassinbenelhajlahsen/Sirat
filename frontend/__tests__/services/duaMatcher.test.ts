import { CRISIS_DUA_ABUSE, CRISIS_DUA_SELF_HARM, matchDua, matchKeywords, normalizeInput, RULE_CATEGORIES } from "@/services/duaMatcher";
import { HELD_OUT } from "../fixtures/duaHeldOut";
import { TUNING } from "../fixtures/duaTuning";
import { CATEGORIES, judge } from "./duaEval.helper";

const categoryOf = (text: string) => {
  const m = matchDua(text);
  return m.kind === "match" ? m.categories : m.kind;
};

describe("services/duaMatcher", () => {
  it("normalizes punctuation, case, spacing and contractions", () => {
    expect(normalizeInput("  HeLLo!!!   World??  ")).toBe("hello world");
    expect(normalizeInput("I can't, I'll try")).toBe("i cant i will try");
  });

  it("handles Arabic script without crashing and gives no match", () => {
    expect(matchDua("اللهم اغفر لي")).toEqual({ kind: "none" });
    expect(matchDua("☺️🙏")).toEqual({ kind: "none" });
  });

  it("folds accented letters so other-language words stay whole", () => {
    expect(normalizeInput("Allah'ım bu yağmuru rahmet eyle")).toBe("allahim bu yagmuru rahmet eyle");
    expect(normalizeInput("je suis très stressé")).toBe("je suis tres stresse");
  });

  describe("scoring", () => {
    it("a situation beats a feeling in the keyword scorer", () => {
      expect(matchKeywords("I'm so nervous and worried about my exam")).toMatchObject({ kind: "match", categories: ["exam"], strong: true });
    });

    it("test results for cancer are medical, not exam", () => {
      expect(categoryOf("my test results came back positive for cancer")).toEqual(["medical"]);
    });

    it("a final goodbye is not an exam", () => {
      expect(categoryOf("Final goodbye to my grandmother")).toEqual(["deceased"]);
    });

    it("a fight with a spouse does not reach enemy", () => {
      expect(["divorce", "family_conflict"]).toContain(categoryOf("my wife and I keep fighting")[0]);
    });

    it("a death does not reach parents", () => {
      expect(categoryOf("my dad passed away")).toEqual(["deceased"]);
    });

    it("a crying baby does not reach pregnancy or the newborn dua", () => {
      expect(categoryOf("my baby won't stop crying")).not.toEqual(expect.arrayContaining(["pregnancy"]));
      expect(categoryOf("my baby won't stop crying")).not.toEqual(expect.arrayContaining(["NewBorn"]));
    });

    it("an off-topic or empty request is no match (or the general dua)", () => {
      const general = (text: string) => { const m = matchDua(text); return m.kind === "none" || (m.kind === "match" && m.categories[0] === "General"); };
      expect(general("my phone is missing")).toBe(true);
      expect(general("help")).toBe(true);
      expect(general("we lost the game")).toBe(true);
    });

    it("a tie between different topics is settled by the classifier", () => {
      // one strong term each: exam (knowledge) and debt (work and provision)
      const got = categoryOf("exam debt");
      expect(got).toHaveLength(1);
      expect(["exam", "debt"]).toContain(got[0]);
    });

    it("tolerates misspellings", () => {
      expect(categoryOf("im so anxios")).toEqual(["anxiety"]);
      expect(categoryOf("I feel depresed")).toEqual(["depression"]);
      expect(categoryOf("I hav an exma tommorow")).toEqual(["exam"]);
    });

    it("never fuzzy-matches a real word to a neighbour", () => {
      expect(categoryOf("final goodbye to my uncle")).toEqual(["deceased"]);
    });

    it("understands romanized Islamic terms and variants", () => {
      expect(["illness", "healing"]).toContain(categoryOf("shifa for my father")[0]);
      expect(categoryOf("waswasa won't leave me")).toEqual(["protection"]);
      expect(categoryOf("hidayah")).toEqual(["guidance"]);
      expect(categoryOf("jinn at home")).toEqual(["protection"]);
      expect(categoryOf("laylatulqadr")).toEqual(["laylatul qadr"]);
    });

    it("does not handle simple negation (documented shortcut)", () => {
      expect(["worry", "anxiety"]).toContain(categoryOf("I am not worried")[0]);
    });

    it("every category except General has a rule that a real request reaches", () => {
      const missingRule = CATEGORIES.filter((c) => c !== "General" && !RULE_CATEGORIES.includes(c));
      expect(missingRule).toEqual([]);
      const unreachable = CATEGORIES.filter(
        (c) => c !== "General" && !TUNING.some((t) => t.expected === c && judge(t).got.split(",").includes(c)),
      );
      expect(unreachable).toEqual([]);
    });

    it("never reaches General by rule", () => {
      expect(RULE_CATEGORIES).not.toContain("General");
    });
  });

  describe("crisis check", () => {
    it.each([
      ["I want to kill myself", CRISIS_DUA_SELF_HARM],
      ["I don't want to live anymore", CRISIS_DUA_SELF_HARM],
      ["I am hurting myself", CRISIS_DUA_SELF_HARM],
      ["my husband hits me", CRISIS_DUA_ABUSE],
      ["he wants to kill me", CRISIS_DUA_ABUSE],
      ["انتحار", CRISIS_DUA_SELF_HARM],
      ["I don't want to die, I want to die", CRISIS_DUA_SELF_HARM],
      ["my life is so bad I want to die", CRISIS_DUA_SELF_HARM],
      ["I'm going to kill myself lol", CRISIS_DUA_SELF_HARM],
    ])("%s", (text, duaId) => {
      expect(matchDua(text)).toEqual({ kind: "crisis", duaId });
    });

    it.each([
      "I want to kill myself",
      "I want to kill myself.",
      "I\u00a0want\u00a0to\u00a0kill\u00a0myself",
      "I want to kill\u200b myself",
      "ｉ ｗａｎｔ ｔｏ ｋｉｌｌ ｍｙｓｅｌｆ",
      "I WANT TO KILL MYSELF!!!",
      "i want to kill   myself",
      "i wanna unalive myself",
    ])("still detects odd spacing, case and characters: %j", (text) => {
      expect(matchDua(text)).toEqual({ kind: "crisis", duaId: CRISIS_DUA_SELF_HARM });
    });

    it("overrides a topic that would otherwise win", () => {
      expect(matchDua("I have an exam tomorrow and I want to kill myself").kind).toBe("crisis");
    });

    it.each([
      "this traffic is killing me",
      "my boss is going to kill me if I'm late",
      "I'm dying to see the new movie",
      "I could die of embarrassment",
      "that joke killed me",
      "I'm dead tired",
      "failing my test again and my parents are going to kill me lol",
      "dua for a peaceful death, i dont want to die in a bad state",
    ])("ignores the idiom: %s", (text) => {
      expect(matchDua(text).kind).not.toBe("crisis");
    });
  });

  describe("sleep", () => {
    it("picks the dua that fits the situation", () => {
      expect(matchDua("I keep having nightmares")).toEqual({ kind: "match", categories: ["sleep"], duaIds: [116] });
      expect(matchDua("tossing and turning all night")).toEqual({ kind: "match", categories: ["sleep"], duaIds: [118] });
    });
  });

  describe("accuracy", () => {
    it("passes every case on the tuning list", () => {
      const failures = TUNING.map((c) => ({ c, r: judge(c) })).filter((x) => x.r.outcome !== "correct");
      expect(failures.map((x) => `${x.c.expected} <- ${x.c.text} (${x.r.got})`)).toEqual([]);
    });

    // Held-out: written before the scorer and never tuned against. The targets
    // are the bar; a miss should be reported, not fixed by editing the list.
    it("meets the targets on the held-out list", () => {
      expect(HELD_OUT.length).toBeGreaterThanOrEqual(100);
      const rows = HELD_OUT.map((c) => judge(c));
      const pct = (o: string) => (100 * rows.filter((r) => r.outcome === o).length) / rows.length;
      expect(pct("correct")).toBeGreaterThanOrEqual(90);
      expect(pct("wrong")).toBeLessThanOrEqual(3);
    });
  });
});
