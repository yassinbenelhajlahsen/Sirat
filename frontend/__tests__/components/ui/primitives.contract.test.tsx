import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import Button from "@/components/ui/Button";
import IconButton, { ICON_BUTTON_MIN_TARGET } from "@/components/ui/IconButton";
import SheetHeader from "@/components/ui/SheetHeader";
import SkeletonBar from "@/components/ui/SkeletonBar";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Button", () => {
  it("renders the label, fires onPress and defaults to a 44pt target", () => {
    const onPress = jest.fn();
    const { getByRole } = render(wrap(<Button label="Save" onPress={onPress} />));
    const btn = getByRole("button", { name: "Save" });
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(btn.props.style).height).toBe(44);
  });

  it("exposes disabled state and swallows presses", () => {
    const onPress = jest.fn();
    const { getByRole } = render(wrap(<Button label="Save" onPress={onPress} disabled />));
    const btn = getByRole("button", { name: "Save" });
    expect(btn.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows the loading label and a busy state", () => {
    const { getByRole, getByText } = render(
      wrap(<Button label="Find dua" loading loadingLabel="Finding..." />),
    );
    expect(getByText("Finding...")).toBeTruthy();
    expect(getByRole("button").props.accessibilityState.busy).toBe(true);
  });

  it("renders an Ionicon when asked", () => {
    const { getByText } = render(wrap(<Button label="New" icon="add" />));
    expect(getByText("icon:add")).toBeTruthy();
  });
});

describe("IconButton", () => {
  it("is a labelled button and pads small visuals back to the minimum target", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      wrap(<IconButton icon="close" size={32} accessibilityLabel="Close" onPress={onPress} />),
    );
    const btn = getByLabelText("Close");
    expect(btn.props.accessibilityRole).toBe("button");
    expect(btn.props.hitSlop).toBe((ICON_BUTTON_MIN_TARGET - 32) / 2);
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("has no hitSlop once the visual already meets the target", () => {
    const { getByLabelText } = render(
      wrap(<IconButton icon="settings-outline" accessibilityLabel="Open settings" />),
    );
    expect(getByLabelText("Open settings").props.hitSlop).toBe(0);
  });
});

describe("SheetHeader", () => {
  it("renders title, subtitle and wires the close control", () => {
    const onClose = jest.fn();
    const { getByText, getByLabelText } = render(
      wrap(<SheetHeader title="Search" subtitle="Find anything" onClose={onClose} />),
    );
    expect(getByText("Search")).toBeTruthy();
    expect(getByText("Find anything")).toBeTruthy();
    fireEvent.press(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the close control when there is no handler", () => {
    const { queryByLabelText } = render(wrap(<SheetHeader title="Log Fajr" />));
    expect(queryByLabelText("Close")).toBeNull();
  });
});

describe("SkeletonBar", () => {
  it("announces itself as a busy progress indicator", () => {
    const { getByRole } = render(wrap(<SkeletonBar height={14} width={120} />));
    const bar = getByRole("progressbar");
    expect(bar.props.accessibilityState.busy).toBe(true);
    expect(StyleSheet.flatten(bar.props.style).height).toBe(14);
  });
});
