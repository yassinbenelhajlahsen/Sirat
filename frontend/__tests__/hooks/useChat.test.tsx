import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

const mockSendChat = jest.fn();
const mockGetChatStatus = jest.fn();
const mockGetDeviceToken = jest.fn();
const mockHasDeviceCheckModule = jest.fn();
const mockReportChatAnswer = jest.fn();
const mockFocusEffects: Array<() => void> = [];

jest.mock("@/services/chat/chatApi", () => ({
  sendChat: (...args: unknown[]) => mockSendChat(...args),
  getChatStatus: (...args: unknown[]) => mockGetChatStatus(...args),
}));
jest.mock("@/services/chat/deviceCheck", () => ({
  getDeviceToken: (...args: unknown[]) => mockGetDeviceToken(...args),
  hasDeviceCheckModule: (...args: unknown[]) => mockHasDeviceCheckModule(...args),
}));
jest.mock("@/services/auth/authToken", () => ({ getAuthToken: async () => null }));
jest.mock("@/services/reports", () => ({
  reportChatAnswer: (...args: unknown[]) => mockReportChatAnswer(...args),
}));
jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useFocusEffect: (effect: () => void) => {
      mockFocusEffects.push(effect);
      useEffect(() => { effect(); }, []);
    },
  };
});

import { useChat } from "@/hooks/useChat";
import { useChatStatus } from "@/hooks/useChatStatus";
import { clearChat, loadChat } from "@/services/chat/chatStore";

const RESETS_AT = "2026-12-01T00:00:00.000Z";
const ANSWER = {
  kind: "answer",
  answer: "Pray on time.",
  citations: [],
  scholarLink: null,
  summary: "new summary",
  allowance: 30,
  remaining: 29,
  resetsAt: RESETS_AT,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFocusEffects.length = 0;
  mockSendChat.mockReset();
  mockGetChatStatus.mockReset().mockResolvedValue({ enabled: true, allowance: 30, remaining: 30, resetsAt: RESETS_AT });
  mockGetDeviceToken.mockReset().mockResolvedValue("token");
  mockHasDeviceCheckModule.mockReset().mockReturnValue(true);
  mockReportChatAnswer.mockReset().mockResolvedValue(undefined);
});

async function storedChat() {
  return JSON.parse((await AsyncStorage.getItem("chat_history_v1")) ?? "{}");
}

async function mountChat() {
  const hook = renderHook(() => useChat());
  await waitFor(() => expect(hook.result.current.remaining).toBe(30));
  return hook;
}

