import { ENV } from "../../config/env.js";
import { buildInput, SYSTEM_PROMPT, type HistoryItem } from "./prompt.js";
import { searchHadith, searchQuran, type SourceHit } from "./sourceSearch.js";

const API = "https://api.openai.com/v1";
const TIMEOUT_MS = 30_000;
const MAX_SEARCHES = 3;
const MAX_OUTPUT_TOKENS = 900;
const MAX_SUMMARY = 1200;

export type ModelAnswer = { answer: string; citations: string[]; isRuling: boolean; summary: string };
export type TokenUsage = { input: number; output: number };

type OutputItem = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type?: string; text?: string }[];
};
type ResponsesReply = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: OutputItem[];
  usage?: { input_tokens?: number; output_tokens?: number };
};
type ModerationReply = { results?: { categories?: Record<string, boolean> }[] };

// Fixed message on purpose: nothing from the request or OpenAI's reply rides along to a log.
const failed = () => new Error("chat_model_failed");

async function post<T>(path: string, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error("chat_openai_unreachable", path, (err as Error)?.name);
    throw failed();
  }
  if (!res.ok) {
    console.error("chat_openai_error", path, res.status);
    throw failed();
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw failed();
  }
}

export async function moderate(text: string): Promise<{ selfHarm: boolean; severe: boolean }> {
  const data = await post<ModerationReply>("/moderations", { model: ENV.OPENAI_MODERATION_MODEL, input: text });
  const categories = data?.results?.[0]?.categories;
  if (!categories || typeof categories !== "object") throw failed();
  const on = (key: string) => categories[key] === true;
  return {
    selfHarm: Object.keys(categories).some((k) => k.startsWith("self-harm") && on(k)),
    severe: on("sexual/minors") || on("illicit/violent"),
  };
}

const searchTool = (name: string, description: string) => ({
  type: "function",
  name,
  description,
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: { query: { type: "string", description: "One to four English keywords, e.g. \"usury\" or \"interest or usury\"" } },
  },
});

const TOOLS = [
  searchTool("search_quran", "Search the English meaning of the Quran. Returns verses with IDs like q:2:275."),
  searchTool("search_hadith", "Search a collection of graded hadith in English. Returns hadith with IDs like h:2962."),
];

const SEARCHES: Record<string, (q: string) => Promise<SourceHit[]>> = {
  search_quran: searchQuran,
  search_hadith: searchHadith,
};

const ANSWER_FORMAT = {
  type: "json_schema",
  name: "chat_answer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["answer", "citations", "isRuling", "summary"],
    properties: {
      answer: { type: "string" },
      citations: { type: "array", items: { type: "string" } },
      isRuling: { type: "boolean" },
      summary: { type: "string" },
    },
  },
};

function parseAnswer(output: OutputItem[]): ModelAnswer {
  const message = output.find((o) => o?.type === "message");
  const text = message?.content?.find((c) => c?.type === "output_text")?.text;
  let parsed: Partial<Record<keyof ModelAnswer, unknown>> | null;
  try {
    parsed = JSON.parse(text ?? "");
  } catch {
    throw failed();
  }
  const { answer, citations, isRuling, summary } = parsed ?? {};
  if (
    typeof answer !== "string" || !answer.trim() ||
    !Array.isArray(citations) || !citations.every((c) => typeof c === "string") ||
    typeof isRuling !== "boolean" || typeof summary !== "string"
  ) {
    throw failed();
  }
  return { answer, citations, isRuling, summary: summary.slice(0, MAX_SUMMARY) };
}

async function runSearch(call: OutputItem): Promise<SourceHit[]> {
  const name = call.name ?? "";
  const search = Object.prototype.hasOwnProperty.call(SEARCHES, name) ? SEARCHES[name] : undefined;
  let query: unknown;
  try {
    query = JSON.parse(call.arguments ?? "")?.query;
  } catch {
    return [];
  }
  if (!search || typeof query !== "string") return [];
  try {
    return await search(query.slice(0, 200));
  } catch (err) {
    console.error("chat_search_failed", (err as Error)?.name);
    return [];
  }
}

/**
 * Answers with up to MAX_SEARCHES tool searches, then one final call with no tools.
 * `retrievedIds` is every source ID a search returned: the only IDs a citation may use.
 */
export async function generateAnswer(input: {
  message: string;
  history: HistoryItem[];
  summary: string | null;
  safetyId: string;
}): Promise<{ answer: ModelAnswer; retrievedIds: Set<string>; usage: TokenUsage }> {
  const conversation: unknown[] = buildInput(input);
  const retrievedIds = new Set<string>();
  const usage: TokenUsage = { input: 0, output: 0 };
  let searches = 0;

  for (;;) {
    const toolsAllowed = searches < MAX_SEARCHES;
    const data = await post<ResponsesReply>("/responses", {
      model: ENV.OPENAI_MODEL,
      instructions: SYSTEM_PROMPT,
      input: conversation,
      ...(toolsAllowed ? { tools: TOOLS } : {}),
      text: { format: ANSWER_FORMAT },
      reasoning: { effort: "low" },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      safety_identifier: input.safetyId,
      store: false,
    });
    usage.input += data?.usage?.input_tokens ?? 0;
    usage.output += data?.usage?.output_tokens ?? 0;
    const output = Array.isArray(data?.output) ? data.output : [];
    const calls = output.filter((o) => o?.type === "function_call");

    if (!calls.length || !toolsAllowed) {
      try {
        return { answer: parseAnswer(output), retrievedIds, usage };
      } catch (err) {
        console.error("chat_model_bad_output", data?.status, data?.incomplete_details?.reason);
        throw err;
      }
    }

    // Stateless requests must send back every output item, reasoning included.
    conversation.push(...output);
    for (const call of calls) {
      let hits: SourceHit[] = [];
      if (searches < MAX_SEARCHES) {
        searches++;
        hits = await runSearch(call);
        hits.forEach((h) => retrievedIds.add(h.id));
      }
      // Every call needs an output, even past the limit, or the next request is rejected.
      conversation.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(hits) });
    }
  }
}
