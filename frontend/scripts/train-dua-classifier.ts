/**
 * Trains the dua classifier (services/duaClassifier.ts) and writes
 * assets/data/duaClassifier.json. Re-run after editing the data files:
 *
 *   npx tsx scripts/train-dua-classifier.ts
 *
 * Data (scripts/dua-classifier/, one `category|request` per line; val and test list every
 * acceptable category, `a,b|request`, and an answer is right when it is any of them):
 *   train.txt + none.txt  trained on, with the matcher's tuning list (__tests__/fixtures/duaTuning.ts)
 *   val.txt               picks the two confidence thresholds
 *   test.txt              never trained on; only reported, and checked by a Jest test
 * val and test labels are the writer's category plus any extra category at least two of three
 * independent labellers also accepted (blind, messages shuffled). Both then went through a blind
 * pairwise check: each message was shown with three shuffled candidate categories (the matcher's
 * answer hidden among two decoys; for val, the answer of a model trained without val) and a category
 * counts as acceptable when two of three judges said a user with that message would be served by its
 * dua. Decoys from other topics were accepted under 3% of the time, so the judges were not lenient.
 * The thresholds must keep every tuning-list case right, so
 * the classifier never undoes a rule that was written on purpose. The shipped model is retrained
 * on everything but test. Training is seeded, so the same data always gives the same model.
 *
 * The model is two votes averaged: a sparse linear model (words, word pairs, 4-letter pieces) and
 * a nearest-neighbour vote over the training requests (tf-idf cosine on words and word pairs).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decideFrom, features, isNeighborFeature, isShort, predict, type DuaClassifierModel, type Prediction } from "../services/duaClassifier";
import { matchKeywords, tokenize, vetoedCategories } from "../services/duaMatcher";
import { topicForCategory } from "../services/duaTopics";
import { TUNING } from "../__tests__/fixtures/duaTuning";

const DIR = join(__dirname, "dua-classifier");
const OUT = join(__dirname, "..", "assets", "data", "duaClassifier.json");
const EPOCHS = 60;
const LEARNING_RATE = 0.4;
// L1 pushes most weights to exactly zero, which keeps the shipped file small.
const L1 = 0.001;
const PRUNE_BELOW = 0.2;
// Weights ship as whole numbers (weight * SCALE) to keep the JSON small.
const SCALE = 100;
// A feature seen in only one training request is mostly noise.
const MIN_REQUESTS = 2;
// Neighbours that vote on a request, and the neighbour vote's share: both picked on val from these.
const K_CHOICES = [10];
const WEIGHT_CHOICES = [0.5];

interface Row { cat: string; cats: string[]; text: string; tokens: string[]; keywords?: string[] | "crisis"; strong?: boolean; vetoed?: Set<string> }

function load(name: string): Row[] {
  return readFileSync(join(DIR, name), "utf8").split("\n").filter((l) => l.includes("|")).map((l) => {
    const i = l.indexOf("|");
    const text = l.slice(i + 1).trim();
    const cats = l.slice(0, i).split(",").map((c) => c.trim()).filter(Boolean);
    return { cat: cats[0], cats, text, tokens: tokenize(text) };
  });
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trainLinear(rows: Row[], classes: string[]): Pick<DuaClassifierModel, "bias" | "weights"> {
  const C = classes.length;
  const index = new Map(classes.map((c, i) => [c, i]));
  const W = new Map<string, Float64Array>();
  const bias = new Float64Array(C);
  const seenIn = new Map<string, number>();
  for (const r of rows) for (const f of features(r.tokens)) seenIn.set(f, (seenIn.get(f) ?? 0) + 1);
  const data = rows
    .map((r) => ({ y: index.get(r.cat)!, f: features(r.tokens).filter((k) => seenIn.get(k)! >= MIN_REQUESTS) }))
    .filter((d) => d.f.length > 0);
  const random = rng(1);
  for (let epoch = 0; epoch < EPOCHS; epoch += 1) {
    const lr = LEARNING_RATE / (1 + epoch * 0.1);
    for (let i = data.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }
    for (const { y, f } of data) {
      const x = 1 / Math.sqrt(f.length);
      const rowsW = f.map((k) => W.get(k) ?? W.set(k, new Float64Array(C)).get(k)!);
      const logits = Float64Array.from(bias);
      for (const w of rowsW) for (let c = 0; c < C; c += 1) logits[c] += w[c] * x;
      const max = Math.max(...logits);
      let sum = 0;
      for (let c = 0; c < C; c += 1) sum += (logits[c] = Math.exp(logits[c] - max));
      for (let c = 0; c < C; c += 1) {
        const g = logits[c] / sum - (c === y ? 1 : 0);
        bias[c] -= lr * g * 0.1;
        for (const w of rowsW) {
          const v = w[c] - lr * g * x;
          w[c] = Math.sign(v) * Math.max(0, Math.abs(v) - lr * L1);
        }
      }
    }
  }
  const weights: Record<string, number[]> = {};
  for (const [k, w] of W) {
    const pairs: number[] = [];
    w.forEach((v, c) => { if (Math.abs(v) >= PRUNE_BELOW) pairs.push(c, Math.round(v * SCALE)); });
    if (pairs.length) weights[k] = pairs;
  }
  return { bias: Array.from(bias, (b) => Math.round(b * 1000) / 1000), weights };
}

function buildNeighbors(rows: Row[], classes: string[]): DuaClassifierModel["neighbors"] {
  const index = new Map(classes.map((c, i) => [c, i]));
  const docFeats = rows.map((r) => [...new Set(features(r.tokens).filter(isNeighborFeature))]);
  const df = new Map<string, number>();
  for (const f of docFeats) for (const k of f) df.set(k, (df.get(k) ?? 0) + 1);
  const vocab = [...df].filter(([, n]) => n >= MIN_REQUESTS).map(([k]) => k).sort();
  const ids = new Map(vocab.map((v, i) => [v, i]));
  const idf = vocab.map((v) => Math.round((Math.log((rows.length + 1) / (df.get(v)! + 1)) + 1) * 100) / 100);
  const docs = rows
    .map((r, i) => {
      const sorted = docFeats[i].map((k) => ids.get(k)).filter((id): id is number => id !== undefined).sort((a, b) => a - b);
      // gap-coded: each id is stored as its distance from the previous one
      return [index.get(r.cat)!, ...sorted.map((id, j) => (j === 0 ? id : id - sorted[j - 1]))];
    })
    .filter((d) => d.length > 1);
  return { vocab, idf, k: K_CHOICES[0], docs };
}

interface Thresholds { threshold: number; override: number; support: number; strongSupport: number; shortThreshold: number; disagreeThreshold: number }
interface Setup extends Thresholds { k: number; neighborWeight: number }

function train(rows: Row[], classes: string[], setup: Setup): DuaClassifierModel {
  const { k, ...th } = setup;
  return { classes, scale: SCALE, ...trainLinear(rows, classes), ...th, neighbors: { ...buildNeighbors(rows, classes)!, k } };
}

type Outcome = "right" | "general" | "wrong";
function judge(cats: string[], got: string | null): Outcome {
  if (got === null || got === "none") return cats.includes("General") || cats.includes("none") ? "right" : "general";
  return cats.includes(got) ? "right" : "wrong";
}

// Keyword results and predictions are computed once per request, then every threshold pair is scored.
const predictions = new WeakMap<DuaClassifierModel, Map<Row, Prediction | null>>();
function prepared(r: Row, model: DuaClassifierModel | null): { keywords: string[] | "crisis"; strong: boolean; vetoed: Set<string>; p: Prediction | null } {
  if (!r.keywords) {
    const m = matchKeywords(r.text);
    r.keywords = m.kind === "crisis" ? "crisis" : m.kind === "match" ? m.categories : [];
    r.strong = m.kind === "match" && m.strong === true;
    r.vetoed = vetoedCategories(r.tokens);
  }
  let p: Prediction | null = null;
  if (model) {
    const cache = predictions.get(model) ?? predictions.set(model, new Map()).get(model)!;
    if (!cache.has(r)) cache.set(r, predict(model, r.tokens));
    p = cache.get(r)!;
  }
  return { keywords: r.keywords, strong: r.strong!, vetoed: r.vetoed!, p };
}

/** Scores requests with the same decision matchDua makes in the app. */
function evaluate(rows: Row[], model: DuaClassifierModel | null, th: Thresholds) {
  const tally: Record<Outcome, number> = { right: 0, general: 0, wrong: 0 };
  for (const r of rows) {
    const { keywords, strong, vetoed, p } = prepared(r, model);
    let got: string | null = null;
    if (keywords !== "crisis") {
      got = model ? decideFrom({ classes: model.classes, ...th }, p, keywords, strong, vetoed, isShort(r.tokens))?.[0] ?? null : keywords[0] ?? null;
    }
    tally[judge(r.cats, got)] += 1;
  }
  const pct = (n: number) => `${((100 * n) / rows.length).toFixed(1)}%`;
  return { ...tally, line: `right ${pct(tally.right)} | general ${pct(tally.general)} | wrong ${pct(tally.wrong)}` };
}

