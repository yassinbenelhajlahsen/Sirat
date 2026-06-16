import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: { font: {} } }));
jest.mock("expo-asset", () => ({ Asset: { loadAsync: jest.fn(async () => {}) } }));
jest.mock("expo-constants", () => ({ appOwnership: "expo" }));
jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));
jest.mock("expo-system-ui", () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));
jest.mock("expo-updates", () => ({
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => {}),
  reloadAsync: jest.fn(async () => {}),
}));
jest.mock("@gorhom/portal", () => ({
  PortalProvider: ({ children }: any) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
}));
jest.mock("@/context/QuranAudioProvider", () => ({
  QuranAudioProvider: ({ children }: any) => children,
}));
jest.mock("@/context/ThemeContext", () => {
  const { darkTheme } = require("@/constants/theme");
  return {
    ThemeProvider: ({ children }: any) => children,
    useTheme: () => ({
      theme: darkTheme,
      isHydrated: true,
    }),
  };
});
jest.mock("@/services/quranData", () => ({
  preloadQuranData: jest.fn(async () => {}),
}));
jest.mock("@/services/quranDisplayModes", () => ({
  preloadQuranDisplayModes: jest.fn(async () => {}),
}));
jest.mock("@/components/SplashScreen", () => "SplashScreen");
jest.mock("@/components/UpdateModal", () => "UpdateModal");
jest.mock("@/components/quran/QuranMiniPlayerPortal", () => ({
  QuranMiniPlayerPortal: () => null,
}));
jest.mock("@/services/notificationService", () => ({
  NotificationService: { init: jest.fn() },
}));
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  hasServicesEnabledAsync: jest.fn(async () => true),
}));
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const Stack = Object.assign(
    jest.fn(({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    ),
    {
      Screen: jest.fn(() => null),
    },
  );

  return { Stack };
});

import RootLayout from "@/app/_layout";
import { preloadQuranData } from "@/services/quranData";

describe("root layout navigation contract", () => {
  let appStateListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as any);
  });

  afterEach(() => {
    appStateListenerSpy.mockRestore();
  });

  it("registers tabs and MosqueMap screens in the root stack", async () => {
    const expoRouter = jest.requireMock("expo-router") as {
      Stack: jest.Mock & { Screen: jest.Mock };
    };
    const stackMock = expoRouter.Stack as jest.Mock;
    const stackScreenMock = expoRouter.Stack.Screen as jest.Mock;

    render(<RootLayout />);

    // Wait for the initial async app sync effect to settle so state updates
    // occur within the test's act lifecycle.
    await waitFor(() => {
      expect(preloadQuranData).toHaveBeenCalled();
    });

    expect(stackMock).toHaveBeenCalled();
    const stackProps = stackMock.mock.calls[0]?.[0];
    expect(stackProps.screenOptions).toEqual(
      expect.objectContaining({
        headerShown: false,
        animation: "fade",
        animationDuration: 280,
      }),
    );

    const screenRegistrations = stackScreenMock.mock.calls.map(
      ([props]) => props,
    );
    const routeNames = Array.from(
      new Set(screenRegistrations.map((registration) => registration.name)),
    );

    expect(routeNames).toEqual(expect.arrayContaining(["(tabs)", "MosqueMap"]));

    const mosqueMapRegistration = screenRegistrations.find(
      (registration) => registration.name === "MosqueMap",
    );
    expect(mosqueMapRegistration).toBeDefined();
    expect(mosqueMapRegistration.options).toEqual(
      expect.objectContaining({
        animation: "fade",
        animationDuration: 300,
      }),
    );
  });
});
