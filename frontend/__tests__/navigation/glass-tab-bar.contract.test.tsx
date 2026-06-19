import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import GlassTabBar from "@/components/navigation/GlassTabBar";

const makeProps = (index: number, navigate: jest.Mock) => ({
  state: {
    index,
    routes: [
      { key: "index", name: "index" },
      { key: "Quran", name: "Quran" },
      { key: "Qibla", name: "Qibla" },
      { key: "Mosques", name: "Mosques" },
      { key: "Calendar", name: "Calendar" },
      { key: "Settings", name: "Settings" },
    ],
  },
  descriptors: {},
  navigation: { navigate, emit: () => ({ defaultPrevented: false }) },
} as any);

describe("GlassTabBar", () => {
  it("renders a button per visible tab and hides Settings", () => {
    const { getByLabelText, queryByLabelText } = render(
      <GlassTabBar {...makeProps(0, jest.fn())} />,
    );
    ["Home", "Quran", "Qibla", "Mosques", "Calendar"].forEach((t) =>
      expect(getByLabelText(t)).toBeTruthy(),
    );
    expect(queryByLabelText("Settings")).toBeNull();
  });

  it("navigates to the tapped route", () => {
    const navigate = jest.fn();
    const { getByLabelText } = render(<GlassTabBar {...makeProps(0, navigate)} />);
    fireEvent.press(getByLabelText("Quran"));
    expect(navigate).toHaveBeenCalledWith("Quran");
  });
});
