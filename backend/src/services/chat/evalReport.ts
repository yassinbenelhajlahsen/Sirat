// Helpers for scripts/chatEval.ts, the pre-launch question run.
import type { TokenUsage } from "./openai.js";

export type EvalQuestion = { n: number; category: string; question: string; expected: string };

/** Reads `N. question` lines, each followed by an `Expected: …` line, grouped under `## Category` headings. */
export function parseEvalQuestions(md: string): EvalQuestion[] {
  const out: EvalQuestion[] = [];
  let category = "";
  const lines = md.split("\n");
  lines.forEach((line, i) => {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) category = heading[1].trim();
    const q = /^(\d+)\.\s+(.+)$/.exec(line);
    const expected = /^\s+Expected:\s*(.+)$/.exec(lines[i + 1] ?? "");
    if (q && category && expected) out.push({ n: Number(q[1]), category, question: q[2].trim(), expected: expected[1].trim() });
  });
  return out;
}

// gpt-6-luna list prices, USD per 1M tokens (spec cost model).
const INPUT_PER_M = 0.1;
const OUTPUT_PER_M = 0.5;
const cents = (u: TokenUsage) => ((u.input * INPUT_PER_M + u.output * OUTPUT_PER_M) / 1e6) * 100;
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];

const nearestRank = (sorted: number[], p: number) => sorted[Math.max(Math.ceil(sorted.length * p) - 1, 0)];

/** p50 / p90 / max of every timing key, over the answers that recorded it. */
export function timingStats(timings: Record<string, number>[]): Record<string, { p50: number; p90: number; max: number; count: number }> {
  const keys = [...new Set(timings.flatMap(Object.keys))];
  return Object.fromEntries(keys.map((key) => {
    const values = timings.flatMap((t) => (key in t ? [t[key]] : [])).sort((a, b) => a - b);
    return [key, { p50: nearestRank(values, 0.5), p90: nearestRank(values, 0.9), max: values[values.length - 1], count: values.length }];
  }));
}

export function usageStats(usages: TokenUsage[]) {
  const count = usages.length;
  if (!count) return { count, avgInput: 0, avgOutput: 0, p95Total: 0, avgCostCents: 0, p95CostCents: 0 };
  const sum = (f: (u: TokenUsage) => number) => usages.reduce((s, u) => s + f(u), 0);
  return {
    count,
    avgInput: sum((u) => u.input) / count,
    avgOutput: sum((u) => u.output) / count,
    p95Total: p95(usages.map((u) => u.input + u.output)),
    avgCostCents: sum(cents) / count,
    p95CostCents: p95(usages.map(cents)),
  };
}