// The tuning list is judged by topic, as its Jest test does: any category in the expected topic is right.
const tuning: Row[] = TUNING.filter((c) => c.expected !== "crisis").map((c) => ({
  cat: c.expected,
  cats: c.expected === "none" ? ["none"] : topicForCategory(c.expected)?.categories ?? [c.expected],
  text: c.text,
  tokens: tokenize(c.text),
}));
const trainRows = [...load("train.txt"), ...load("none.txt"), ...tuning.filter((r) => r.cat !== "none")];
const val = load("val.txt");
const test = load("test.txt");
const classes = [...new Set([...trainRows, ...val, "none"].map((r) => (typeof r === "string" ? r : r.cat)))].sort();

// The thresholds are picked on val, never on test, and must keep the whole tuning list right.
// A wrong dua counts WRONG_COST times worse than the general one: showing the general dua is the
// matcher's stated fallback, a wrong dua is the failure the product wants least.
const WRONG_COST = Number(process.env.WRONG_COST ?? 3);
const NONE: Setup = { threshold: 1, override: 2, support: 0, strongSupport: 0, shortThreshold: 0, disagreeThreshold: 0, k: K_CHOICES[0], neighborWeight: 0.5 };
const base = train(trainRows, classes, NONE);
let best = { setup: NONE, score: -Infinity, model: base };
for (const k of K_CHOICES) {
  for (const neighborWeight of WEIGHT_CHOICES) {
    // same weights and index, different vote settings (a new object so predictions are cached per setting)
    const candidate: DuaClassifierModel = { ...base, neighborWeight, neighbors: { ...base.neighbors!, k } };
    for (const override of [0.2, 0.25, 0.3, 0.4, 0.5, 0.7, 2]) {
      for (const threshold of [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5]) {
        if (threshold > override) continue;
        for (const support of [0, 0.05, 0.1, 0.15]) {
          for (const strongSupport of [0, 0.03, 0.05, 0.1]) {
            if (strongSupport > support) continue;
            for (const shortThreshold of [0, 0.4, 0.5]) {
              if (shortThreshold && shortThreshold <= threshold) continue;
              for (const disagreeThreshold of [0, 0.3, 0.4, 0.5]) {
                if (disagreeThreshold && disagreeThreshold <= threshold) continue;
                const th = { threshold, override, support, strongSupport, shortThreshold, disagreeThreshold };
                if (evaluate(tuning, candidate, th).right !== tuning.length) continue;
                const v = evaluate(val, candidate, th);
                const score = v.right - WRONG_COST * v.wrong;
                if (score > best.score) best = { setup: { ...th, k, neighborWeight }, score, model: candidate };
              }
            }
          }
        }
      }
    }
  }
}
const candidate = best.model;
// CANDIDATE_OUT=path dumps the train-only model, for policy experiments that must select on val honestly.
if (process.env.CANDIDATE_OUT) writeFileSync(process.env.CANDIDATE_OUT, JSON.stringify({ ...candidate, ...best.setup }));
console.log(`setup ${JSON.stringify(best.setup)}  (val ${evaluate(val, candidate, best.setup).line})`);
console.log(`test keywords only          ${evaluate(test, null, NONE).line}`);
console.log(`test keywords + classifier  ${evaluate(test, candidate, best.setup).line}`);

const shipped = train([...trainRows, ...val], classes, best.setup);
const json = JSON.stringify(shipped);
writeFileSync(OUT, json);
console.log(`\nwrote ${OUT} (${(json.length / 1024).toFixed(0)} KB, ${Object.keys(shipped.weights).length} features, ${shipped.neighbors!.docs.length} neighbour docs)`);
console.log(`test shipped model          ${evaluate(test, shipped, best.setup).line}`);
console.log(`tuning list, shipped model  ${evaluate(tuning, shipped, best.setup).line}`);
