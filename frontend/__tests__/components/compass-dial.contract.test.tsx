import React from "react";
import { render } from "@testing-library/react-native";

import CompassDial from "@/components/qibla/CompassDial";

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => {
    const { defaultTheme } = require("@/constants/theme");
    return { theme: defaultTheme };
  },
}));

jest.mock("@/components/ui/GlassSurface", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: ({ children, ...p }: any) => <View {...p}>{children}</View> };
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  const Svg = ({ children, ...p }: any) => <View {...p}>{children}</View>;
  return {
    __esModule: true,
    default: Svg,
    Svg,
    G: Svg,
    Line: (p: any) => <View {...p} />,
    Circle: (p: any) => <View {...p} />,
    Text: ({ children, ...p }: any) => <Text {...p}>{children}</Text>,
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  function useSharedValue(initial: number) {
    const shared = { value: initial, get: () => shared.value };
    return shared;
  }
  return {
    __esModule: true,
    default: { View },
    useSharedValue,
    useAnimatedStyle: (updater: () => object) => updater(),
    withSpring: (value: number) => value,
  };
});

describe("components/CompassDial", () => {
  const base = {
    heading: 0,
    qiblaAngle: 117,
    rotation: 117,
    distanceKm: 4160,
    isAligned: false,
  };

  it("renders bearing, distance and cardinals while seeking", () => {
    const { getByText } = render(<CompassDial {...base} />);
    expect(getByText("117°")).toBeTruthy();
    expect(getByText("to Makkah")).toBeTruthy();
    expect(getByText("4,160 km")).toBeTruthy();
    expect(getByText("N")).toBeTruthy();
    expect(getByText("E")).toBeTruthy();
  });

  it("swaps the core to the aligned label and hides the bearing", () => {
    const { getByText, queryByText } = render(
      <CompassDial {...base} rotation={0} isAligned />,
    );
    expect(getByText("Facing Makkah")).toBeTruthy();
    expect(queryByText("117°")).toBeNull();
  });

  it("omits the distance line when distanceKm is null", () => {
    const { queryByText } = render(<CompassDial {...base} distanceKm={null} />);
    expect(queryByText(/km$/)).toBeNull();
  });
});
