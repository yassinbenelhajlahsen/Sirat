/**
 * Trained classifier for dua requests (scripts/train-dua-classifier.ts writes the model).
 * Two cheap models vote together: a sparse linear (softmax) model over words, word pairs and
 * 4-letter pieces, and a nearest-neighbour vote over the training requests (tf-idf cosine on
 * words and word pairs). Same input always gives the same answer, it runs offline in a few
 * milliseconds, and nothing typed leaves the device.
 */

export interface DuaClassifierModel {
  /** Category ids, plus "none" for requests no dua fits. */
  classes: string[];
  bias: number[];
  /** Weights are stored as whole numbers: divide by this. */
  scale: number;
  /** feature -> flat [classIndex, weight, classIndex, weight, ...] */
  weights: Record<string, number[]>;
  /** Below this confidence a request the keyword rules cannot place stays "no match" (the general dua). */
  threshold: number;
  /** At or above this confidence (and twice the keyword category's) the classifier overrules a keyword match. */
  override: number;
  /** A keyword match is kept only when the classifier gives its category at least this probability. */
  support: number;
  /** Same, for a strong keyword match (a full phrase rather than weak words). */
  strongSupport: number;
  /** A request of three words or fewer with no keyword match needs at least this confidence; 0 when absent. */
  shortThreshold?: number;
  /** When the two votes name different categories, a classifier-only answer needs at least this confidence; 0 when absent. */
  disagreeThreshold?: number;
  /** Nearest-neighbour vote; absent in older model files. `docs` rows are [classIndex, firstVocabId, gap, gap, ...] (ids ascending, gap-coded to keep the file small). */
  neighbors?: { vocab: string[]; idf: number[]; k: number; docs: number[][] };
  /** Share of the neighbour vote in the final probabilities (the linear model gets the rest); 0.5 when absent. */
  neighborWeight?: number;
}

/** Words, word pairs, and 4 letter pieces of longer words so a typo still shares most features. */
export function features(tokens: string[]): string[] {
  const words = tokens.filter((t) => /^[a-z0-9]+$/.test(t));
  const out = new Set<string>();
  words.forEach((w, i) => {
    out.add(`w${w}`);
    if (i > 0) out.add(`b${words[i - 1]} ${w}`);
    if (w.length < 4) return;
    const padded = `<${w}>`;
    for (let k = 0; k + 4 <= padded.length; k += 1) out.add(`c${padded.slice(k, k + 4)}`);
  });
  return [...out];
}

/** The subset of features the neighbour index is built on. */
export const isNeighborFeature = (f: string) => f[0] !== "c";

export interface Prediction {
  category: string;
  confidence: number;
  /** Probability per class, in model.classes order. */
  probs: number[];
  /** False when the linear model and the neighbour vote put different categories first. */
  votesAgree: boolean;
}

