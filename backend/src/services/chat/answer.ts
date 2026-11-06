import { ENV } from "../../config/env.js";
import { findReligiousQuote, renderCitations, scrubInternals, stripReligiousQuotes, type Citation } from "./guards.js";
import { generateAnswer, moderate, type TokenUsage } from "./openai.js";
import type { HistoryItem } from "./prompt.js";

export type AnswerOutcome =
  | { kind: "crisis" | "blocked"; usage: TokenUsage }
  | { kind: "answer"; answer: string; citations: Citation[]; scholarLink: string | null; summary: string; isRuling: boolean; usage: TokenUsage };

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
}): Promise<AnswerOutcome> {
  const usage: TokenUsage = { input: 0, output: 0 };
  if ((await moderate(input.message, input.signal)).selfHarm) return { kind: "crisis", usage };

  const ask = async () => {
    const result = await generateAnswer(input);
    usage.input += result.usage?.input ?? 0;
    usage.output += result.usage?.output ?? 0;
    return result;
  };
  let { answer, retrievedIds } = await ask();
  const quoted = findReligiousQuote(answer.answer);
  if (quoted) ({ answer, retrievedIds } = await ask());
  const citations = await renderCitations(answer.citations, retrievedIds);
  const text = scrubInternals(quoted ? stripReligiousQuotes(answer.answer, citations.length > 0) : answer.answer);

  if ((await moderate(text, input.signal)).severe) return { kind: "blocked", usage };

  return {
    kind: "answer",
    answer: text,
    citations,
    scholarLink: answer.isRuling ? ENV.CHAT_SCHOLAR_LINK : null,
    summary: answer.summary,
    isRuling: answer.isRuling,
    usage,
  };
}
