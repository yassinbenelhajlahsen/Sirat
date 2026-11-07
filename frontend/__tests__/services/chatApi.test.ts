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
const headersOf = (mock: jest.Mock, call: number) => mock.mock.calls[call][1].headers as Record<string, string>;
const CHAT = { message: "Is interest allowed?", history: [], summary: null, deviceToken: null };

beforeEach(async () => {
  jest.clearAllMocks();
  mockFetch.mockReset().mockResolvedValue(plain({}));
  await setChatDevBypass(false);
});

describe("chat API dev header", () => {
  it("sends the dev header on status and send only while the bypass is on", async () => {
    await getChatStatus();
    await sendChat(CHAT);
    expect(headersOf(mockFetch, 0)).not.toHaveProperty("x-sirat-chat-dev");
    expect(headersOf(mockFetch, 1)).not.toHaveProperty("x-sirat-chat-dev");

    await setChatDevBypass(true);
    await getChatStatus();
    await sendChat(CHAT);
    expect(headersOf(mockFetch, 2)["x-sirat-chat-dev"]).toBe("1");
    expect(headersOf(mockFetch, 3)["x-sirat-chat-dev"]).toBe("1");
  });

  it("posts the question to the chat route with the version header and resolves with the reply", async () => {
    mockFetch.mockResolvedValue(plain(REPLY));

    await expect(sendChat(CHAT)).resolves.toEqual(REPLY);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/chat$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(CHAT);
    expect(init.headers["x-sirat-app-version"]).toBe("1.0.10");
  });
});

describe("sendChat errors", () => {
  it("handles a plain error status like apiFetch, logging it without the body", async () => {
    mockFetch.mockResolvedValue(plain({ error: "busy" }, 409));
    await expect(sendChat(CHAT)).rejects.toThrow("busy");
    expect(mockRecordFailure).toHaveBeenCalledWith("POST", "/api/chat", 409);
  });

  it("still raises the force-update gate on 426", async () => {
    mockFetch.mockResolvedValue(
      plain({ error: { code: "APP_UPDATE_REQUIRED", minVersion: "2.0.0", currentVersion: "1.0.10" } }, 426),
    );
    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    await expect(sendChat(CHAT)).rejects.toThrow(AppUpdateRequiredError);
    expect(emitSpy).toHaveBeenCalledWith("FORCE_UPDATE_REQUIRED", { minVersion: "2.0.0", currentVersion: "1.0.10" });
  });

  it("logs a network failure as offline", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    await expect(sendChat(CHAT)).rejects.toThrow("Network request failed");
    expect(mockRecordFailure).toHaveBeenCalledWith("POST", "/api/chat", "offline");
  });
});