describe("hooks/useChat", () => {
  it("send appends the question and the answer, and stores the new summary", async () => {
    mockSendChat.mockResolvedValueOnce(ANSWER);
    const { result } = await mountChat();

    await act(async () => {
      await result.current.send("  How do I pray?  ");
    });

    expect(result.current.messages.map((m) => [m.role, m.text])).toEqual([
      ["user", "How do I pray?"],
      ["assistant", "Pray on time."],
    ]);
    expect(result.current.remaining).toBe(29);
    expect(mockSendChat).toHaveBeenCalledWith({
      message: "How do I pray?",
      history: [],
      summary: null,
      deviceToken: "token",
    });
    expect((await storedChat()).summary).toBe("new summary");
  });

  it("sends at most the last 20 messages as history, never a failed one", async () => {
    const stored = Array.from({ length: 25 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      text: `m${i}`,
      createdAt: i,
    }));
    stored.push({ id: "f", role: "user", text: "FAILED-TEXT", createdAt: 99, status: "failed" } as never);
    await AsyncStorage.setItem("chat_history_v1", JSON.stringify({ messages: stored, summary: null }));
    mockSendChat.mockResolvedValueOnce(ANSWER);
    const { result } = await mountChat();

    await act(async () => {
      await result.current.send("next");
    });

    const { history } = mockSendChat.mock.calls[0][0];
    expect(history).toHaveLength(20);
    expect(history[0]).toEqual({ role: "assistant", text: "m5" });
    expect(history[19]).toEqual({ role: "user", text: "m24" });
    expect(JSON.stringify(history)).not.toContain("FAILED-TEXT");
  });

  it("a rejected send marks the question failed, and retry resends it in place", async () => {
    mockSendChat
      .mockRejectedValueOnce(new Error("Chat failed, please try again"))
      .mockResolvedValueOnce(ANSWER);
    const { result } = await mountChat();

    await act(async () => {
      await result.current.send("Is fasting required?");
    });
    const [failed] = result.current.messages;
    expect(result.current.messages).toHaveLength(1);
    expect(failed.status).toBe("failed");
    expect((await storedChat()).messages).toEqual([
      expect.objectContaining({ id: failed.id, text: "Is fasting required?", status: "failed" }),
    ]);

    await act(async () => {
      await result.current.retry(failed.id);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ id: failed.id, text: "Is fasting required?" });
    expect(result.current.messages[0].status).toBeUndefined();
    expect(result.current.messages[1].role).toBe("assistant");
    expect(mockSendChat.mock.calls[1][0].message).toBe("Is fasting required?");
  });

  it("clamps stored history to the server's limits, so one long answer cannot fail later requests", async () => {
    await AsyncStorage.setItem(
      "chat_history_v1",
      JSON.stringify({
        messages: [
          { id: "q", role: "user", text: "q".repeat(1200), createdAt: 1 },
          { id: "a", role: "assistant", text: "a".repeat(4500), createdAt: 2 },
        ],
        summary: null,
      }),
    );
    mockSendChat.mockResolvedValueOnce(ANSWER);
    const { result } = await mountChat();

    await act(async () => {
      await result.current.send("next");
    });

    const { history } = mockSendChat.mock.calls[0][0];
    expect(history[0].text).toHaveLength(1000);
    expect(history[1].text).toHaveLength(4000);
  });

  it("a reply that lands after sign-out is not written back to storage", async () => {
    let finish!: (value: unknown) => void;
    mockSendChat.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { result } = await mountChat();

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.send("before sign-out");
    });
    await waitFor(() => expect(mockSendChat).toHaveBeenCalledTimes(1));
    await act(async () => {
      await clearChat();
    });
    await act(async () => {
      finish(ANSWER);
      await pending;
    });

    expect(mockSendChat).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem("chat_history_v1")).toBeNull();
    await expect(loadChat()).resolves.toEqual({ messages: [], summary: null });
  });

  it("a send after sign-out starts a fresh conversation", async () => {
    mockSendChat.mockResolvedValueOnce(ANSWER);
    const { result } = await mountChat();
    await act(async () => {
      await result.current.send("old question");
    });
    await act(async () => {
      await clearChat();
    });

    mockSendChat.mockResolvedValueOnce(ANSWER);
    await act(async () => {
      await result.current.send("new question");
    });

    expect(mockSendChat.mock.calls[1][0]).toMatchObject({ history: [], summary: null });
    expect((await storedChat()).messages.map((m: { text: string }) => m.text)).toEqual([
      "new question",
      "Pray on time.",
    ]);
  });

  it("a failed send never puts the question text in diagnostics", async () => {
    const diagnostics = require("@/services/diagnostics") as typeof import("@/services/diagnostics");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const actualSendChat = jest.requireActual("@/services/chat/chatApi").sendChat;
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "Chat failed, please try again" }),
    } as Response);
    mockSendChat.mockImplementationOnce((body: unknown) => actualSendChat(body));
    const { result } = await mountChat();

    await act(async () => {
      await result.current.send("SECRET-TEXT");
    });

    const report = await diagnostics.getDiagnosticsReport();
    expect(result.current.messages[0].status).toBe("failed");
    expect(report.entries.map((e) => e.message)).toEqual(["POST /api/chat: 502"]);
    expect(JSON.stringify(report)).not.toContain("SECRET-TEXT");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("SECRET-TEXT");
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain("SECRET-TEXT");
  });

  it.each(["crisis", "blocked", "limit"] as const)(
    "a %s reply adds a notice and keeps the question as sent",
    async (kind) => {
      mockSendChat.mockResolvedValueOnce({ kind, allowance: 30, remaining: 0, resetsAt: RESETS_AT });
      const { result } = await mountChat();

      await act(async () => {
        await result.current.send("something");
      });

      expect(result.current.messages[0].status).toBeUndefined();
      expect(result.current.messages[1]).toMatchObject({ role: "assistant", text: "", notice: kind });
    },
  );

  it("does nothing for blank text or while a send is in progress", async () => {
    let finish!: (value: unknown) => void;
    mockSendChat.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { result } = await mountChat();

    await act(async () => {
      await result.current.send("   ");
    });
    expect(mockSendChat).not.toHaveBeenCalled();

    let first!: Promise<void>;
    act(() => {
      first = result.current.send("first");
    });
    await act(async () => {
      await result.current.send("second");
    });
    expect(mockSendChat).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish(ANSWER);
      await first;
    });
  });

  it("trims the question and caps it at 1000 characters", async () => {
    mockSendChat.mockResolvedValueOnce(ANSWER);
    const { result } = await mountChat();

    await act(async () => {
      await result.current.send(` ${"x".repeat(1200)} `);
    });

    expect(mockSendChat.mock.calls[0][0].message).toHaveLength(1000);
  });

  it("report sends the preceding question, the answer and its citation ids", async () => {
    mockSendChat.mockResolvedValueOnce({
      ...ANSWER,
      citations: [
        { kind: "quran", surah: 2, ayah: 255, arabic: "", english: null },
        { kind: "hadith", id: 7, title: "t", text: "x", arabic: null, grade: "sahih", source: "Bukhari", credit: "c" },
        { kind: "dua", id: 12, arabic: "", transliteration: "", english: "", reference: "" },
      ],
    });
    const { result } = await mountChat();
    await act(async () => {
      await result.current.send("How?");
    });

    await act(async () => {
      await result.current.report(result.current.messages[1].id);
    });

    expect(mockReportChatAnswer).toHaveBeenCalledWith("How?", "Pray on time.", ["q:2:255", "h:7", "d:12"]);
  });

  it("report leaves out citations of an unknown kind", async () => {
    mockSendChat.mockResolvedValueOnce({
      ...ANSWER,
      citations: [
        { kind: "fatwa", id: 1 } as never,
        { kind: "quran", surah: 2, ayah: 255, arabic: "", english: null },
      ],
    });
    const { result } = await mountChat();
    await act(async () => {
      await result.current.send("How?");
    });

    await act(async () => {
      await result.current.report(result.current.messages[1].id);
    });

    expect(mockReportChatAnswer).toHaveBeenCalledWith("How?", "Pray on time.", ["q:2:255"]);
  });

  it("a retried question's answer lands right after it, and reports against it", async () => {
    mockSendChat
      .mockRejectedValueOnce(new Error("Chat failed, please try again"))
      .mockResolvedValueOnce({ ...ANSWER, answer: "A2" })
      .mockResolvedValueOnce({ ...ANSWER, answer: "A1" });
    const { result } = await mountChat();
    await act(async () => {
      await result.current.send("Q1");
    });
    await act(async () => {
      await result.current.send("Q2");
    });

    await act(async () => {
      await result.current.retry(result.current.messages[0].id);
    });

    expect(result.current.messages.map((m) => [m.role, m.text])).toEqual([
      ["user", "Q1"],
      ["assistant", "A1"],
      ["user", "Q2"],
      ["assistant", "A2"],
    ]);
    await act(async () => {
      await result.current.report(result.current.messages[1].id);
    });
    expect(mockReportChatAnswer).toHaveBeenCalledWith("Q1", "A1", []);
  });

  it("a reopened chat waits for a reply still in flight, shows it sending, and keeps it when it sends", async () => {
    let finish!: (value: unknown) => void;
    mockSendChat.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const first = await mountChat();
    let pending!: Promise<void>;
    act(() => {
      pending = first.result.current.send("Q1");
    });
    await waitFor(() => expect(mockSendChat).toHaveBeenCalledTimes(1));
    first.unmount();

    const second = renderHook(() => useChat());
    await waitFor(() => expect(second.result.current.sending).toBe(true));

    await act(async () => {
      finish(ANSWER);
      await pending;
    });
    await waitFor(() => expect(second.result.current.sending).toBe(false));
    expect(second.result.current.messages.map((m) => m.text)).toEqual(["Q1", "Pray on time."]);

    mockSendChat.mockResolvedValueOnce({ ...ANSWER, answer: "A2" });
    await act(async () => {
      await second.result.current.send("Q2");
    });
    expect((await storedChat()).messages.map((m: { text: string }) => m.text)).toEqual(["Q1", "Pray on time.", "Q2", "A2"]);
  });

  it("report rejects when the answer's preceding question is missing", async () => {
    await AsyncStorage.setItem(
      "chat_history_v1",
      JSON.stringify({ messages: [{ id: "a1", role: "assistant", text: "Orphan.", createdAt: 1 }], summary: null }),
    );
    const { result } = await mountChat();

    await expect(result.current.report("a1")).rejects.toThrow("nothing to report");
    expect(mockReportChatAnswer).not.toHaveBeenCalled();
  });

  it("report rejects when no message has the id", async () => {
    const { result } = await mountChat();

    await expect(result.current.report("missing")).rejects.toThrow("nothing to report");
    expect(mockReportChatAnswer).not.toHaveBeenCalled();
  });

  it("seeds the allowance from the status on mount", async () => {
    const { result } = await mountChat();
    expect(result.current.allowance).toBe(30);
    expect(result.current.resetsAt).toBe(RESETS_AT);
  });

  it("a status request that fails late does not overwrite the allowance from a newer reply", async () => {
    let failStatus!: (reason: unknown) => void;
    mockGetChatStatus.mockReturnValueOnce(new Promise((_, reject) => { failStatus = reject; }));
    mockSendChat.mockResolvedValueOnce(ANSWER);
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send("hello");
    });
    expect(result.current).toMatchObject({ allowance: 30, remaining: 29 });

    await act(async () => {
      failStatus(new Error("Chat is unavailable"));
    });
    expect(mockGetChatStatus).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ allowance: 30, remaining: 29 });
  });
});

