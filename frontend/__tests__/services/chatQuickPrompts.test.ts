import { CHAT_PROMPTS, pickPrompts, promptsEligible } from "@/services/chat/quickPrompts";
import type { ChatMessage } from "@/services/chat/chatStore";

const at = (ts: number): ChatMessage => ({ id: String(ts), role: "user", text: "hi", createdAt: ts });

it("offers prompts on an empty chat or when the last message is an hour old", () => {
  const now = Date.now();
  expect(promptsEligible([], now)).toBe(true);
  expect(promptsEligible([at(now - 59 * 60_000)], now)).toBe(false);
  expect(promptsEligible([at(now - 60 * 60_000)], now)).toBe(true);
});

it("picks 4 distinct prompts from the 20", () => {
  expect(CHAT_PROMPTS).toHaveLength(20);
  const picked = pickPrompts();
  expect(new Set(picked).size).toBe(4);
  picked.forEach((p) => expect(CHAT_PROMPTS).toContain(p));
});

it("honours count and the injected random, with no repeats", () => {
  expect(pickPrompts(20, () => 0)).toHaveLength(20);
  expect(new Set(pickPrompts(20, () => 0.999)).size).toBe(20);
  expect(pickPrompts(2, () => 0)).toEqual([CHAT_PROMPTS[0], CHAT_PROMPTS[1]]);
});
