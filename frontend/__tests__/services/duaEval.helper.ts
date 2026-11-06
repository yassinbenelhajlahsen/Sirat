import { matchDua } from "@/services/duaMatcher";
import { topicForCategory } from "@/services/duaTopics";
import type { EvalCase } from "../fixtures/duaHeldOut";

const { duas } = require("../../assets/data/duas.json") as { duas: { id: number; category: string }[] };

export type Outcome = "correct" | "wrong" | "general";

/** Topic-level judging: any category inside the expected category's topic counts. */
export function judge(c: EvalCase): { outcome: Outcome; got: string; strict: boolean } {
  const m = matchDua(c.text);
  if (m.kind === "crisis") {
    return { outcome: c.expected === "crisis" ? "correct" : "wrong", got: "crisis", strict: c.expected === "crisis" };
  }
  if (m.kind === "none") {
    return { outcome: c.expected === "none" ? "correct" : "general", got: "none", strict: c.expected === "none" };
  }
  const gotCats = m.categories;
  const gotTopic = topicForCategory(gotCats[0])?.id;
  // General is the dua a no-match shows anyway, so for "none" it is the same outcome without the notice.
  if (c.expected === "none" && gotCats[0] === "General") return { outcome: "correct", got: "General", strict: false };
  if (c.expected === "none" || c.expected === "crisis") return { outcome: "wrong", got: gotCats.join(","), strict: false };
  const wantTopic = topicForCategory(c.expected)?.id;
  const ok = gotTopic === wantTopic;
  return { outcome: ok ? "correct" : "wrong", got: gotCats.join(","), strict: gotCats.includes(c.expected) };
}

export const CATEGORIES = [...new Set(duas.map((d) => d.category))];
