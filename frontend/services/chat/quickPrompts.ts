import type { ChatMessage } from "@/services/chat/chatStore";
import { TIME_GAP_MS } from "@/services/chat/timeline";

export const CHAT_PROMPTS: readonly string[] = [
  "How do I make up a missed prayer?",
  "What breaks the fast?",
  "A dua for anxiety",
  "How is zakat calculated?",
  "Can I combine prayers when travelling?",
  "How do I perform wudu?",
  "A dua before sleeping",
  "What should I say after each prayer?",
  "Is it okay to pray with shoes on?",
  "What are the sunnah prayers before Fajr?",
  "How do I pray Witr?",
  "A dua for someone who is sick",
  "What breaks wudu?",
  "How do I do the prostration of forgetfulness?",
  "A dua before travelling",
  "Can I read the Quran without wudu?",
  "What if I arrive late to Jumu'ah?",
  "What is special about Ayat al-Kursi?",
  "A dua when it rains",
  "How can I build a daily Quran habit?",
];

export function pickPrompts(count = 4, random: () => number = Math.random): string[] {
  const pool = [...CHAT_PROMPTS];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

export function promptsEligible(messages: ChatMessage[], now: number): boolean {
  if (messages.length === 0) return true;
  return now - messages[messages.length - 1].createdAt >= TIME_GAP_MS;
}