describe("hooks/useChatStatus", () => {
  it("is visible when chat is enabled and the DeviceCheck module is present", async () => {
    const { result } = renderHook(() => useChatStatus());
    await waitFor(() => expect(result.current).toEqual({ visible: true, remaining: 30 }));
  });

  it("is not visible when the DeviceCheck module is absent, even with chat enabled", async () => {
    mockHasDeviceCheckModule.mockReturnValue(false);
    const { result } = renderHook(() => useChatStatus());
    await waitFor(() => expect(mockGetChatStatus).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.visible).toBe(false);
    expect(result.current.remaining).toBe(30);
  });

  it("is not visible once the server has chat switched off", async () => {
    const { result } = renderHook(() => useChatStatus());
    await waitFor(() => expect(result.current).toEqual({ visible: true, remaining: 30 }));

    mockGetChatStatus.mockResolvedValueOnce({ enabled: false, allowance: null, remaining: null, resetsAt: RESETS_AT });
    await act(async () => {
      mockFocusEffects[mockFocusEffects.length - 1]();
    });
    await waitFor(() => expect(result.current.visible).toBe(false));
  });

  it("is not visible and has no remaining count once a refocus status request fails", async () => {
    const { result } = renderHook(() => useChatStatus());
    await waitFor(() => expect(result.current).toEqual({ visible: true, remaining: 30 }));

    mockGetChatStatus.mockRejectedValueOnce(new Error("Chat is unavailable"));
    await act(async () => {
      mockFocusEffects[mockFocusEffects.length - 1]();
    });
    await waitFor(() => expect(result.current).toEqual({ visible: false, remaining: null }));
  });

  it("refetches when the screen regains focus", async () => {
    const { result } = renderHook(() => useChatStatus());
    await waitFor(() => expect(result.current.remaining).toBe(30));

    mockGetChatStatus.mockResolvedValueOnce({ enabled: true, allowance: 30, remaining: 12, resetsAt: RESETS_AT });
    await act(async () => {
      mockFocusEffects[mockFocusEffects.length - 1]();
    });
    await waitFor(() => expect(result.current.remaining).toBe(12));
  });
});