function linearProbs(model: DuaClassifierModel, feats: string[]): number[] | null {
  const known = feats.filter((f) => Object.prototype.hasOwnProperty.call(model.weights, f));
  if (known.length === 0) return null;
  const x = 1 / (Math.sqrt(known.length) * model.scale);
  const logits = model.bias.slice();
  for (const f of known) {
    const pairs = model.weights[f];
    for (let i = 0; i < pairs.length; i += 2) logits[pairs[i]] += pairs[i + 1] * x;
  }
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

interface NeighborIndex {
  ids: Map<string, number>;
  postings: Map<number, number[]>;
  norms: Float64Array;
}
const indexes = new WeakMap<DuaClassifierModel, NeighborIndex>();

function neighborIndex(model: DuaClassifierModel): NeighborIndex {
  let index = indexes.get(model);
  if (index) return index;
  const nb = model.neighbors!;
  const ids = new Map(nb.vocab.map((v, i) => [v, i]));
  const postings = new Map<number, number[]>();
  const norms = new Float64Array(nb.docs.length);
  nb.docs.forEach((doc, d) => {
    let n = 0;
    let id = 0;
    for (let i = 1; i < doc.length; i += 1) {
      id += doc[i];
      n += nb.idf[id] * nb.idf[id];
      const list = postings.get(id);
      if (list) list.push(d);
      else postings.set(id, [d]);
    }
    norms[d] = Math.sqrt(n) || 1;
  });
  index = { ids, postings, norms };
  indexes.set(model, index);
  return index;
}

function neighborProbs(model: DuaClassifierModel, feats: string[]): number[] | null {
  const nb = model.neighbors;
  if (!nb) return null;
  const { ids, postings, norms } = neighborIndex(model);
  const q = [...new Set(feats.filter(isNeighborFeature))].map((f) => ids.get(f)).filter((id): id is number => id !== undefined);
  if (q.length === 0) return null;
  let qnorm = 0;
  const sims = new Map<number, number>();
  for (const id of q) {
    const w = nb.idf[id] * nb.idf[id];
    qnorm += w;
    for (const d of postings.get(id) ?? []) sims.set(d, (sims.get(d) ?? 0) + w);
  }
  qnorm = Math.sqrt(qnorm);
  const top = [...sims].map(([d, s]) => [d, s / (qnorm * norms[d])] as const).sort((a, b) => b[1] - a[1]).slice(0, nb.k);
  const probs = new Array<number>(model.classes.length).fill(0);
  let sum = 0;
  for (const [d, sim] of top) {
    probs[nb.docs[d][0]] += sim;
    sum += sim;
  }
  return sum > 0 ? probs.map((p) => p / sum) : null;
}

export function predict(model: DuaClassifierModel, tokens: string[]): Prediction | null {
  const feats = features(tokens);
  const linear = linearProbs(model, feats);
  const near = neighborProbs(model, feats);
  if (!linear && !near) return null;
  const w = model.neighborWeight ?? 0.5;
  const probs = linear && near ? linear.map((p, i) => (1 - w) * p + w * near[i]) : (linear ?? near)!;
  const top = (p: number[]) => { let b = 0; for (let i = 1; i < p.length; i += 1) if (p[i] > p[b]) b = i; return b; };
  const best = top(probs);
  const votesAgree = !linear || !near || top(linear) === top(near);
  return { category: model.classes[best], confidence: probs[best], probs, votesAgree };
}

let bundled: DuaClassifierModel | null = null;

// To overrule a keyword match the classifier must also rate its own answer this many times higher.
const OVERRIDE_RATIO = 2;

/**
 * Combines the keyword result with the classifier. `keywordCategories` is empty when the rules
 * found nothing, has one entry for a clear match, and several for a tie; `strongKeyword` says a
 * full phrase matched rather than weak words. `vetoed` are categories a rule explicitly excludes
 * for this request ("I feel jealous" is not the envy dua).
 * Returns the chosen categories, or null for "no match".
 */
export function decide(
  model: DuaClassifierModel,
  tokens: string[],
  keywordCategories: string[],
  strongKeyword: boolean,
  vetoed: Set<string>,
): string[] | null {
  return decideFrom(model, predict(model, tokens), keywordCategories, strongKeyword, vetoed, isShort(tokens));
}

/** Three words or fewer: too little context for the classifier to be trusted at its usual bar. */
export const isShort = (tokens: string[]) => tokens.filter((t) => /^[a-z0-9]+$/.test(t)).length <= 3;

export type DecisionThresholds = Pick<DuaClassifierModel, "classes" | "threshold" | "override" | "support" | "strongSupport" | "shortThreshold" | "disagreeThreshold">;

/** `decide` for an already computed prediction (the trainer scores many thresholds per request). */
export function decideFrom(
  model: DecisionThresholds,
  p: Prediction | null,
  keywordCategories: string[],
  strongKeyword: boolean,
  vetoed: Set<string>,
  shortRequest = false,
): string[] | null {
  const usable = p && p.category !== "none" && !vetoed.has(p.category);
  const alone = Math.max(model.threshold, shortRequest ? model.shortThreshold ?? 0 : 0, p && !p.votesAgree ? model.disagreeThreshold ?? 0 : 0);
  if (keywordCategories.length === 0) return usable && p.confidence >= alone ? [p.category] : null;
  // The request is in words the classifier has never seen: the rule is the only evidence.
  if (!p) return [keywordCategories[0]];
  const prob = (c: string) => p.probs[model.classes.indexOf(c)] ?? 0;
  // A tie: the tied category the classifier rates highest.
  const keyword = keywordCategories.reduce((a, b) => (prob(b) > prob(a) ? b : a));
  const keywordProb = prob(keyword);
  if (usable && p.category !== keyword && p.confidence >= model.override && p.confidence >= OVERRIDE_RATIO * keywordProb) {
    return [p.category];
  }
  if (keywordProb >= (strongKeyword ? model.strongSupport : model.support)) return [keyword];
  return usable && p.confidence >= alone ? [p.category] : null;
}

export function bundledModel(): DuaClassifierModel {
  bundled ??= require("../assets/data/duaClassifier.json") as DuaClassifierModel;
  return bundled;
}
