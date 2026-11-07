import { ENV } from "../../config/env.js";
import { findReligiousQuote, numberCitations, renderCitations, scrubInternals, stripReligiousQuotes, type Citation } from "./guards.js";
import { generateAnswer, moderate, type ChatStage, type TokenUsage } from "./openai.js";
import type { HistoryItem } from "./prompt.js";

/** Milliseconds per stage, plus model `rounds` and tool `searches`. Numbers only, so it is safe to log. */
export type Timings = Record<string, number>;

export type AnswerOutcome =
  | { kind: "crisis" | "blocked"; usage: TokenUsage; timings: Timings }
  | { kind: "answer"; answer: string; citations: Citation[]; scholarLink: string | null; summary: string; isRuling: boolean; usage: TokenUsage; timings: Timings };

/**
 * Everything between the quota claim and the reply: moderate the question,
 * answer, guard the answer, moderate it, render citations. Shared by the route
 * and the eval runner so the eval tests what ships.
 */
export async function answerMessage(input: {
  message: string;
  history: HistoryItem[];
  summary: string | null;
  safetyId: string;
  signal?: AbortSignal;
  onStage?: (stage: ChatStage) => void;
}): Promise<AnswerOutcome> {
  const start = Date.now();
  const usage: TokenUsage = { input: 0, output: 0 };
  const timings: Timings = { rounds: 0, searches: 0 };
  const timed = async <T>(stage: string, run: () => Promise<T>): Promise<T> => {
    const t = Date.now();
    try {
      return await run();
    } finally {
      timings[stage] = Date.now() - t;
    }
  };
  const done = () => ({ ...timings, total: Date.now() - start });

  // The question check runs alongside the model; nothing the model wrote is used until the check passes.
  const stopModel = new AbortController();
  const signal = input.signal ? AbortSignal.any([input.signal, stopModel.signal]) : stopModel.signal;
  const ask = async () => {
    const result = await generateAnswer({ ...input, signal });
    usage.input += result.usage?.input ?? 0;
    usage.output += result.usage?.output ?? 0;
    timings.rounds += result.rounds ?? 0;
    timings.searches += result.searches ?? 0;
    return result;
  };
  const first = timed("generate", ask);
  // Its failure surfaces from the await below, or is moot after a crisis verdict.
  first.catch(() => {});
  let verdict: Awaited<ReturnType<typeof moderate>>;
  try {
    verdict = await timed("moderateQuestion", () => moderate(input.message, input.signal));
  } catch (err) {
    stopModel.abort();
    throw err;
  }
  if (verdict.selfHarm) {
    stopModel.abort();
    return { kind: "crisis", usage, timings: done() };
  }

  let { answer, retrievedIds } = await first;
  const quoted = findReligiousQuote(answer.answer);
  if (quoted) ({ answer, retrievedIds } = await timed("quoteRetry", ask));
  const citations = await timed("renderCitations", () => renderCitations(answer.citations, retrievedIds));
  const text = scrubInternals(quoted ? stripReligiousQuotes(answer.answer, citations.length > 0) : answer.answer);

  const numbered = numberCitations(text, citations);

  if ((await timed("moderateAnswer", () => moderate(numbered.text, input.signal))).severe) {
    return { kind: "blocked", usage, timings: done() };
  }

  return {
    kind: "answer",
    answer: numbered.text,
    citations: numbered.citations,
    scholarLink: answer.isRuling ? ENV.CHAT_SCHOLAR_LINK : null,
    summary: answer.summary,
    isRuling: answer.isRuling,
    usage,
    timings: done(),
  };
}
