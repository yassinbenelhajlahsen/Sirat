import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, Keyboard } from "react-native";

import DuaCard from "@/components/DuaCard";

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
  const originalRequestAnimationFrame = global.requestAnimationFrame;

  beforeAll(() => {
    (global as any).requestAnimationFrame = (callback: (time: number) => void) => {
      callback(0);
      return 0;
    };
  });

  afterAll(() => {
    (global as any).requestAnimationFrame = originalRequestAnimationFrame;
  });

  it("renders core content and keeps submit disabled until input is meaningful", () => {
    const { getByLabelText, getByText } = render(
      <DuaCard onSubmit={jest.fn(async () => {})} />
    );

    expect(getByText("Ask for a Dua")).toBeTruthy();
    expect(getByText("Find Dua")).toBeTruthy();
    expect(getByLabelText("Dua request input")).toBeTruthy();
    expect(getByText("150")).toBeTruthy();
    expect(getByLabelText("Find dua")).toBeDisabled();
  });

  it("shows validation alert when submit is triggered with an empty input", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    const { getByLabelText } = render(
      <DuaCard onSubmit={jest.fn(async () => {})} />
    );

    fireEvent(getByLabelText("Dua request input"), "submitEditing");

    expect(alertSpy).toHaveBeenCalledWith("Please describe what you need help with");
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

  it("wires onInputFocus callback", () => {
    const onInputFocus = jest.fn();
    const { getByLabelText } = render(
      <DuaCard onSubmit={jest.fn(async () => {})} onInputFocus={onInputFocus} />
    );

    fireEvent(getByLabelText("Dua request input"), "focus");

    expect(onInputFocus).toHaveBeenCalledTimes(1);
  });
});
