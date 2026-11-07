import { fireEvent, render } from "@testing-library/react-native";

import ChatComposer from "@/components/chat/ChatComposer";
import ChatHeaderTitle from "@/components/chat/ChatHeaderTitle";
import QuickPrompts from "@/components/chat/QuickPrompts";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const composer = (props: Partial<React.ComponentProps<typeof ChatComposer>> = {}) => (
  <ChatComposer value="" onChangeText={() => {}} onSend={() => {}} sending={false} limit={null} {...props} />
);

describe("ChatComposer contract", () => {
  it("caps the question at 1000 characters and counts from 900", () => {
    const { getByLabelText, queryByText, getByText, rerender } = render(composer({ value: "a".repeat(899) }));
    expect(getByLabelText("Your question").props.maxLength).toBe(1000);
    expect(queryByText("899/1000")).toBeNull();

    rerender(composer({ value: "a".repeat(900) }));
    expect(getByText("900/1000")).toBeTruthy();
  });

  it("has no send button while the field is empty or only spaces, and a Send button once text is typed", () => {
    const onSend = jest.fn();
    const { queryByRole, getByRole, rerender } = render(composer({ value: "   ", onSend }));
    expect(queryByRole("button", { name: "Send" })).toBeNull();

    rerender(composer({ value: "Hello", onSend }));
    fireEvent.press(getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("disables Send while a reply is in progress", () => {
    const { getByRole } = render(composer({ value: "Hello", sending: true }));
    expect(getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("with a limit, the field is gone and both lines show", () => {
    const { queryByLabelText, getByText } = render(composer({ value: "Hello", limit: ["Line one.", "Line two."] }));
    expect(queryByLabelText("Your question")).toBeNull();
    expect(getByText("Line one.")).toBeTruthy();
    expect(getByText("Line two.")).toBeTruthy();
  });
});

describe("ChatHeaderTitle contract", () => {
  it("shows the title and what is left", () => {
    const { getByText } = render(<ChatHeaderTitle remaining={12} allowance={15} />);
    expect(getByText("Ask")).toBeTruthy();
    expect(getByText("12 of 15 left")).toBeTruthy();
  });

  it("has no second line without a count", () => {
    const { getByText, queryByText } = render(<ChatHeaderTitle remaining={null} allowance={15} />);
    expect(getByText("Ask")).toBeTruthy();
    expect(queryByText(/left/)).toBeNull();
  });
});

describe("QuickPrompts contract", () => {
  it("pressing a chip calls onPick with its text", () => {
    const onPick = jest.fn();
    const { getByText } = render(<QuickPrompts prompts={["What is zakat?", "How do I pray?"]} onPick={onPick} />);
    fireEvent.press(getByText("How do I pray?"));
    expect(onPick).toHaveBeenCalledWith("How do I pray?");
  });
});
