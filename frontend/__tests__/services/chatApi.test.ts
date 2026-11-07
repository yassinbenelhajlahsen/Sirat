import { DeviceEventEmitter } from "react-native";
import { AppUpdateRequiredError } from "@/services/apiClient";
import { getChatStatus, sendChat } from "@/services/chat/chatApi";
import { setChatDevBypass } from "@/utils/devChat";

jest.mock("@/services/appVersion", () => ({
  getVersionHeaders: () => ({ "x-sirat-app-version": "1.0.10" }),
}));
jest.mock("@/services/auth/authToken", () => ({ getAuthToken: async () => null }));
const mockRecordFailure = jest.fn();
jest.mock("@/services/diagnostics", () => ({
  recordRequestFailure: (...args: unknown[]) => mockRecordFailure(...args),
}));
const mockStreamFetch = jest.fn();
jest.mock("expo/fetch", () => ({ fetch: (...args: unknown[]) => mockStreamFetch(...args) }));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const REPLY = {
  kind: "answer",
  answer: "Pray on time.",
  citations: [],
  scholarLink: null,
  summary: "s",
  allowance: 30,
  remaining: 29,
  resetsAt: "2026-12-01T00:00:00.000Z",
};

const headers = (type: string) => ({ get: (name: string) => (name.toLowerCase() === "content-type" ? type : null) });
const plain = (body: unknown, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: headers("application/json; charset=utf-8"),
  json: async () => body,
});
// Chunks are cut anywhere, including inside a line and inside a multi-byte character.
function stream(chunks: string[] | Uint8Array[]) {
  const queue = chunks.map((c) => (typeof c === "string" ? new TextEncoder().encode(c) : c));
  return {
    status: 200,
    ok: true,
    headers: headers("application/x-ndjson"),
    body: {
      getReader: () => ({
        read: async () => (queue.length ? { value: queue.shift(), done: false } : { value: undefined, done: true }),
        cancel: jest.fn().mockResolvedValue(undefined),
      }),
    },
  };
}
const line = (event: unknown) => `${JSON.stringify(event)}\n`;
const headersOf = (mock: jest.Mock, call: number) => mock.mock.calls[call][1].headers as Record<string, string>;
const CHAT = { message: "Is interest allowed?", history: [], summary: null, deviceToken: null };

beforeEach(async () => {
  jest.clearAllMocks();
  mockFetch.mockReset().mockResolvedValue(plain({}));
  mockStreamFetch.mockReset().mockImplementation(async () => stream([line({ type: "reply", ...REPLY })]));
  await setChatDevBypass(false);
});

describe("chat API dev header", () => {
  it("sends the dev header on status and send only while the bypass is on", async () => {
    await getChatStatus();
    await sendChat(CHAT);
    expect(headersOf(mockFetch, 0)).not.toHaveProperty("x-sirat-chat-dev");
    expect(headersOf(mockStreamFetch, 0)).not.toHaveProperty("x-sirat-chat-dev");

    await setChatDevBypass(true);
    await getChatStatus();
    await sendChat(CHAT);
    expect(headersOf(mockFetch, 1)["x-sirat-chat-dev"]).toBe("1");
    expect(headersOf(mockStreamFetch, 1)["x-sirat-chat-dev"]).toBe("1");
  });

  it("posts the question to the chat route asking for a stream, with the version header", async () => {
    await sendChat(CHAT);

    const [url, init] = mockStreamFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/chat$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(CHAT);
    expect(init.headers.Accept).toBe("application/x-ndjson");
    expect(init.headers["x-sirat-app-version"]).toBe("1.0.10");
  });
});

describe("sendChat stream", () => {
  it("reports each stage and resolves with the reply, lines split across chunks", async () => {
    const text =
      line({ type: "stage", stage: "writing" }) +
      line({ type: "stage", stage: "searching", source: "quran" }) +
      line({ type: "stage", stage: "searching", source: "hadith" }) +
      line({ type: "stage", stage: "searching", source: "dua" }) +
      line({ type: "stage", stage: "writing" }) +
      line({ type: "reply", ...REPLY, answer: "Pray on time. الله" });
    const bytes = new TextEncoder().encode(text);
    const insideArabic = new TextEncoder().encode(text.slice(0, text.indexOf("\u0627"))).length + 1;
    const cuts = [7, 40, 41, 90, 150, insideArabic, bytes.length - 2];
    const chunks = [0, ...cuts].map((start, i) => bytes.slice(start, cuts[i] ?? bytes.length));
    mockStreamFetch.mockResolvedValue(stream(chunks));
    const stages: string[] = [];

    const reply = await sendChat(CHAT, (s) => stages.push(s));

    expect(stages).toEqual(["writing", "quran", "hadith", "dua", "writing"]);
    expect(reply).toEqual({ ...REPLY, answer: "Pray on time. الله" });
  });

  it("ignores unknown events and stages, and reads a last line with no newline", async () => {
    mockStreamFetch.mockResolvedValue(
      stream([
        line({ type: "progress" }),
        line({ type: "stage", stage: "thinking" }),
        line({ type: "stage", stage: "searching", source: "tafsir" }),
        JSON.stringify({ type: "reply", kind: "limit", remaining: 0, allowance: 30, resetsAt: REPLY.resetsAt }),
      ]),
    );
    const onStage = jest.fn();

    await expect(sendChat(CHAT, onStage)).resolves.toEqual({
      kind: "limit",
      remaining: 0,
      allowance: 30,
      resetsAt: REPLY.resetsAt,
    });
    expect(onStage).not.toHaveBeenCalled();
  });

  it("rejects on an error event", async () => {
    mockStreamFetch.mockResolvedValue(
      stream([line({ type: "stage", stage: "writing" }), line({ type: "error", status: 502, code: "failed" })]),
    );
    await expect(sendChat(CHAT)).rejects.toThrow("Chat failed (502)");
  });

  it("rejects when the stream ends without a reply", async () => {
    mockStreamFetch.mockResolvedValue(stream([line({ type: "stage", stage: "writing" })]));
    await expect(sendChat(CHAT)).rejects.toThrow("without a reply");
  });

  it("treats a plain JSON 200 as the reply, for a server without streaming", async () => {
    mockStreamFetch.mockResolvedValue(plain(REPLY));
    const onStage = jest.fn();

    await expect(sendChat(CHAT, onStage)).resolves.toEqual(REPLY);
    expect(onStage).not.toHaveBeenCalled();
  });

  it("handles a plain error status like apiFetch, logging it without the body", async () => {
    mockStreamFetch.mockResolvedValue(plain({ error: "busy" }, 409));
    await expect(sendChat(CHAT)).rejects.toThrow("busy");
    expect(mockRecordFailure).toHaveBeenCalledWith("POST", "/api/chat", 409);
  });

  it("still raises the force-update gate on 426", async () => {
    mockStreamFetch.mockResolvedValue(
      plain({ error: { code: "APP_UPDATE_REQUIRED", minVersion: "2.0.0", currentVersion: "1.0.10" } }, 426),
    );
    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    await expect(sendChat(CHAT)).rejects.toThrow(AppUpdateRequiredError);
    expect(emitSpy).toHaveBeenCalledWith("FORCE_UPDATE_REQUIRED", { minVersion: "2.0.0", currentVersion: "1.0.10" });
  });

  it("logs a network failure as offline", async () => {
    mockStreamFetch.mockRejectedValue(new TypeError("Network request failed"));
    await expect(sendChat(CHAT)).rejects.toThrow("Network request failed");
    expect(mockRecordFailure).toHaveBeenCalledWith("POST", "/api/chat", "offline");
  });
});
