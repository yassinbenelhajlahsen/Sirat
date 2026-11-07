import { fireEvent, render, within } from "@testing-library/react-native";
import { AccessibilityInfo, Clipboard, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import ChatBubble from "@/components/chat/ChatBubble";
import TypingBubble from "@/components/chat/TypingBubble";
import { CRISIS_MESSAGE } from "@/constants/crisis";
import { defaultTheme } from "@/constants/theme";
import type { Citation } from "@/services/chat/chatApi";
import type { ChatMessage } from "@/services/chat/chatStore";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme: theme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme, isHydrated: true }) };
});
jest.mock("@/services/quranData", () => ({
  getSurahMeta: () => [{ surahNumber: 2, englishName: "Al-Baqarah" }],
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const DISCLAIMER = "This is an aid and answers may be wrong. Please consult a trusted scholar.";
const BLOCKED = "I can't help with that one. Please ask a trusted scholar.";
const QURAN: Citation = { kind: "quran", surah: 2, ayah: 286, arabic: "لَا يُكَلِّفُ", english: "Allah does not burden a soul." };

const user = (extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "q1",
  role: "user",
  text: "Is zakat due on gold?",
  createdAt: 1,
  ...extra,
});
const answer = (extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "a1",
  role: "assistant",
  text: "**Yes**, once it reaches nisab [1].",
  createdAt: 2,
  citations: [QURAN],
  scholarLink: null,
  ...extra,
});

const NO_SELECTION = { active: false, selectable: false, selected: false, onSelect: jest.fn() };
const onRetry = jest.fn();
const onReport = jest.fn();
const onRefPress = jest.fn();

const renderBubble = (message: ChatMessage, selection = NO_SELECTION) =>
  render(
    <ChatBubble
      message={message}
      allowance={15}
      resetsAt="2026-12-01T00:00:00.000Z"
      sourceFocus={null}
      selection={selection}
      onRetry={onRetry}
      onReport={onReport}
      onRefPress={onRefPress}
    />,
  );

const flatStyle = (node: { props: { style?: StyleProp<ViewStyle> } }) => StyleSheet.flatten(node.props.style) ?? {};

beforeEach(() => jest.clearAllMocks());

describe("ChatBubble", () => {
  it("your message renders in an accent bubble labelled 'You said: …'", () => {
    const { getByLabelText, getByText, queryByTestId } = renderBubble(user());

    const bubble = getByLabelText("You said: Is zakat due on gold?");
    expect(flatStyle(bubble).backgroundColor).toBe(defaultTheme.colors.accent);
    expect(StyleSheet.flatten(getByText("Is zakat due on gold?").props.style).color).toBe(defaultTheme.colors.onAccent);
    expect(queryByTestId("answer-menu")).toBeNull();
    expect(bubble.props.accessibilityActions).toBeUndefined();
  });

  it("an answer renders AnswerText and SourcesBlock, with no disclaimer text", () => {
    const { getByLabelText, getByText, queryByText } = renderBubble(answer());

    expect(getByLabelText("Answer: Yes, once it reaches nisab.")).toBeTruthy();
    expect(getByText("Yes")).toBeTruthy();
    expect(getByText("SOURCES")).toBeTruthy();
    expect(getByText("Allah does not burden a soul.")).toBeTruthy();
    expect(queryByText(DISCLAIMER)).toBeNull();
  });

  it("the hold menu wraps the bubble with no sizing of its own, so the row hugs and wraps like any RN view", () => {
    const { getByTestId, getAllByLabelText, toJSON } = renderBubble(answer());
    const menu = getByTestId("answer-menu");

    expect(menu.props.style).toBeUndefined();
    expect(menu.props.canReport).toBe(true);
    expect(within(menu).getByLabelText("Answer: Yes, once it reaches nisab.")).toBeTruthy();
    expect(getAllByLabelText(/^Answer:/)).toHaveLength(1);
    expect(JSON.stringify(toJSON())).toContain('"maxWidth":"85%"');
  });

  it("a number tag calls onRefPress with the message id and number", () => {
    const { getByLabelText } = renderBubble(answer());

    fireEvent.press(getByLabelText("Source 1"));

    expect(onRefPress).toHaveBeenCalledWith("a1", 1);
  });

  it("VoiceOver reaches each number tag as a 'Source n' action on the answer, and an out-of-range ref gets none", () => {
    const hadith: Citation = {
      kind: "hadith",
      id: 7,
      title: "Intentions",
      text: "Actions are judged by intentions.",
      arabic: null,
      grade: "Authentic hadith",
      source: "Bukhari 1",
      credit: "HadeethEnc",
    };
    const { getByLabelText } = renderBubble(
      answer({ text: "Yes [2], see [1] and [2] and [5].", citations: [QURAN, hadith] }),
    );
    const bubble = getByLabelText("Answer: Yes, see and and.");

    expect(bubble.props.accessibilityActions).toEqual([
      { name: "Source 2", label: "Source 2" },
      { name: "Source 1", label: "Source 1" },
      { name: "copy", label: "Copy" },
      { name: "report", label: "Report" },
    ]);
    fireEvent(bubble, "accessibilityAction", { nativeEvent: { actionName: "Source 2" } });
    expect(onRefPress).toHaveBeenCalledWith("a1", 2);
  });

  it("Copy writes copyText to the clipboard", () => {
    const setString = jest.spyOn(Clipboard, "setString").mockImplementation(() => {});
    const { getByTestId } = renderBubble(answer());

    fireEvent(getByTestId("answer-menu"), "copy");

    expect(setString).toHaveBeenCalledWith("Yes, once it reaches nisab.\n\nQuran 2:286 (Al-Baqarah)");
    setString.mockRestore();
  });

  it("VoiceOver copies and reports straight from actions on the answer", () => {
    const setString = jest.spyOn(Clipboard, "setString").mockImplementation(() => {});
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const { getByLabelText } = renderBubble(answer());
    const bubble = getByLabelText("Answer: Yes, once it reaches nisab.");

    fireEvent(bubble, "accessibilityAction", { nativeEvent: { actionName: "copy" } });
    expect(setString).toHaveBeenCalledWith("Yes, once it reaches nisab.\n\nQuran 2:286 (Al-Baqarah)");
    expect(announce).toHaveBeenCalledWith("Copied");
    fireEvent(bubble, "accessibilityAction", { nativeEvent: { actionName: "report" } });
    expect(onReport).toHaveBeenCalledWith("a1");
    expect(onRefPress).not.toHaveBeenCalled();
    setString.mockRestore();
    announce.mockRestore();
  });

  it("Report is offered for an unreported answer and hidden when `reported` is set", () => {
    const { getByTestId, getByLabelText, rerender } = renderBubble(answer());

    fireEvent(getByTestId("answer-menu"), "report");
    expect(onReport).toHaveBeenCalledWith("a1");

    rerender(
      <ChatBubble
        message={answer({ reported: true })}
        allowance={15}
        resetsAt={null}
        sourceFocus={null}
        selection={NO_SELECTION}
        onRetry={onRetry}
        onReport={onReport}
        onRefPress={onRefPress}
      />,
    );
    expect(getByTestId("answer-menu").props.canReport).toBe(false);
    expect(getByLabelText("Answer: Yes, once it reaches nisab.").props.accessibilityActions).toEqual([
      { name: "Source 1", label: "Source 1" },
      { name: "copy", label: "Copy" },
    ]);
  });

  it("blocked and limit bubbles offer Copy only, and the crisis box has no menu", () => {
    const setString = jest.spyOn(Clipboard, "setString").mockImplementation(() => {});
    const blocked = renderBubble(answer({ text: "", citations: [], notice: "blocked" }));
    expect(blocked.getByLabelText(`Answer: ${BLOCKED}`)).toBeTruthy();
    expect(blocked.getByTestId("answer-menu").props.canReport).toBe(false);
    fireEvent(blocked.getByTestId("answer-menu"), "copy");
    expect(setString).toHaveBeenLastCalledWith(BLOCKED);
    blocked.unmount();

    const limit = renderBubble(answer({ text: "", citations: [], notice: "limit" }));
    expect(limit.getByTestId("answer-menu").props.canReport).toBe(false);
    fireEvent(limit.getByTestId("answer-menu"), "copy");
    expect(setString).toHaveBeenLastCalledWith("You've used this month's 15 messages. They reset on December 1.");
    limit.unmount();

    const crisis = renderBubble(answer({ text: "", citations: [], notice: "crisis" }));
    expect(crisis.getByText(CRISIS_MESSAGE)).toBeTruthy();
    expect(crisis.queryByTestId("answer-menu")).toBeNull();
    expect(crisis.getByLabelText(CRISIS_MESSAGE).props.accessibilityActions).toBeUndefined();
    setString.mockRestore();
  });

  it("a failed message shows 'Not delivered. Tap to retry', and pressing it calls onRetry", () => {
    const { getByText } = renderBubble(user({ status: "failed" }));

    fireEvent.press(getByText("Not delivered. Tap to retry"));

    expect(onRetry).toHaveBeenCalledWith("q1");
  });

  it("in selection mode a selectable answer shows a selector with the selected state, and non-selectable items are dimmed", () => {
    const onSelect = jest.fn();
    const { getByRole, rerender, getByLabelText, queryByRole, queryByTestId, toJSON } = renderBubble(answer(), {
      active: true,
      selectable: true,
      selected: true,
      onSelect,
    });

    const selector = getByRole("radio");
    expect(selector.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(queryByTestId("answer-menu")).toBeNull();
    expect(getByLabelText("Answer: Yes, once it reaches nisab.").props.accessibilityActions).toEqual([
      { name: "Source 1", label: "Source 1" },
    ]);
    fireEvent.press(selector);
    fireEvent.press(getByLabelText("Answer: Yes, once it reaches nisab."));
    expect(onSelect).toHaveBeenCalledTimes(2);

    rerender(
      <ChatBubble
        message={user()}
        allowance={15}
        resetsAt={null}
        sourceFocus={null}
        selection={{ active: true, selectable: false, selected: false, onSelect }}
        onRetry={onRetry}
        onReport={onReport}
        onRefPress={onRefPress}
      />,
    );
    expect(queryByRole("radio")).toBeNull();
    const root = toJSON() as { props: { style?: StyleProp<ViewStyle> } };
    expect(flatStyle(root).opacity).toBe(0.35);
  });
});

describe("TypingBubble", () => {
  it("has the label 'Writing an answer'", () => {
    const { getByLabelText } = render(<TypingBubble />);
    expect(getByLabelText("Writing an answer")).toBeTruthy();
  });
});
