// frontend/__tests__/screens/Chat.test.tsx
import { act, fireEvent, render } from "@testing-library/react-native";
import { FlatList, Text } from "react-native";

import Chat from "@/app/Chat";
import { CRISIS_MESSAGE } from "@/constants/crisis";
import { ThemeProvider } from "@/context/ThemeContext";
import { hasConsented, setConsented } from "@/services/chat/chatStore";
import type { ChatMessage } from "@/services/chat/chatStore";
import { CHAT_PROMPTS } from "@/services/chat/quickPrompts";
import { formatTimeLine } from "@/services/chat/timeline";

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

let mockDevChat = false;
jest.mock("@/utils/devChat", () => ({ useChatDevBypass: () => mockDevChat }));

jest.mock("@/services/chat/chatStore", () => ({
  hasConsented: jest.fn(async () => true),
  setConsented: jest.fn(async () => {}),
}));

const DISCLAIMER = "This is an aid and answers may be wrong. Please consult a trusted scholar.";
const NOTICE = "Answers are an aid and may be wrong. Please consult a trusted scholar.";
const THANKS = "Thanks, we'll review this answer.";
const REPORT_FAILED = "Couldn't send the report. Please try again.";
const LIMIT_1 = "You've used this month's 15 messages.";
const LIMIT_2 = `They reset on ${new Date("2026-12-15T12:00:00.000Z").toLocaleDateString(undefined, { month: "long", day: "numeric", timeZone: "UTC" })}.`;
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
    loaded: true,
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
const tree = () => (
  <ThemeProvider>
    <Chat />
  </ThemeProvider>
);
const renderChat = async () => {
  const screen = render(tree());
  await act(async () => {});
  return screen;
};

const stackOptions = () => (jest.requireMock("expo-router").Stack as { Screen: jest.Mock }).Screen.mock.calls.at(-1)?.[0].options;
const promptButtons = (queryAllByRole: (role: string) => { props: { accessibilityLabel?: string } }[]) =>
  queryAllByRole("button").filter((b) => CHAT_PROMPTS.includes(b.props.accessibilityLabel ?? ""));

