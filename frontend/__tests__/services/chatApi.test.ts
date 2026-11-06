import { getChatStatus, sendChat } from "@/services/chat/chatApi";
import { setChatDevBypass } from "@/utils/devChat";

jest.mock("@/services/appVersion", () => ({
  getVersionHeaders: () => ({ "x-sirat-app-version": "1.0.10" }),
}));
jest.mock("@/services/auth/authToken", () => ({ getAuthToken: async () => null }));
jest.mock("@/services/diagnostics", () => ({ recordRequestFailure: jest.fn() }));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const ok = (body: unknown) => ({ status: 200, ok: true, json: async () => body });
const headersOf = (call: number) => mockFetch.mock.calls[call][1].headers as Record<string, string>;
const CHAT = { message: "Is interest allowed?", history: [], summary: null, deviceToken: null };

describe("chat API dev header", () => {
  beforeEach(async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(ok({}));
    await setChatDevBypass(false);
  });

  it("sends the dev header on status and send only while the bypass is on", async () => {
    await getChatStatus();
    await sendChat(CHAT);
    expect(headersOf(0)).not.toHaveProperty("x-sirat-chat-dev");
    expect(headersOf(1)).not.toHaveProperty("x-sirat-chat-dev");

    await setChatDevBypass(true);
    await getChatStatus();
    await sendChat(CHAT);
    expect(headersOf(2)["x-sirat-chat-dev"]).toBe("1");
    expect(headersOf(3)["x-sirat-chat-dev"]).toBe("1");
  });

  it("still posts the question to the chat route", async () => {
    await sendChat(CHAT);

    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/chat$/);
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(CHAT);
  });
});
