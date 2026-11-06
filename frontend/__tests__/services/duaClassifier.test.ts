import { readFileSync } from "node:fs";
import { join } from "node:path";

import { bundledModel, decideFrom, predict, type DuaClassifierModel, type Prediction } from "@/services/duaClassifier";
import { matchDua, tokenize } from "@/services/duaMatcher";

// A toy model: two categories plus "none", one word each, so decisions are easy to reason about.
const toy: DuaClassifierModel = {
  classes: ["exam", "none", "sleep"],
  bias: [0, 0, 0],
  scale: 100,
  weights: { wexam: [0, 300], wsleep: [2, 300], wtired: [2, 150] },
  threshold: 0.3,
  override: 0.5,
  support: 0.1,
  strongSupport: 0.02,
  shortThreshold: 0.5,
  disagreeThreshold: 0.5,
};
const guess = (probs: number[], votesAgree = true): Prediction => ({ category: toy.classes[probs.indexOf(Math.max(...probs))], confidence: Math.max(...probs), probs, votesAgree });

describe("services/duaClassifier", () => {
  describe("decideFrom", () => {
    it("answers alone only above the threshold", () => {
      expect(decideFrom(toy, guess([0.6, 0.2, 0.2]), [], false, new Set())).toEqual(["exam"]);
      expect(decideFrom(toy, guess([0.25, 0.5, 0.25]), [], false, new Set())).toBeNull();
      expect(decideFrom(toy, guess([0.2, 0.1, 0.7]), [], false, new Set(["sleep"]))).toBeNull();
    });

    it("keeps a keyword match it finds plausible, and needs less for a strong phrase", () => {
      // "none" leads, so nothing can override; the keyword survives on its own probability.
      const p = guess([0.4, 0.55, 0.05]);
      expect(decideFrom(toy, p, ["sleep"], true, new Set())).toEqual(["sleep"]);
      expect(decideFrom(toy, p, ["sleep"], false, new Set())).toBeNull();
      expect(decideFrom(toy, guess([0.4, 0.45, 0.15]), ["sleep"], false, new Set())).toEqual(["sleep"]);
      // an unsupported weak keyword falls back to the classifier when that is usable (even below the override bar)
      expect(decideFrom(toy, guess([0.48, 0.44, 0.08]), ["sleep"], false, new Set())).toEqual(["exam"]);
    });

    it("overrules a keyword match only when sure and clearly surer than the keyword's category", () => {
      expect(decideFrom(toy, guess([0.7, 0.1, 0.2]), ["sleep"], true, new Set())).toEqual(["exam"]);
      expect(decideFrom(toy, guess([0.55, 0.05, 0.4]), ["sleep"], true, new Set())).toEqual(["sleep"]);
    });

    it("asks more of itself on a request of three words or fewer", () => {
      const p = guess([0.45, 0.35, 0.2]);
      expect(decideFrom(toy, p, [], false, new Set(), false)).toEqual(["exam"]);
      expect(decideFrom(toy, p, [], false, new Set(), true)).toBeNull();
      expect(decideFrom(toy, guess([0.6, 0.2, 0.2]), [], false, new Set(), true)).toEqual(["exam"]);
    });

    it("asks more of itself when its two votes disagree", () => {
      expect(decideFrom(toy, guess([0.45, 0.35, 0.2], true), [], false, new Set())).toEqual(["exam"]);
      expect(decideFrom(toy, guess([0.45, 0.35, 0.2], false), [], false, new Set())).toBeNull();
    });

    it("breaks a keyword tie with the classifier and trusts the rule when it knows no word", () => {
      expect(decideFrom(toy, guess([0.3, 0.1, 0.6]), ["exam", "sleep"], true, new Set())).toEqual(["sleep"]);
      expect(decideFrom(toy, null, ["exam"], false, new Set())).toEqual(["exam"]);
      expect(decideFrom(toy, null, [], false, new Set())).toBeNull();
    });
  });

  describe("bundled model", () => {
    const model = bundledModel();

    it("has sane thresholds and a neighbour index", () => {
      expect(model.classes).toContain("none");
      for (const v of [model.threshold, model.override, model.support, model.strongSupport]) expect(v).toBeGreaterThanOrEqual(0);
      expect(model.support).toBeGreaterThanOrEqual(model.strongSupport);
      expect(model.neighbors?.docs.length).toBeGreaterThan(5000);
      expect(model.neighbors?.vocab.length).toBe(model.neighbors?.idf.length);
    });

    it("is deterministic and under the asset budget", () => {
      const a = predict(model, tokenize("my exam is tomorrow and I am scared"));
      const b = predict(model, tokenize("my exam is tomorrow and I am scared"));
      expect(a).toEqual(b);
      expect(readFileSync(join(__dirname, "../../assets/data/duaClassifier.json")).length).toBeLessThan(4 * 1024 * 1024);
    });

    // test.txt was never trained on: every line is `acceptable categories|request`. A result is right
    // when it is any acceptable category, general when it is no match (right if General is acceptable).
    it("meets the bar on the unseen test requests", () => {
      const rows = readFileSync(join(__dirname, "../../scripts/dua-classifier/test.txt"), "utf8")
        .split("\n")
        .filter((l) => l.includes("|"))
        .map((l) => ({ cats: l.slice(0, l.indexOf("|")).split(","), text: l.slice(l.indexOf("|") + 1) }));
      const tally = { right: 0, general: 0, wrong: 0 };
      for (const { cats, text } of rows) {
        const m = matchDua(text);
        if (m.kind !== "match") tally[cats.includes("General") ? "right" : "general"] += 1;
        else tally[cats.includes(m.categories[0]) ? "right" : "wrong"] += 1;
      }
      const pct = (n: number) => (100 * n) / rows.length;
      expect(rows.length).toBeGreaterThanOrEqual(400);
      expect(pct(tally.right)).toBeGreaterThanOrEqual(RIGHT_AT_LEAST);
      expect(pct(tally.wrong)).toBeLessThanOrEqual(WRONG_AT_MOST);
    });
  });
});

// The bars sit a little under the measured result (see scripts/train-dua-classifier.ts output), so a
// retrain that drifts is caught without the test flapping on a single request.
const RIGHT_AT_LEAST = 76;
const WRONG_AT_MOST = 10;
