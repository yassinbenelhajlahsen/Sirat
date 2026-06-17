import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Mock = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  return {
    __esModule: true,
    default: Mock,
    Svg: Mock,
    Path: Mock,
    Line: Mock,
    Circle: Mock,
    G: Mock,
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Ionicons: (props: any) => React.createElement(View, props) };
});

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import PrayerArc from "@/components/PrayerArc";

const FULL = [
  { label: "Fajr", time: "5:00 AM" },
  { label: "Sunrise", time: "6:30 AM" },
  { label: "Dhuhr", time: "12:30 PM" },
  { label: "Asr", time: "3:30 PM" },
  { label: "Maghrib", time: "6:00 PM" },
  { label: "Isha", time: "8:00 PM" },
];

const NOW = (() => {
  const d = new Date(2026, 5, 17);
  d.setHours(16, 30, 0, 0);
  return d;
})();

describe("PrayerArc contract", () => {
  it("renders all six prayers with their (period-stripped) times", () => {
    const { getByText } = render(
      <PrayerArc
        loading={false}
        prayerTimes={FULL}
        nextPrayer={{ label: "Maghrib", time: "6:00 PM" }}
        now={NOW}
      />,
    );

    ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach((label) =>
      expect(getByText(label)).toBeTruthy(),
    );
    expect(getByText("6:00")).toBeTruthy();
  });

  it("renders a loading state with placeholder times and no crash", () => {
    const { queryByText, getByText } = render(
      <PrayerArc loading prayerTimes={[]} nextPrayer={null} now={NOW} />,
    );

    expect(getByText("Fajr")).toBeTruthy();
    expect(queryByText("6:00")).toBeNull();
  });
});
