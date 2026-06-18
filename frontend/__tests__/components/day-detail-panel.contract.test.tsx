import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Ionicons: ({ testID, ...p }: any) => React.createElement(View, { testID, ...p }) };
});

jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GlassView: ({ children, ...p }: any) => React.createElement(View, p, children),
    isGlassEffectAPIAvailable: () => false,
    isLiquidGlassAvailable: () => false,
  };
});

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

jest.mock("@/components/PrayerArc", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return (props: any) =>
    React.createElement(Text, { testID: "prayer-arc" }, props.live ? "live" : "static");
});

import DayDetailPanel from "@/components/calendar/DayDetailPanel";

const baseProps = {
  date: new Date(2026, 2, 15),
  isToday: false,
  holiday: null as string | null,
  loading: false,
  prayerTimes: [{ label: "Fajr", time: "5:31 AM" }] as any,
  error: null,
  onRetry: jest.fn(),
  onOpenSettings: jest.fn(),
  nextPrayer: null,
  timeLeft: "",
};

describe("DayDetailPanel", () => {
  it("renders a static arc for a non-today day", () => {
    const { getByTestId } = render(<DayDetailPanel {...baseProps} />);
    expect(getByTestId("prayer-arc")).toHaveTextContent("static");
  });

  it("renders a live arc for today", () => {
    const { getByTestId } = render(<DayDetailPanel {...baseProps} isToday />);
    expect(getByTestId("prayer-arc")).toHaveTextContent("live");
  });

  it("shows the holiday chip when a holiday is present", () => {
    const { getByText } = render(<DayDetailPanel {...baseProps} holiday="Laylat al-Mi'raj" />);
    expect(getByText("Laylat al-Mi'raj")).toBeTruthy();
  });

  it("shows the error card with a retry action", () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <DayDetailPanel
        {...baseProps}
        error={{ code: "GENERIC", message: "boom" }}
        onRetry={onRetry}
      />,
    );
    fireEvent.press(getByText("Try again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
