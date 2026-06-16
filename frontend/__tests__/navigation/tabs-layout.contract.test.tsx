import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock("@/context/ThemeContext", () => {
  const { darkTheme } = require("@/constants/theme");
  return {
    useTheme: () => ({ theme: darkTheme }),
  };
});

jest.mock("expo-router", () => {
  const React = require("react");
  const Tabs = Object.assign(
    jest.fn(({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    ),
    {
      Screen: jest.fn(() => null),
    },
  );

  return { Tabs };
});

import TabLayout from "@/app/(tabs)/_layout";

describe("tabs layout navigation contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers the tab routes and core tab bar options", () => {
    const expoRouter = jest.requireMock("expo-router") as {
      Tabs: jest.Mock & { Screen: jest.Mock };
    };
    const tabsMock = expoRouter.Tabs as jest.Mock;
    const tabScreenMock = expoRouter.Tabs.Screen as jest.Mock;

    render(<TabLayout />);

    expect(tabsMock).toHaveBeenCalled();

    const tabsProps = tabsMock.mock.calls[0]?.[0];
    expect(tabsProps.screenOptions).toEqual(
      expect.objectContaining({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }),
    );

    const routeNames = Array.from(
      new Set(tabScreenMock.mock.calls.map(([props]) => props.name)),
    );
    expect(routeNames).toEqual([
      "index",
      "Quran",
      "Qibla",
      "Mosques",
      "Calendar",
      "Settings",
    ]);

    tabScreenMock.mock.calls.forEach(([props]) => {
      expect(props.options).toEqual(
        expect.objectContaining({ title: expect.any(String) }),
      );
    });
  });
});
