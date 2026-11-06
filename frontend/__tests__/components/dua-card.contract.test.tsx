import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, Keyboard } from "react-native";

import DuaCard, { QUICK_PROMPTS } from "@/components/DuaCard";
import { matchDua } from "@/services/duaMatcher";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
  };
});

jest.mock("@/components/PressableScale", () => {
  const { Pressable } = require("react-native");
  return ({ children, ...props }: any) => (
    <Pressable {...props}>
      {children}
    </Pressable>
  );
});

describe("DuaCard contract", () => {
  it("offers Anxiety, Sleep and Forgiveness quick buttons, each reaching its own category", () => {
    const { getByLabelText, queryByLabelText } = render(<DuaCard onSubmit={jest.fn()} />);

    expect(QUICK_PROMPTS.map((p) => p.label)).toEqual(["Anxiety", "Sleep", "Forgiveness"]);
    for (const prompt of QUICK_PROMPTS) {
      expect(getByLabelText(`Ask for a ${prompt.label} dua`)).toBeTruthy();
      const match = matchDua(prompt.text);
      expect(match.kind === "match" && match.categories).toContain(prompt.category);
    }
    expect(queryByLabelText("Ask for a Gratitude dua")).toBeNull();
  });

  it("renders core content and keeps submit disabled until input is meaningful", () => {
    const { getByLabelText, getByText } = render(
      <DuaCard onSubmit={jest.fn(async () => {})} />
    );

    expect(getByText("Ask for a dua")).toBeTruthy();
    expect(getByText("Find dua")).toBeTruthy();
    expect(getByLabelText("Dua request input")).toBeTruthy();
    expect(getByText("150")).toBeTruthy();
    expect(getByLabelText("Find dua")).toBeDisabled();
  });

  it("keeps Find dua disabled and ignores Return until there is non-blank text", () => {
    const onSubmit = jest.fn(async () => {});
    const { getByLabelText } = render(<DuaCard onSubmit={onSubmit} />);

    fireEvent.changeText(getByLabelText("Dua request input"), "   ");
    expect(getByLabelText("Find dua")).toBeDisabled();
    fireEvent(getByLabelText("Dua request input"), "submitEditing");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText("Dua request input"), "Help me stay patient");
    expect(getByLabelText("Find dua")).not.toBeDisabled();
  });

  it("wires onSubmit, clears input, and dismisses keyboard on successful submit", async () => {
    const onSubmit = jest.fn(async () => {});
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(jest.fn());
    const { getByLabelText } = render(<DuaCard onSubmit={onSubmit} />);

    fireEvent.changeText(getByLabelText("Dua request input"), "Help me stay patient");
    fireEvent.press(getByLabelText("Find dua"));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Help me stay patient")
    );
    await waitFor(() =>
      expect(getByLabelText("Dua request input").props.value).toBe("")
    );
    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });

  it("shows loading contract and disables input interactions", () => {
    const { getByLabelText, getByText } = render(
      <DuaCard onSubmit={jest.fn(async () => {})} loading />
    );

    expect(getByText("Finding...")).toBeTruthy();
    expect(getByLabelText("Finding dua")).toBeDisabled();
    expect(getByLabelText("Dua request input").props.editable).toBe(false);
  });

});
