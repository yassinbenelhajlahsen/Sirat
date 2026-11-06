// frontend/__tests__/screens/Chat.test.tsx
import { act, fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import Chat from "@/app/Chat";
import { CRISIS_MESSAGE } from "@/constants/crisis";
import { ThemeProvider } from "@/context/ThemeContext";
import { hasConsented, setConsented } from "@/services/chat/chatStore";
import type { ChatMessage } from "@/services/chat/chatStore";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const Stack = Object.assign(jest.fn(() => null), { Screen: jest.fn(() => null) });
  return {
    Stack,
    router: {
      back: (...args: unknown[]) => mockBack(...args),
      push: (...args: unknown[]) => mockPush(...args),
    },
  };
});

const mockUseChat = jest.fn();
jest.mock("@/hooks/useChat", () => ({ useChat: () => mockUseChat() }));

const mockAuth = jest.fn();
jest.mock("@/hooks/useAuthState", () => ({ useAuthState: () => mockAuth() }));

jest.mock("@/services/chat/chatStore", () => ({
  hasConsented: jest.fn(async () => true),
  setConsented: jest.fn(async () => {}),
}));

const DISCLAIMER = "This is an aid and answers may be wrong. Please consult a trusted scholar.";
const BLOCKED = "I can't help with that one. Please ask a trusted scholar.";
const QURAN = { kind: "quran" as const, surah: 2, ayah: 255, arabic: "ٱللَّهُ", english: "Allah" };
const HADITH = {
  kind: "hadith" as const,
  id: 7,
  title: "Intentions",
  text: "Actions are judged by intentions.",
  arabic: null,
  grade: "sahih",
  source: "Bukhari",
  credit: "Umar ibn al-Khattab",
};
const DUA = {
  kind: "dua" as const,
  id: 12,
  arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً",
  transliteration: "Rabbana atina fid-dunya hasanatan",
  english: "Our Lord, give us good in this world",
  reference: "Quran 2:201",
};

const send = jest.fn();
const retry = jest.fn();
const report = jest.fn(async () => {});

const signedIn = { isLoaded: true, isSignedIn: true, userId: "u1", email: null, firstName: null };

function chatState(overrides: Record<string, unknown> = {}) {
  return {
    messages: [] as ChatMessage[],
    remaining: 12,
    allowance: 15,
    resetsAt: "2026-12-15T12:00:00.000Z",
    sending: false,
    send,
    retry,
    report,
    ...overrides,
  };
}

const user = (id: string, text: string): ChatMessage => ({ id, role: "user", text, createdAt: 1 });
const answer = (id: string, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role: "assistant",
  text,
  createdAt: 2,
  citations: [],
  scholarLink: null,
  ...extra,
});

// The consent check resolves after mount; flush it so the rendered state is the real one.
const renderChat = async () => {
  const screen = render(
    <ThemeProvider>
      <Chat />
    </ThemeProvider>,
  );
  await act(async () => {});
  return screen;
};

const monthDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });

beforeEach(() => {
  mockAuth.mockReturnValue(signedIn);
  mockUseChat.mockReturnValue(chatState());
  (hasConsented as jest.Mock).mockResolvedValue(true);
});

