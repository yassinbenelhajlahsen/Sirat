import { describe, expect, it } from "@jest/globals";
import {
  MATCH_RULES,
  matchByRegex,
  normalizeInput,
} from "../src/utils/duaMatcher.js";

describe("duaMatcher", () => {
  describe("normalizeInput", () => {
    it("should convert to lowercase", () => {
      expect(normalizeInput("ANXIETY")).toBe("anxiety");
      expect(normalizeInput("ExAm")).toBe("exam");
    });

    it("should trim whitespace", () => {
      expect(normalizeInput("  anxiety  ")).toBe("anxiety");
      expect(normalizeInput("\tanxiety\n")).toBe("anxiety");
    });

    it("should remove punctuation", () => {
      expect(normalizeInput("I'm anxious!")).toBe("im anxious");
      expect(normalizeInput("Help, please?")).toBe("help please");
      expect(normalizeInput("stress...")).toBe("stress");
    });

    it("should collapse extra spaces", () => {
      expect(normalizeInput("help   me   please")).toBe("help me please");
      expect(normalizeInput("exam  stress")).toBe("exam stress");
    });

    it("should handle combined transformations", () => {
      expect(normalizeInput("  I'm STRESSED!!!  ")).toBe("im stressed");
      expect(normalizeInput("Help, I can't sleep...")).toBe(
        "help i cant sleep",
      );
    });

    it("should handle empty strings", () => {
      expect(normalizeInput("")).toBe("");
      expect(normalizeInput("   ")).toBe("");
    });

    it("should preserve word boundaries", () => {
      expect(normalizeInput("anxious about exam")).toBe("anxious about exam");
    });
  });

  describe("matchByRegex - anxiety", () => {
    it("should match 'anxiety'", () => {
      expect(matchByRegex("I have anxiety")).toBe("anxiety");
    });

    it("should match 'anxious'", () => {
      expect(matchByRegex("feeling anxious")).toBe("anxiety");
    });

    it("should match 'stress'", () => {
      expect(matchByRegex("so much stress")).toBe("anxiety");
    });

    it("should match 'stressed'", () => {
      expect(matchByRegex("I'm stressed out")).toBe("anxiety");
    });

    it("should match 'worried'", () => {
      expect(matchByRegex("I'm worried")).toBe("anxiety");
    });

    it("should match 'worry'", () => {
      expect(matchByRegex("don't worry")).toBe("anxiety");
    });

    it("should match 'panic'", () => {
      expect(matchByRegex("panic attack")).toBe("anxiety");
    });

    it("should match 'fear'", () => {
      expect(matchByRegex("I have fear")).toBe("fear");
    });

    it("should match 'afraid'", () => {
      expect(matchByRegex("I'm afraid")).toBe("fear");
    });

    it("should match 'nervous'", () => {
      expect(matchByRegex("feeling nervous")).toBe("anxiety");
    });

    it("should match 'overthinking'", () => {
      expect(matchByRegex("I'm overthinking everything")).toBe("anxiety");
    });

    it("should match 'overwhelm'", () => {
      expect(matchByRegex("feeling overwhelmed")).toBe("anxiety");
    });

    it("should be case-insensitive", () => {
      expect(matchByRegex("ANXIETY")).toBe("anxiety");
      expect(matchByRegex("Stressed")).toBe("anxiety");
    });

    it("should handle punctuation", () => {
      expect(matchByRegex("I'm anxious!")).toBe("anxiety");
      expect(matchByRegex("stress...")).toBe("anxiety");
    });
  });

  describe("matchByRegex - sleep", () => {
    it("should match 'sleep'", () => {
      expect(matchByRegex("I can't sleep")).toBe("sleep");
    });

    it("should match 'insomnia'", () => {
      expect(matchByRegex("I have insomnia")).toBe("sleep");
    });

    it("should match 'rest'", () => {
      expect(matchByRegex("need rest")).toBe("sleep");
    });

    it("should match 'tired'", () => {
      expect(matchByRegex("I'm so tired")).toBe("sleep");
    });

    it("should match 'night' with sleep context", () => {
      expect(matchByRegex("can't sleep at night")).toBe("sleep");
    });

    it("should match 'bedtime'", () => {
      expect(matchByRegex("bedtime prayer")).toBe("sleep");
    });

    it("should match 'nightmare'", () => {
      expect(matchByRegex("I had a nightmare")).toBe("sleep");
    });

    it("should match 'dream'", () => {
      expect(matchByRegex("bad dreams")).toBe("sleep");
    });

    it("should match 'cant sleep'", () => {
      expect(matchByRegex("I cant sleep")).toBe("sleep");
    });

    it("should match 'trouble sleeping'", () => {
      expect(matchByRegex("trouble sleeping")).toBe("sleep");
    });
  });

  describe("matchByRegex - exam/knowledge", () => {
    it("should match 'exam'", () => {
      expect(matchByRegex("I have an exam")).toBe("exam");
    });

    it("should match 'test'", () => {
      expect(matchByRegex("big test tomorrow")).toBe("exam");
    });

    it("should match 'quiz'", () => {
      expect(matchByRegex("quiz today")).toBe("exam");
    });

    it("should match 'study'", () => {
      expect(matchByRegex("need to study")).toBe("knowledge");
    });

    it("should match 'school'", () => {
      expect(matchByRegex("school is hard")).toBe("knowledge");
    });

    it("should match 'final'", () => {
      expect(matchByRegex("final exam")).toBe("exam");
    });

    it("should match 'midterm'", () => {
      expect(matchByRegex("midterm next week")).toBe("exam");
    });

    it("should match 'assignment'", () => {
      expect(matchByRegex("tough assignment")).toBe("knowledge");
    });

    it("should match 'homework'", () => {
      expect(matchByRegex("lots of homework")).toBe("knowledge");
    });

    it("should match 'grade'", () => {
      expect(matchByRegex("worried about my grade")).toBe("anxiety");
    });

    it("should match combined exam and anxiety", () => {
      expect(matchByRegex("anxious about exam")).toBe("exam");
    });
  });

  describe("matchByRegex - forgiveness", () => {
    it("should match 'forgive'", () => {
      expect(matchByRegex("please forgive me")).toBe("forgiveness");
    });

    it("should match 'forgiveness'", () => {
      expect(matchByRegex("seeking forgiveness")).toBe("forgiveness");
    });

    it("should match 'sin'", () => {
      expect(matchByRegex("I committed a sin")).toBe("forgiveness");
    });

    it("should match 'repent'", () => {
      expect(matchByRegex("I want to repent")).toBe("forgiveness");
    });

    it("should match 'repentance'", () => {
      expect(matchByRegex("repentance dua")).toBe("forgiveness");
    });

    it("should match 'tawbah'", () => {
      expect(matchByRegex("tawbah")).toBe("forgiveness");
    });

    it("should match 'taubah'", () => {
      expect(matchByRegex("taubah")).toBe("forgiveness");
    });

    it("should match 'mistake'", () => {
      expect(matchByRegex("I made a mistake")).toBe("forgiveness");
    });

    it("should match 'guilty'", () => {
      expect(matchByRegex("feeling guilty")).toBe("forgiveness");
    });

    it("should match 'guilt'", () => {
      expect(matchByRegex("overcome guilt")).toBe("forgiveness");
    });

    it("should match 'regret'", () => {
      expect(matchByRegex("I regret it")).toBe("forgiveness");
    });

    it("should match 'atonement'", () => {
      expect(matchByRegex("seeking atonement")).toBe("forgiveness");
    });
  });

  describe("matchByRegex - healing", () => {
    it("should match 'heal'", () => {
      expect(matchByRegex("help me heal")).toBe("healing");
    });

    it("should match 'healing'", () => {
      expect(matchByRegex("need healing")).toBe("healing");
    });

    it("should match 'health'", () => {
      expect(matchByRegex("health issues")).toBe("healing");
    });

    it("should match 'sick'", () => {
      expect(matchByRegex("I'm sick")).toBe("healing");
    });

    it("should match 'sickness'", () => {
      expect(matchByRegex("sickness")).toBe("healing");
    });

    it("should match 'ill'", () => {
      expect(matchByRegex("feeling ill")).toBe("healing");
    });

    it("should match 'illness'", () => {
      expect(matchByRegex("chronic illness")).toBe("healing");
    });

    it("should match 'pain'", () => {
      expect(matchByRegex("in pain")).toBe("healing");
    });

    it("should match 'hurt'", () => {
      expect(matchByRegex("it hurts")).toBe("healing");
    });

    it("should match 'disease'", () => {
      expect(matchByRegex("disease")).toBe("healing");
    });

    it("should match 'recovery'", () => {
      expect(matchByRegex("recovery")).toBe("healing");
    });

    it("should match 'recover'", () => {
      expect(matchByRegex("want to recover")).toBe("healing");
    });
  });

  describe("matchByRegex - gratitude", () => {
    it("should match 'thank'", () => {
      expect(matchByRegex("thank you")).toBe("gratitude");
    });

    it("should match 'thanks'", () => {
      expect(matchByRegex("thanks")).toBe("gratitude");
    });

    it("should match 'thankful'", () => {
      expect(matchByRegex("I'm thankful")).toBe("gratitude");
    });

    it("should match 'grateful'", () => {
      expect(matchByRegex("so grateful")).toBe("gratitude");
    });

    it("should match 'gratitude'", () => {
      expect(matchByRegex("gratitude")).toBe("gratitude");
    });

    it("should match 'blessing'", () => {
      expect(matchByRegex("blessing")).toBe("gratitude");
    });

    it("should match 'blessed'", () => {
      expect(matchByRegex("feeling blessed")).toBe("gratitude");
    });

    it("should match 'appreciate'", () => {
      expect(matchByRegex("I appreciate it")).toBe("gratitude");
    });

    it("should match 'alhamdulillah'", () => {
      expect(matchByRegex("alhamdulillah")).toBe("gratitude");
    });
  });

  describe("matchByRegex - protection", () => {
    it("should match 'protect'", () => {
      expect(matchByRegex("protect me")).toBe("protection");
    });

    it("should match 'protection'", () => {
      expect(matchByRegex("need protection")).toBe("protection");
    });

    it("should match 'safety'", () => {
      expect(matchByRegex("safety")).toBe("protection");
    });

    it("should match 'safe'", () => {
      expect(matchByRegex("keep me safe")).toBe("protection");
    });

    it("should match 'evil'", () => {
      expect(matchByRegex("protect from evil")).toBe("protection");
    });

    it("should match 'harm'", () => {
      expect(matchByRegex("protect from harm")).toBe("protection");
    });

    it("should match 'danger'", () => {
      expect(matchByRegex("in danger")).toBe("protection");
    });
  });

  describe("matchByRegex - guidance", () => {
    it("should match 'guide'", () => {
      expect(matchByRegex("guide me")).toBe("guidance");
    });

    it("should match 'guidance'", () => {
      expect(matchByRegex("need guidance")).toBe("guidance");
    });

    it("should match 'direction'", () => {
      expect(matchByRegex("need direction")).toBe("guidance");
    });

    it("should match 'confused'", () => {
      expect(matchByRegex("I'm confused")).toBe("confusion");
    });

    it("should match 'confusion'", () => {
      expect(matchByRegex("so much confusion")).toBe("confusion");
    });

    it("should match 'lost'", () => {
      expect(matchByRegex("feeling lost")).toBe("loss");
    });

    it("should match 'clarity'", () => {
      expect(matchByRegex("need clarity")).toBe("guidance");
    });
  });

  describe("matchByRegex - success", () => {
    it("should match 'success'", () => {
      expect(matchByRegex("want success")).toBe("success");
    });

    it("should match 'succeed'", () => {
      expect(matchByRegex("help me succeed")).toBe("success");
    });

    it("should match 'achievement'", () => {
      expect(matchByRegex("achievement")).toBe("success");
    });

    it("should match 'victory'", () => {
      expect(matchByRegex("victory")).toBe("success");
    });

    it("should match 'goal'", () => {
      expect(matchByRegex("reach my goal")).toBe("success");
    });
  });

  describe("matchByRegex - patience", () => {
    it("should match 'patience'", () => {
      expect(matchByRegex("need patience")).toBe("patience");
    });

    it("should match 'patient'", () => {
      expect(matchByRegex("help me be patient")).toBe("patience");
    });

    it("should match 'hardship'", () => {
      expect(matchByRegex("going through hardship")).toBe("difficulty");
    });

    it("should match 'difficulty'", () => {
      expect(matchByRegex("difficulty")).toBe("difficulty");
    });

    it("should match 'trial'", () => {
      expect(matchByRegex("facing a trial")).toBe("legal");
    });

    it("should match 'struggle'", () => {
      expect(matchByRegex("struggling")).toBe("patience");
    });

    it("should match 'sabr'", () => {
      expect(matchByRegex("sabr")).toBe("patience");
    });
  });

  describe("matchByRegex - family", () => {
    it("should match 'family'", () => {
      expect(matchByRegex("for my family")).toBe("family");
    });

    it("should match 'marriage'", () => {
      expect(matchByRegex("marriage")).toBe("marriage");
    });

    it("should match 'children'", () => {
      expect(matchByRegex("for my children")).toBe("children");
    });

    it("should match 'child'", () => {
      expect(matchByRegex("my child")).toBe("children");
    });

    it("should match 'baby'", () => {
      expect(matchByRegex("baby")).toBe("pregnancy");
    });

    it("should match 'spouse'", () => {
      expect(matchByRegex("for my spouse")).toBe("family");
    });

    it("should match 'husband'", () => {
      expect(matchByRegex("my husband")).toBe("family");
    });

    it("should match 'wife'", () => {
      expect(matchByRegex("my wife")).toBe("family");
    });
  });

  describe("matchByRegex - provision", () => {
    it("should match 'provision'", () => {
      expect(matchByRegex("provision")).toBe("provision");
    });

    it("should match 'wealth'", () => {
      expect(matchByRegex("wealth")).toBe("provision");
    });

    it("should match 'money'", () => {
      expect(matchByRegex("need money")).toBe("provision");
    });

    it("should match 'rizq'", () => {
      expect(matchByRegex("rizq")).toBe("provision");
    });

    it("should match 'job'", () => {
      expect(matchByRegex("looking for a job")).toBe("job");
    });

    it("should match 'income'", () => {
      expect(matchByRegex("income")).toBe("provision");
    });

    it("should match 'financial'", () => {
      expect(matchByRegex("financial help")).toBe("provision");
    });
  });

  describe("matchByRegex - peace", () => {
    it("should match 'peace'", () => {
      expect(matchByRegex("need peace")).toBe("peace");
    });

    it("should match 'calm'", () => {
      expect(matchByRegex("help me stay calm")).toBe("peace");
    });

    it("should match 'tranquil'", () => {
      expect(matchByRegex("tranquil")).toBe("peace");
    });

    it("should match 'serenity'", () => {
      expect(matchByRegex("serenity")).toBe("peace");
    });

    it("should match 'relief'", () => {
      expect(matchByRegex("relief")).toBe("peace");
    });

    it("should match 'relax'", () => {
      expect(matchByRegex("help me relax")).toBe("peace");
    });
  });

  describe("matchByRegex - no match", () => {
    it("should return null for random text", () => {
      expect(matchByRegex("hello world")).toBeNull();
    });

    it("should return null for gibberish", () => {
      expect(matchByRegex("asdfghjkl")).toBeNull();
    });

    it("should return null for numbers only", () => {
      expect(matchByRegex("123456")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(matchByRegex("")).toBeNull();
    });

    it("should return null for unrelated words", () => {
      expect(matchByRegex("apple banana orange")).toBeNull();
    });
  });

  describe("matchByRegex - priority (first match wins)", () => {
    it("should prioritize sleep when sleep-related words appear", () => {
      // 'sleep' pattern comes before 'night' pattern
      expect(matchByRegex("can't sleep at night")).toBe("sleep");
    });

    it("should match exam before knowledge for exam-related queries", () => {
      // 'exam' matches exam category (more specific than knowledge)
      expect(matchByRegex("anxious about exam")).toBe("exam");
    });

    it("should match first applicable pattern", () => {
      // If multiple patterns could match, first one in MATCH_RULES wins
      const result = matchByRegex("I need sleep because I'm anxious");
      // Should match sleep since it comes first in MATCH_RULES
      expect(result).toBe("sleep");
    });
  });

  describe("MATCH_RULES structure", () => {
    it("should have valid structure", () => {
      expect(Array.isArray(MATCH_RULES)).toBe(true);
      expect(MATCH_RULES.length).toBeGreaterThan(0);
    });

    it("should have category and patterns for each rule", () => {
      MATCH_RULES.forEach((rule) => {
        expect(rule).toHaveProperty("category");
        expect(rule).toHaveProperty("patterns");
        expect(typeof rule.category).toBe("string");
        expect(Array.isArray(rule.patterns)).toBe(true);
        expect(rule.patterns.length).toBeGreaterThan(0);
      });
    });

    it("should have RegExp patterns", () => {
      MATCH_RULES.forEach((rule) => {
        rule.patterns.forEach((pattern) => {
          expect(pattern instanceof RegExp).toBe(true);
        });
      });
    });

    it("should have unique categories", () => {
      const categories = MATCH_RULES.map((r) => r.category);
      const uniqueCategories = new Set(categories);
      expect(categories.length).toBe(uniqueCategories.size);
    });
  });

  describe("real-world query examples", () => {
    it("should handle natural language queries", () => {
      expect(matchByRegex("I'm feeling really anxious today")).toBe("anxiety");
      expect(matchByRegex("Can you help me sleep better?")).toBe("sleep");
      expect(matchByRegex("I have a big exam tomorrow")).toBe("exam");
      expect(matchByRegex("Please forgive me for my sins")).toBe("forgiveness");
      expect(matchByRegex("I'm sick and need healing")).toBe("healing");
      expect(matchByRegex("Thank you Allah for everything")).toBe("gratitude");
    });

    it("should handle mixed case and punctuation", () => {
      expect(matchByRegex("I'M SO STRESSED!!!")).toBe("anxiety");
      expect(matchByRegex("Help! I can't sleep...")).toBe("sleep");
      expect(matchByRegex("Exam tomorrow???")).toBe("exam");
    });

    it("should handle questions", () => {
      expect(matchByRegex("How can I reduce my anxiety?")).toBe("anxiety");
      expect(matchByRegex("What can help me sleep?")).toBe("sleep");
      expect(matchByRegex("Is there a prayer for my exam?")).toBe("exam");
    });

    it("should handle statements", () => {
      expect(matchByRegex("I need help with my anxiety")).toBe("anxiety");
      expect(matchByRegex("I want to sleep peacefully")).toBe("sleep");
      expect(matchByRegex("My exam is stressing me out")).toBe("exam");
    });

    it("should handle short queries", () => {
      expect(matchByRegex("anxiety")).toBe("anxiety");
      expect(matchByRegex("sleep")).toBe("sleep");
      expect(matchByRegex("exam")).toBe("exam");
      expect(matchByRegex("forgive")).toBe("forgiveness");
    });

    it("should handle complex multi-word queries", () => {
      expect(
        matchByRegex("I'm overwhelmed with anxiety about my upcoming exam"),
      ).toBe("exam"); // exam takes priority
      expect(matchByRegex("Feeling stressed and can't sleep at night")).toBe(
        "sleep",
      );
      expect(matchByRegex("Need guidance to find the right path")).toBe(
        "guidance",
      );
    });
  });
});
