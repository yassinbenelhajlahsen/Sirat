import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  chatGeneration,
  clearChat,
  hasConsented,
  loadChat,
  saveChat,
  setConsented,
  type ChatMessage,
} from "@/services/chat/chatStore";

const HISTORY_KEY = "chat_history_v1";

const userMessage = (i: number): ChatMessage => ({ id: `m${i}`, role: "user", text: `t${i}`, createdAt: i });

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("round-trips messages, citations and the summary", async () => {
  const messages: ChatMessage[] = [
    userMessage(1),
    {
      id: "a1",
      role: "assistant",
      text: "Pray on time.",
      createdAt: 2,
      citations: [{ kind: "quran", surah: 2, ayah: 255, arabic: "", english: null }],
      scholarLink: null,
    },
  ];
  await saveChat({ messages, summary: "They asked about prayer." });
  await expect(loadChat()).resolves.toEqual({ messages, summary: "They asked about prayer." });
});

it("loads an empty chat when nothing is stored or the stored value is unreadable", async () => {
  await expect(loadChat()).resolves.toEqual({ messages: [], summary: null });
  await AsyncStorage.setItem(HISTORY_KEY, "{not json");
  await expect(loadChat()).resolves.toEqual({ messages: [], summary: null });
});

it("keeps only the newest 500 messages", async () => {
  await saveChat({ messages: Array.from({ length: 510 }, (_, i) => userMessage(i)), summary: null });
  const { messages } = await loadChat();
  expect(messages).toHaveLength(500);
  expect(messages[0].id).toBe("m10");
  expect(messages[499].id).toBe("m509");
});

it("clearChat empties the history and the consent", async () => {
  await saveChat({ messages: [userMessage(1)], summary: "s" });
  await setConsented();
  await clearChat();
  await expect(loadChat()).resolves.toEqual({ messages: [], summary: null });
  await expect(hasConsented()).resolves.toBe(false);
});

it("chatGeneration moves on every clearChat and holds still otherwise", async () => {
  const before = chatGeneration();
  await saveChat({ messages: [userMessage(1)], summary: null });
  expect(chatGeneration()).toBe(before);
  await clearChat();
  expect(chatGeneration()).toBe(before + 1);
});

it("remembers consent until it is cleared", async () => {
  await expect(hasConsented()).resolves.toBe(false);
  await setConsented();
  await expect(hasConsented()).resolves.toBe(true);
});

it("swallows storage errors without logging them", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk full"));
  await expect(loadChat()).resolves.toEqual({ messages: [], summary: null });
  expect(consoleError).not.toHaveBeenCalled();
});