describe("Chat screen", () => {
  it("signed out shows the sign-in button and opens the sign-in sheet", async () => {
    mockAuth.mockReturnValue({ ...signedIn, isSignedIn: false, userId: null });
    const { findByRole } = await renderChat();

    fireEvent.press(await findByRole("button", { name: "Sign in" }));

    expect(mockPush).toHaveBeenCalledWith("/SignIn");
  });

  it("unconsented shows the consent screen, and Continue opens the composer", async () => {
    (hasConsented as jest.Mock).mockResolvedValue(false);
    const { findByText, getByRole, findByLabelText } = await renderChat();

    expect(await findByText("Before you ask")).toBeTruthy();
    expect(
      await findByText(
        "Your question and recent messages from this chat are sent to OpenAI, a third-party AI service, to write the answer.",
      ),
    ).toBeTruthy();

    fireEvent.press(getByRole("button", { name: "Continue" }));

    expect(setConsented).toHaveBeenCalled();
    expect(await findByLabelText("Your question")).toBeTruthy();
  });

  it("an answer shows the disclaimer verbatim and its citation", async () => {
    mockUseChat.mockReturnValue(
      chatState({
        messages: [user("q1", "Is zakat due on gold?"), answer("a1", "Yes, when it reaches nisab.", { citations: [QURAN] })],
      }),
    );
    const { getByText, getAllByText } = await renderChat();

    expect(getByText("Yes, when it reaches nisab.")).toBeTruthy();
    expect(getAllByText(DISCLAIMER)).toHaveLength(1);
    expect(getByText("Allah")).toBeTruthy();
  });

  it("tapping a Quran citation goes back and opens that verse in the Quran tab", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [answer("a1", "See the verse.", { citations: [QURAN] })] }));
    const { getByRole } = await renderChat();

    fireEvent.press(getByRole("button", { name: "Open Quran 2:255" }));

    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/(tabs)/Quran", params: { surah: 2, ayah: 255 } });
    expect(mockBack.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0]);
  });

  it("a scholar link opens its URL", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    mockUseChat.mockReturnValue(
      chatState({ messages: [answer("a1", "A ruling.", { scholarLink: "https://example.org/answers/1" })] }),
    );
    const { getByRole } = await renderChat();

    fireEvent.press(getByRole("link", { name: "Read a scholar's answer" }));

    expect(openURL).toHaveBeenCalledWith("https://example.org/answers/1");
    openURL.mockRestore();
  });

  it("a scholar link that fails to open raises no unhandled rejection", async () => {
    const unhandled = jest.fn();
    process.on("unhandledRejection", unhandled);
    const openURL = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("No app can open this link"));
    mockUseChat.mockReturnValue(
      chatState({ messages: [answer("a1", "A ruling.", { scholarLink: "https://example.org/answers/1" })] }),
    );
    const { getByRole } = await renderChat();

    fireEvent.press(getByRole("link", { name: "Read a scholar's answer" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    process.off("unhandledRejection", unhandled);
    expect(openURL).toHaveBeenCalledWith("https://example.org/answers/1");
    expect(unhandled).not.toHaveBeenCalled();
    openURL.mockRestore();
  });

  it("a hadith citation shows its title, text, grade and source and credit", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [answer("a1", "See the hadith.", { citations: [HADITH] })] }));
    const { getByText } = await renderChat();

    expect(getByText("Intentions")).toBeTruthy();
    expect(getByText("Actions are judged by intentions.")).toBeTruthy();
    expect(getByText("sahih")).toBeTruthy();
    expect(getByText("Bukhari · Umar ibn al-Khattab")).toBeTruthy();
  });

  it("a dua citation shows its Arabic, transliteration, English and reference, and is not tappable", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [answer("a1", "Ask for this.", { citations: [DUA] })] }));
    const { getByText, queryByRole } = await renderChat();

    expect(getByText(DUA.arabic)).toBeTruthy();
    expect(getByText(DUA.transliteration)).toBeTruthy();
    expect(getByText(DUA.english)).toBeTruthy();
    expect(getByText("Quran 2:201")).toBeTruthy();

    fireEvent.press(getByText(DUA.arabic));
    expect(queryByRole("button", { name: /Quran 2:201/ })).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("a citation of an unknown kind renders nothing and the answer still shows", async () => {
    const unknown = { kind: "fatwa", id: 1 } as never;
    mockUseChat.mockReturnValue(chatState({ messages: [answer("a1", "Still here.", { citations: [unknown, DUA] })] }));
    const { getByText } = await renderChat();

    expect(getByText("Still here.")).toBeTruthy();
    expect(getByText(DUA.english)).toBeTruthy();
  });

  it("the crisis notice shows the crisis message", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [user("q1", "..."), answer("a1", "", { notice: "crisis" })] }));
    const { getByText } = await renderChat();

    expect(getByText(CRISIS_MESSAGE)).toBeTruthy();
  });

  it("the blocked notice shows the scholar line", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [answer("a1", "", { notice: "blocked" })] }));
    const { getByText } = await renderChat();

    expect(getByText(BLOCKED)).toBeTruthy();
  });

  it("the limit notice shows the allowance and the local reset date", async () => {
    mockUseChat.mockReturnValue(
      chatState({ remaining: 0, messages: [answer("a1", "", { notice: "limit" })] }),
    );
    const { getByText } = await renderChat();

    expect(getByText(`You've used this month's 15 messages. They reset on ${monthDay("2026-12-15T12:00:00.000Z")}.`)).toBeTruthy();
  });

  it("the limit notice falls back to next month when the reset time is unknown", async () => {
    mockUseChat.mockReturnValue(
      chatState({ remaining: 0, resetsAt: null, messages: [answer("a1", "", { notice: "limit" })] }),
    );
    const { getByText } = await renderChat();

    expect(getByText("You've used this month's 15 messages. They reset at the start of next month.")).toBeTruthy();
  });

  it("a failed message's retry resends that message", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [{ ...user("m1", "Question?"), status: "failed" }] }));
    const { getByText } = await renderChat();

    fireEvent.press(getByText("Didn't send. Tap to retry"));

    expect(retry).toHaveBeenCalledWith("m1");
  });

  it("the composer caps the question at 1000 characters and counts from 900", async () => {
    const { getByLabelText, queryByText, getByText } = await renderChat();
    const input = getByLabelText("Your question");

    expect(input.props.maxLength).toBe(1000);

    fireEvent.changeText(input, "a".repeat(899));
    expect(queryByText("899/1000")).toBeNull();

    fireEvent.changeText(input, "a".repeat(900));
    expect(getByText("900/1000")).toBeTruthy();
  });

  it("sends the typed question and clears the composer", async () => {
    const { getByLabelText, getByRole } = await renderChat();

    fireEvent.changeText(getByLabelText("Your question"), "  Is fasting required when ill?  ");
    fireEvent.press(getByRole("button", { name: "Send" }));

    expect(send).toHaveBeenCalledWith("  Is fasting required when ill?  ");
    expect(getByLabelText("Your question").props.value).toBe("");
  });

  it("send is disabled when the allowance is used up", async () => {
    mockUseChat.mockReturnValue(chatState({ remaining: 0 }));
    const { getByLabelText, getByRole } = await renderChat();

    fireEvent.changeText(getByLabelText("Your question"), "Hello");

    expect(getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("the header shows the messages left before Close", async () => {
    await renderChat();
    const stack = jest.requireMock("expo-router").Stack as { Screen: jest.Mock };
    const options = stack.Screen.mock.calls.at(-1)?.[0].options;
    const items = options.unstable_headerRightItems();
    const { getByText } = render(<ThemeProvider>{items[0].element}</ThemeProvider>);

    expect(items).toHaveLength(2);
    expect(getByText("12 left")).toBeTruthy();
  });

  it("a report shows the thanks toast", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [user("q1", "Q?"), answer("a1", "Answer.", { citations: [QURAN] })] }));
    const { getByRole, findByText } = await renderChat();

    fireEvent.press(getByRole("button", { name: "Report this answer" }));

    expect(report).toHaveBeenCalledWith("a1");
    expect(await findByText("Thanks, we'll review this answer.")).toBeTruthy();
  });

  it("a failed report says so under the answer", async () => {
    report.mockRejectedValueOnce(new Error("Couldn't send"));
    mockUseChat.mockReturnValue(chatState({ messages: [user("q1", "Q?"), answer("a1", "Answer.")] }));
    const { getByRole, findByText } = await renderChat();

    fireEvent.press(getByRole("button", { name: "Report this answer" }));

    expect(await findByText("Couldn't send the report. Please try again.")).toBeTruthy();
  });
});
