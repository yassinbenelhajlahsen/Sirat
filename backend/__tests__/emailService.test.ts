import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { FeedbackReport } from "@prisma/client";

const mockFetch = jest.fn() as jest.Mock<any>;

function report(overrides: Partial<FeedbackReport> = {}): FeedbackReport {
  return {
    id: "rep_1",
    createdAt: new Date("2026-11-05T12:00:00.000Z"),
    type: "bug",
    message: "Crash\non launch",
    email: "user@example.com",
    userId: "user_abc",
    appVersion: "1.4.0",
    platform: "ios",
    device: "iPhone15,2 (iOS 18.1)",
    diagnostics: { context: { os: "iOS" }, entries: [{ kind: "error", message: "boom" }] },
    ...overrides,
  } as FeedbackReport;
}

async function load(apiKey = "re_test") {
  process.env.RESEND_API_KEY = apiKey;
  return import("../src/services/emailService.js");
}

function sentBody() {
  return JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
}

describe("sendFeedbackEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    (globalThis as any).fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("posts a plain-text email to Resend", async () => {
    const { sendFeedbackEmail } = await load();
    await sendFeedbackEmail(report());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = sentBody();
    expect(body.from).toBe("Sirat Support <support@sirat.dev>");
    expect(body.to).toEqual(["support@sirat.dev"]);
    expect(body.reply_to).toBe("user@example.com");
    expect(body).not.toHaveProperty("html");
    expect(body.text).toContain("Crash\non launch");
    expect(body.text).toContain("rep_1");
    expect(body.text).toContain("1.4.0");
    expect(body.text).toContain("iPhone15,2 (iOS 18.1)");
    expect(body.text).toContain("boom");
  });

  it("lists the log with readable times and the settings", async () => {
    const { sendFeedbackEmail } = await load();
    await sendFeedbackEmail(report({
      diagnostics: {
        context: { deviceModel: "iPhone 14 Pro", timeZone: "America/New_York", prayerMethod: 2 },
        entries: [
          { at: Date.UTC(2026, 10, 6, 1, 0, 24), kind: "network", message: "GET /api/prayer-times/timings: 500" },
          { at: Date.UTC(2026, 10, 6, 1, 0, 30), kind: "fatal", message: "boom", stack: "at Home" },
        ],
      } as any,
    }));
    const { text } = sentBody();
    expect(text).toContain("timeZone: America/New_York");
    expect(text).toContain("prayerMethod: 2");
    expect(text).toContain("2026-11-06T01:00:24.000Z [network] GET /api/prayer-times/timings: 500");
    expect(text).toContain("2026-11-06T01:00:30.000Z [fatal] boom\n    at Home");
    expect(text).not.toContain("1793");
  });

  it("falls back to raw JSON for an unexpected log shape", async () => {
    const { sendFeedbackEmail } = await load();
    await sendFeedbackEmail(report({ diagnostics: { surprise: "kept" } as any }));
    expect(sentBody().text).toContain('"surprise": "kept"');
  });

  it("gives up on Resend after a timeout", async () => {
    const { sendFeedbackEmail } = await load();
    await sendFeedbackEmail(report());
    expect((mockFetch.mock.calls[0][1] as any).signal).toBeInstanceOf(AbortSignal);
  });

  it("subject is one line", async () => {
    const { sendFeedbackEmail } = await load();
    await sendFeedbackEmail(report());
    expect(sentBody().subject).toBe("[Sirat Bug] Crash on launch");
  });

  it("labels feedback and cuts the subject preview to 60 chars", async () => {
    const { sendFeedbackEmail } = await load();
    await sendFeedbackEmail(report({ type: "feedback", message: "a".repeat(100) }));
    expect(sentBody().subject).toBe(`[Sirat Feedback] ${"a".repeat(60)}`);
  });

  it("omits reply_to when no email", async () => {
    const { sendFeedbackEmail } = await load();
    await sendFeedbackEmail(report({ email: null }));
    expect(sentBody()).not.toHaveProperty("reply_to");
  });

  it("skips sending without an API key", async () => {
    const { sendFeedbackEmail } = await load("");
    await sendFeedbackEmail(report());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when Resend returns non-2xx", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422, text: async () => "bad" });
    const { sendFeedbackEmail } = await load();
    await expect(sendFeedbackEmail(report())).rejects.toThrow("422");
  });
});
