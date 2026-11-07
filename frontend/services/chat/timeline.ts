import type { ChatMessage } from "@/services/chat/chatStore";

export const TIME_GAP_MS = 60 * 60 * 1000;

export function timeLineAt(messages: ChatMessage[], index: number): number | null {
  const ts = messages[index].createdAt;
  if (index === 0) return ts;
  return ts - messages[index - 1].createdAt >= TIME_GAP_MS ? ts : null;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function formatTimeLine(ts: number, now: Date): { day: string; time: string } {
  const date = new Date(ts);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  // Round so a DST change inside the span cannot turn 2 days into 1.99.
  const daysAgo = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (daysAgo === 0) return { day: "Today", time };
  if (daysAgo === 1) return { day: "Yesterday", time };
  if (daysAgo >= 2 && daysAgo <= 6) {
    return { day: date.toLocaleDateString([], { weekday: "long" }), time };
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return { day, time };
}