beforeEach(() => {
  report.mockImplementation(async () => {});
  mockAuth.mockReturnValue(signedIn);
  mockDevChat = false;
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

  it("with the dev chat bypass on, a signed-out user gets the composer, not the sign-in prompt", async () => {
    mockAuth.mockReturnValue({ ...signedIn, isSignedIn: false, userId: null });
    mockDevChat = true;
    const { findByLabelText, queryByText } = await renderChat();

    expect(await findByLabelText("Your question")).toBeTruthy();
    expect(queryByText("Sign in to ask")).toBeNull();
  });

  it("unconsented shows the consent screen, and Continue opens the composer", async () => {
    (hasConsented as jest.Mock).mockResolvedValue(false);
    const { findByText, getByRole, findByLabelText } = await renderChat();

    expect(await findByText("Before you ask")).toBeTruthy();
    expect(
      await findByText(
        "Your question and recent messages from this chat are sent to a third-party AI service, to write the answer.",
      ),
    ).toBeTruthy();

    fireEvent.press(getByRole("button", { name: "Continue" }));

    expect(setConsented).toHaveBeenCalled();
    expect(await findByLabelText("Your question")).toBeTruthy();
  });

  it("an answer shows its text and citation, with no per-answer disclaimer", async () => {
    mockUseChat.mockReturnValue(
      chatState({
        messages: [user("q1", "Is zakat due on gold?"), answer("a1", "Yes, when it reaches nisab.", { citations: [QURAN] })],
      }),
    );
    const { getByText, queryByText } = await renderChat();

    expect(getByText("Yes, when it reaches nisab.")).toBeTruthy();
    expect(queryByText(DISCLAIMER)).toBeNull();
    expect(getByText("Allah")).toBeTruthy();
  });

  it("tapping a Quran citation goes back and opens that verse in the Quran tab", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [answer("a1", "See the verse.", { citations: [QURAN] })] }));
    const { getByRole } = await renderChat();

    fireEvent.press(getByRole("button", { name: /^Open .* 2:255$/ }));

    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/Quran",
      params: { surah: 2, ayah: 255, at: expect.any(String) },
    });
    expect(mockBack.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0]);
  });

  it("each tap on the same Quran citation carries a new stamp, so a repeat tap scrolls again", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [answer("a1", "See the verse.", { citations: [QURAN] })] }));
    const { getByRole } = await renderChat();
    const now = jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    fireEvent.press(getByRole("button", { name: /^Open .* 2:255$/ }));
    fireEvent.press(getByRole("button", { name: /^Open .* 2:255$/ }));

    expect(mockPush.mock.calls.map(([target]) => target.params.at)).toEqual(["1000", "2000"]);
    now.mockRestore();
  });

  it("at the limit, both limit lines replace the field, and a final limit-notice bubble is not drawn", async () => {
    mockUseChat.mockReturnValue(
      chatState({ remaining: 0, messages: [user("q1", "Q?"), answer("a1", "", { notice: "limit" })] }),
    );
    const { getByText, queryByText, queryByLabelText } = await renderChat();

    expect(getByText(LIMIT_1)).toBeTruthy();
    expect(getByText(LIMIT_2)).toBeTruthy();
    expect(queryByText(`${LIMIT_1} ${LIMIT_2}`)).toBeNull();
    expect(queryByLabelText("Your question")).toBeNull();
  });

  it("the limit lines fall back to next month when the reset time is unknown", async () => {
    mockUseChat.mockReturnValue(chatState({ remaining: 0, resetsAt: null }));
    const { getByText } = await renderChat();

    expect(getByText("They reset at the start of next month.")).toBeTruthy();
  });

  it("while a reply is pending at the limit, the field stays and the limit lines wait", async () => {
    mockUseChat.mockReturnValue(chatState({ remaining: 0, sending: true }));
    const { queryByText, getByLabelText } = await renderChat();

    expect(queryByText(LIMIT_1)).toBeNull();
    expect(getByLabelText("Your question")).toBeTruthy();
  });

  it("TypingBubble shows while sending", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [user("q1", "Q?")], sending: true }));
    const { getByLabelText, queryByText } = await renderChat();

    expect(getByLabelText("Writing an answer")).toBeTruthy();
    expect(queryByText("Writing an answer...")).toBeNull();
  });

  it("has no writing row when no reply is pending", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [user("q1", "Q?")] }));
    const { queryByLabelText } = await renderChat();

    expect(queryByLabelText("Writing an answer")).toBeNull();
  });

  it("never shows a scholar link, even when the answer carries one", async () => {
    mockUseChat.mockReturnValue(
      chatState({ messages: [answer("a1", "A ruling.", { scholarLink: "https://example.org/answers/1" })] }),
    );
    const { getByText, queryByText } = await renderChat();

    expect(getByText("A ruling.")).toBeTruthy();
    expect(queryByText(/scholar's answer/)).toBeNull();
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

  it("a limit notice in history still shows once the limit is no longer reached", async () => {
    mockUseChat.mockReturnValue(chatState({ remaining: 15, messages: [answer("a1", "", { notice: "limit" })] }));
    const { getByText, getByLabelText } = await renderChat();

    expect(getByText(`${LIMIT_1} ${LIMIT_2}`)).toBeTruthy();
    expect(getByLabelText("Your question")).toBeTruthy();
  });

  it("a limit notice that is not the last message still shows above the limit lines", async () => {
    mockUseChat.mockReturnValue(
      chatState({ remaining: 0, messages: [answer("a1", "", { notice: "limit" }), user("q2", "Next?")] }),
    );
    const { getByText } = await renderChat();

    expect(getByText(`${LIMIT_1} ${LIMIT_2}`)).toBeTruthy();
    expect(getByText(LIMIT_1)).toBeTruthy();
  });

  it("a failed message's retry resends that message", async () => {
    mockUseChat.mockReturnValue(chatState({ messages: [{ ...user("m1", "Question?"), status: "failed" }] }));
    const { getByText } = await renderChat();

    fireEvent.press(getByText("Not delivered. Tap to retry"));

    expect(retry).toHaveBeenCalledWith("m1");
  });

  it("retrying a failed message scrolls to the end even after the list was touched", async () => {
    const scrollToEnd = jest.spyOn(FlatList.prototype, "scrollToEnd").mockImplementation(() => {});
    try {
      mockUseChat.mockReturnValue(chatState({ messages: [{ ...user("m1", "Question?"), status: "failed" }] }));
      const screen = await renderChat();
      const list = screen.UNSAFE_getByType(FlatList);

      fireEvent(list, "touchStart");
      fireEvent.press(screen.getByText("Not delivered. Tap to retry"));
      scrollToEnd.mockClear();
      fireEvent(list, "contentSizeChange", 390, 2000);

      expect(scrollToEnd).toHaveBeenCalled();
    } finally {
      scrollToEnd.mockRestore();
    }
  });

  it("dragging the list stops it following the end until the next send", async () => {
    const scrollToEnd = jest.spyOn(FlatList.prototype, "scrollToEnd").mockImplementation(() => {});
    try {
      mockUseChat.mockReturnValue(chatState({ messages: [user("m1", "Question?")] }));
      const screen = await renderChat();
      const list = screen.UNSAFE_getByType(FlatList);

      fireEvent(list, "scrollBeginDrag");
      scrollToEnd.mockClear();
      fireEvent(list, "contentSizeChange", 390, 2000);
      fireEvent(list, "layout", { nativeEvent: { layout: { width: 390, height: 700 } } });

      expect(scrollToEnd).not.toHaveBeenCalled();
    } finally {
      scrollToEnd.mockRestore();
    }
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

  it("the header title shows '12 of 15 left', and the right items hold only Close", async () => {
    await renderChat();
    const options = stackOptions();
    const { getByText } = render(<ThemeProvider>{options.headerTitle()}</ThemeProvider>);
    const items = options.unstable_headerRightItems();

    expect(getByText("12 of 15 left")).toBeTruthy();
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Close");
  });

  it("messages fade out under the header and above the composer, without blocking touches", async () => {
    const { getByTestId } = await renderChat();

    for (const id of ["chat-top-fade", "chat-bottom-fade"]) {
      const fade = getByTestId(id);
      expect(fade.props.pointerEvents).toBe("none");
      expect(fade.props.colors).toHaveLength(id === "chat-top-fade" ? 3 : 2);
    }
    // Colors arrive processed as ARGB ints: opaque where the title sits, zero alpha (same hue, so no grey blend) at the open end.
    const alpha = (c: number) => c >>> 24;
    const top = getByTestId("chat-top-fade").props.colors;
    const bottom = getByTestId("chat-bottom-fade").props.colors;
    expect([alpha(top[0]), alpha(top[2])]).toEqual([255, 0]);
    expect([alpha(bottom[0]), alpha(bottom[1])]).toEqual([0, 255]);
    expect(top[2] & 0xffffff).toBe(top[0] & 0xffffff);
  });

  it("the notice text appears once, above the first message, with 3 answers in history", async () => {
    mockUseChat.mockReturnValue(
      chatState({
        messages: [
          user("q1", "First question?"),
          answer("a1", "One."),
          user("q2", "Two?"),
          answer("a2", "Two."),
          user("q3", "Three?"),
          answer("a3", "Three."),
        ],
      }),
    );
    const { getAllByText, UNSAFE_getAllByType } = await renderChat();

    expect(getAllByText(NOTICE)).toHaveLength(1);
    const texts = UNSAFE_getAllByType(Text).map((t) => String(t.props.children));
    expect(texts.indexOf(NOTICE)).toBeLessThan(texts.indexOf("First question?"));
  });

  it("a time line appears before the first message and after a 60-minute gap", async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 6, 12, 0) });
    const at = (h: number, m: number) => new Date(2026, 10, 6, h, m).getTime();
    mockUseChat.mockReturnValue(
      chatState({
        messages: [
          { ...user("q1", "Q1?"), createdAt: at(9, 0) },
          { ...answer("a1", "A1."), createdAt: at(9, 1) },
          { ...user("q2", "Q2?"), createdAt: at(10, 1) },
          { ...answer("a2", "A2."), createdAt: at(10, 2) },
        ],
      }),
    );
    try {
      const { getAllByText, getByText } = await renderChat();

      expect(getAllByText("Today")).toHaveLength(2);
      expect(getByText(`Today ${formatTimeLine(at(9, 0), new Date()).time}`)).toBeTruthy();
      expect(getByText(`Today ${formatTimeLine(at(10, 1), new Date()).time}`)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("four prompts show on an empty chat. Tapping one sends it and hides the chips", async () => {
    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      const { queryAllByRole, getByRole } = await renderChat();

      expect(promptButtons(queryAllByRole).map((b) => b.props.accessibilityLabel)).toEqual(CHAT_PROMPTS.slice(0, 4));

      fireEvent.press(getByRole("button", { name: CHAT_PROMPTS[0] }));

      expect(send).toHaveBeenCalledWith(CHAT_PROMPTS[0]);
      expect(promptButtons(queryAllByRole)).toHaveLength(0);
    } finally {
      random.mockRestore();
    }
  });

  it("prompts show when the last message is 2 hours old, and don't when it is 10 minutes old", async () => {
    const NOW = 1_800_000_000_000;
    const now = jest.spyOn(Date, "now").mockReturnValue(NOW);
    try {
      mockUseChat.mockReturnValue(chatState({ messages: [{ ...user("q1", "Q?"), createdAt: NOW - 2 * 60 * 60_000 }] }));
      const old = await renderChat();
      expect(promptButtons(old.queryAllByRole)).toHaveLength(4);
      old.unmount();

      mockUseChat.mockReturnValue(chatState({ messages: [{ ...user("q1", "Q?"), createdAt: NOW - 10 * 60_000 }] }));
      const recent = await renderChat();
      expect(promptButtons(recent.queryAllByRole)).toHaveLength(0);
    } finally {
      now.mockRestore();
    }
  });

  it("prompts wait until the history has loaded", async () => {
    mockUseChat.mockReturnValue(chatState({ loaded: false }));
    const { queryAllByRole } = await renderChat();

    expect(promptButtons(queryAllByRole)).toHaveLength(0);
  });

  it("prompts are hidden at the limit", async () => {
    mockUseChat.mockReturnValue(chatState({ remaining: 0 }));
    const { queryAllByRole } = await renderChat();

    expect(promptButtons(queryAllByRole)).toHaveLength(0);
  });

  it("old history (plain answer, citations, no reported) renders without number tags", async () => {
    mockUseChat.mockReturnValue(
      chatState({
        messages: [user("q1", "Is zakat due?"), answer("a1", "Yes, once it reaches nisab.", { citations: [QURAN, HADITH] })],
      }),
    );
    const { getByText, queryAllByRole, getByLabelText, getByRole } = await renderChat();

    expect(getByText("Yes, once it reaches nisab.")).toBeTruthy();
    expect(queryAllByRole("button", { name: /^Source \d+$/ })).toHaveLength(0);
    expect(getByLabelText("Answer: Yes, once it reaches nisab.").props.accessibilityActions).toEqual([
      { name: "copy", label: "Copy" },
      { name: "report", label: "Report" },
    ]);
    expect(getByText("Intentions")).toBeTruthy();
    expect(getByRole("button", { name: "Report a message" })).toBeTruthy();
  });

  it("an answer that arrives is scrolled to the top of the list, never past the end", async () => {
    const scrollToOffset = jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(() => {});
    try {
      mockUseChat.mockReturnValue(chatState({ messages: [user("q1", "Q?")] }));
      const screen = await renderChat();
      const list = screen.UNSAFE_getByType(FlatList);
      fireEvent(list, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } } });

      mockUseChat.mockReturnValue(chatState({ messages: [user("q1", "Q?"), answer("a1", "A.")] }));
      screen.rerender(tree());
      fireEvent(screen.getByTestId("chat-cell-a1"), "layout", { nativeEvent: { layout: { x: 0, y: 1000, width: 390, height: 300 } } });
      fireEvent(list, "contentSizeChange", 390, 3000);
      expect(scrollToOffset).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1000 - 8 }));

      fireEvent(list, "contentSizeChange", 390, 1300);
      expect(scrollToOffset).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 600 }));
    } finally {
      scrollToOffset.mockRestore();
    }
  });

  describe("report flow", () => {
    const history = () =>
      chatState({
        messages: [
          user("q1", "Q1?"),
          answer("a1", "First answer."),
          user("q2", "Q2?"),
          answer("a2", "Already reported.", { reported: true }),
          user("q3", "Q3?"),
          answer("a3", "", { notice: "blocked" }),
        ],
      });

    it("'Report a message' enters selection mode, with a selector only on reportable answers", async () => {
      mockUseChat.mockReturnValue(history());
      const { getByRole, getAllByRole, queryByLabelText } = await renderChat();

      fireEvent.press(getByRole("button", { name: "Report a message" }));

      expect(getAllByRole("radio")).toHaveLength(1);
      expect(queryByLabelText("Your question")).toBeNull();
      expect(getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    it("Report stays disabled until an answer is picked, and Cancel leaves the mode", async () => {
      mockUseChat.mockReturnValue(history());
      const { getByRole, queryAllByRole, getByLabelText } = await renderChat();

      fireEvent.press(getByRole("button", { name: "Report a message" }));
      expect(getByRole("button", { name: "Report" })).toBeDisabled();

      fireEvent.press(getByRole("radio", { name: "Select this answer" }));
      expect(getByRole("button", { name: "Report" })).toBeEnabled();

      fireEvent.press(getByRole("button", { name: "Cancel" }));
      expect(queryAllByRole("radio")).toHaveLength(0);
      expect(getByLabelText("Your question")).toBeTruthy();
    });

    it("success shows the thanks toast and leaves the mode", async () => {
      mockUseChat.mockReturnValue(history());
      const { getByRole, queryAllByRole, findByText } = await renderChat();

      fireEvent.press(getByRole("button", { name: "Report a message" }));
      fireEvent.press(getByRole("radio", { name: "Select this answer" }));
      fireEvent.press(getByRole("button", { name: "Report" }));

      expect(report).toHaveBeenCalledWith("a1");
      expect(await findByText(THANKS)).toBeTruthy();
      expect(queryAllByRole("radio")).toHaveLength(0);
    });

    it("failure shows the failure toast and stays in the mode", async () => {
      report.mockRejectedValueOnce(new Error("Couldn't send"));
      mockUseChat.mockReturnValue(history());
      const { getByRole, getAllByRole, findByText } = await renderChat();

      fireEvent.press(getByRole("button", { name: "Report a message" }));
      fireEvent.press(getByRole("radio", { name: "Select this answer" }));
      fireEvent.press(getByRole("button", { name: "Report" }));

      expect(await findByText(REPORT_FAILED)).toBeTruthy();
      expect(getAllByRole("radio")).toHaveLength(1);
    });

    it("a report in flight ignores further taps and keeps Report disabled", async () => {
      let finish: () => void = () => {};
      report.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
      mockUseChat.mockReturnValue(history());
      const { getByRole, findByText } = await renderChat();

      fireEvent.press(getByRole("button", { name: "Report a message" }));
      fireEvent.press(getByRole("radio", { name: "Select this answer" }));
      fireEvent.press(getByRole("button", { name: "Report" }));
      fireEvent.press(getByRole("button", { name: "Report" }));

      expect(report).toHaveBeenCalledTimes(1);
      expect(getByRole("button", { name: "Report" })).toBeDisabled();
      await act(async () => finish());
      expect(await findByText(THANKS)).toBeTruthy();
    });

    it("the long-press Report uses the same toasts and ignores a second tap in flight", async () => {
      let fail: (e: Error) => void = () => {};
      report.mockImplementationOnce(() => new Promise<void>((_, reject) => (fail = reject)));
      mockUseChat.mockReturnValue(chatState({ messages: [user("q1", "Q?"), answer("a1", "Answer.", { citations: [QURAN] })] }));
      const { getByTestId, findByText } = await renderChat();

      fireEvent(getByTestId("answer-menu"), "report");
      fireEvent(getByTestId("answer-menu"), "report");
      expect(report).toHaveBeenCalledTimes(1);

      await act(async () => fail(new Error("Couldn't send")));
      expect(await findByText(REPORT_FAILED)).toBeTruthy();

      fireEvent(getByTestId("answer-menu"), "report");
      expect(report).toHaveBeenLastCalledWith("a1");
      expect(await findByText(THANKS)).toBeTruthy();
    });

    it("no 'Report a message' link when nothing is reportable", async () => {
      mockUseChat.mockReturnValue(
        chatState({ messages: [user("q1", "Q?"), answer("a1", "Done.", { reported: true }), answer("a2", "", { notice: "blocked" })] }),
      );
      const { queryByRole } = await renderChat();

      expect(queryByRole("button", { name: "Report a message" })).toBeNull();
    });

    it("a reply that lands during selection mode is selectable", async () => {
      mockUseChat.mockReturnValue(history());
      const screen = await renderChat();
      fireEvent.press(screen.getByRole("button", { name: "Report a message" }));
      expect(screen.getAllByRole("radio")).toHaveLength(1);

      const next = history();
      mockUseChat.mockReturnValue({ ...next, messages: [...next.messages, user("q4", "Q4?"), answer("a4", "New answer.")] });
      screen.rerender(tree());

      expect(screen.getAllByRole("radio")).toHaveLength(2);
    });
  });
});
