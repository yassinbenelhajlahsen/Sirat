// Usage: npm run chat:eval -- <questions.md> <out.md>
// Runs every question through the live chat steps (no HTTP, no quota) and writes
// the answers for the religious reviewer, plus token use and cost per message.
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../src/db/prisma.js";
import { ENV } from "../src/config/env.js";
import { answerMessage, type AnswerOutcome } from "../src/services/chat/answer.js";
import type { Citation } from "../src/services/chat/guards.js";
import { parseEvalQuestions, usageStats, type EvalQuestion } from "../src/services/chat/evalReport.js";
import type { TokenUsage } from "../src/services/chat/openai.js";

const CONCURRENCY = 4;
const [questionsPath, outPath] = process.argv.slice(2);
if (!questionsPath || !outPath) {
  console.error("Usage: npm run chat:eval -- <questions.md> <out.md>");
  process.exit(1);
}
if (!ENV.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");

const questions = parseEvalQuestions(readFileSync(questionsPath, "utf8"));
console.log(`${questions.length} questions, model ${ENV.OPENAI_MODEL}`);

type Result = { q: EvalQuestion; outcome?: AnswerOutcome; error?: string; ms: number };

const renderCitation = (c: Citation) =>
  c.kind === "quran"
    ? `- Quran ${c.surah}:${c.ayah}\n  - ${c.arabic}${c.english ? `\n  - ${c.english}` : ""}`
    : `- Hadith h:${c.id}, ${c.title} (${c.grade}; ${c.source} · ${c.credit})\n  - ${c.text.trim().replace(/\n+/g, " ")}`;

function renderResult({ q, outcome, error, ms }: Result): string {
  const head = `### ${q.n}. ${q.question}\n\n*${q.category}.* Expected: ${q.expected}\n\n`;
  if (error || !outcome) return `${head}**Result:** FAILED (${error}), the user would see "Chat failed, please try again".\n`;
  const tokens = `Tokens: ${outcome.usage.input} in, ${outcome.usage.output} out. ${(ms / 1000).toFixed(1)}s.`;
  if (outcome.kind === "crisis") return `${head}**Result:** CRISIS, the app shows its fixed crisis message. ${tokens}\n`;
  if (outcome.kind === "blocked") return `${head}**Result:** BLOCKED by answer moderation. ${tokens}\n`;
  const cites = outcome.citations.length ? outcome.citations.map(renderCitation).join("\n") : "- (none)";
  return `${head}**Answer** (ruling: ${outcome.isRuling ? "yes" : "no"}${outcome.scholarLink ? ", scholar link shown" : ""}):\n\n${outcome.answer}\n\n**Sources:**\n\n${cites}\n\n${tokens}\n`;
}

const results: Result[] = new Array(questions.length);
let next = 0;
async function worker() {
  while (next < questions.length) {
    const i = next++;
    const q = questions[i];
    const start = Date.now();
    try {
      const outcome = await answerMessage({ message: q.question, history: [], summary: null, safetyId: "sirat-eval-runner" });
      results[i] = { q, outcome, ms: Date.now() - start };
    } catch (err) {
      results[i] = { q, error: (err as Error).message, ms: Date.now() - start };
    }
    console.log(`${q.n}: ${results[i].outcome?.kind ?? "failed"}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const usages: TokenUsage[] = results.flatMap((r) => (r.outcome?.kind === "answer" ? [r.outcome.usage] : []));
const stats = usageStats(usages);
const count = (k: string) => results.filter((r) => (r.outcome?.kind ?? "failed") === k).length;
const summary = [
  "## Summary",
  "",
  `- Model: ${ENV.OPENAI_MODEL}. Run: ${new Date().toISOString()}.`,
  `- Results: ${count("answer")} answered, ${count("crisis")} crisis, ${count("blocked")} blocked, ${count("failed")} failed.`,
  `- Tokens per answered message: average ${Math.round(stats.avgInput)} in and ${Math.round(stats.avgOutput)} out; p95 ${stats.p95Total} total.`,
  `- Estimated cost per message at gpt-6-luna list prices ($0.10 / $0.50 per 1M tokens): average ${stats.avgCostCents.toFixed(3)} cents, p95 ${stats.p95CostCents.toFixed(3)} cents.`,
  `- At 15 messages a month: about ${(stats.avgCostCents * 15).toFixed(1)} cents per user.`,
  stats.avgCostCents > 0.4 ? "- FLAG: the average is above the 0.4 cents per message budget." : "- Within the 0.4 cents per message budget.",
].join("\n");

writeFileSync(outPath, `# Sirat chatbot: pre-launch answers\n\n${summary}\n\n## Answers\n\n${results.map(renderResult).join("\n")}`);
console.log(summary);
await prisma.$disconnect();
