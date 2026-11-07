import { formatTimeLine, timeLineAt } from "@/services/chat/timeline";
import type { ChatMessage } from "@/services/chat/chatStore";

const at = (ts: number): ChatMessage => ({ id: String(ts), role: "user", text: "hi", createdAt: ts });

describe("timeLineAt", () => {
  it("labels the first message and any message 60+ minutes after the previous", () => {
    const t = Date.UTC(2026, 10, 6, 9);
    const msgs = [at(t), at(t + 59 * 60_000), at(t + 59 * 60_000 + 60 * 60_000)];
    expect(msgs.map((_, i) => timeLineAt(msgs, i))).toEqual([t, null, msgs[2].createdAt]);
  });
});

describe("formatTimeLine", () => {
  const now = new Date(2026, 10, 6, 12);

  it("formats Today, Yesterday, weekday within 7 days, else a short date", () => {
    expect(formatTimeLine(new Date(2026, 10, 6, 8, 15).getTime(), now).day).toBe("Today");
    expect(formatTimeLine(new Date(2026, 10, 5, 21, 41).getTime(), now).day).toBe("Yesterday");
    expect(formatTimeLine(new Date(2026, 10, 2, 10).getTime(), now).day).toBe("Monday");
    expect(formatTimeLine(new Date(2026, 9, 20, 10).getTime(), now).day).toBe("Oct 20");
  });

  it("compares calendar days, not 24h windows", () => {
    const lateNow = new Date(2026, 10, 6, 0, 30);
    expect(formatTimeLine(new Date(2026, 10, 5, 23, 50).getTime(), lateNow).day).toBe("Yesterday");
  });

  it("adds the year when it differs from now's", () => {
    expect(formatTimeLine(new Date(2025, 11, 25, 10).getTime(), now).day).toBe("Dec 25, 2025");
  });

  it("returns a time string", () => {
    expect(formatTimeLine(new Date(2026, 10, 6, 8, 15).getTime(), now).time).toMatch(/8:15/);
  });
});
