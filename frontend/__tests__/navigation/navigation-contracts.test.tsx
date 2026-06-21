import React from "react";
import {
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { Animated, AppState } from "react-native";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockLocalSearchParams: Record<string, unknown> = {};

const mockUsePrayerTimes = jest.fn();
const mockUseNextPrayer = jest.fn();
const mockUseRamadanTracker = jest.fn();
const mockGetHolidayMapForYear = jest.fn();
const mockDateKeyFromDate = jest.fn();

jest.mock("@clerk/expo", () => ({
  ClerkProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }),
  useUser: () => ({ user: null }),
  useSSO: () => ({ startSSOFlow: jest.fn() }),
  getClerkInstance: () => ({ session: null }),
}));
jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: {} }));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Ionicons = (props: any) => React.createElement(View, props);
  Ionicons.font = {};
  return { Ionicons };
});

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
jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("@gorhom/portal", () => ({
  PortalProvider: ({ children }: any) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/context/QuranAudioProvider", () => ({
  QuranAudioProvider: ({ children }: any) => children,
}));
jest.mock("@/context/ThemeContext", () => {
  const { darkTheme } = require("@/constants/theme");
  return {
    ThemeProvider: ({ children }: any) => children,
    useTheme: () => ({ theme: darkTheme, isHydrated: true }),
  };
});

jest.mock("@/services/quranData", () => ({
  preloadQuranData: jest.fn(async () => {}),
}));
jest.mock("@/services/quranDisplayModes", () => ({
  preloadQuranDisplayModes: jest.fn(async () => {}),
}));
jest.mock("@/services/notificationService", () => ({
  NotificationService: { init: jest.fn() },
}));

jest.mock("@/components/SplashScreen", () => "SplashScreen");
jest.mock("@/components/UpdateModal", () => "UpdateModal");
jest.mock("@/components/quran/QuranMiniPlayerPortal", () => ({
  QuranMiniPlayerPortal: () => null,
}));
jest.mock("../../components/PressableScale", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return ({ children, ...props }: any) =>
    React.createElement(Pressable, props, children);
});

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
  const Tabs = Object.assign(
    jest.fn(({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    ),
    { Screen: jest.fn(() => null) },
  );
  const Stack = Object.assign(
    jest.fn(({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    ),
    { Screen: jest.fn(() => null) },
  );

  return {
    Tabs,
    Stack,
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
    }),
    useLocalSearchParams: () => mockLocalSearchParams,
  };
});

jest.mock("../../hooks/usePrayerTimes", () => ({
  usePrayerTimes: (...args: any[]) => mockUsePrayerTimes(...args),
}));
jest.mock("../../hooks/useNextPrayer", () => ({
  useNextPrayer: (...args: any[]) => mockUseNextPrayer(...args),
}));
jest.mock("../../hooks/useRamadanTracker", () => ({
  useRamadanTracker: (...args: any[]) => mockUseRamadanTracker(...args),
}));
jest.mock("../../services/holidayService", () => ({
  getHolidayMapForYear: (...args: any[]) => mockGetHolidayMapForYear(...args),
  dateKeyFromDate: (...args: any[]) => mockDateKeyFromDate(...args),
}));

import TabLayout from "@/app/(tabs)/_layout";
import RootLayout from "@/app/_layout";

describe("navigation contracts", () => {
  let appStateListenerSpy: jest.SpyInstance;
  let timingSpy: jest.SpyInstance;

  beforeAll(() => {
    timingSpy = jest.spyOn(Animated, "timing").mockImplementation(
      (value: any, config: any) =>
        ({
          start: (callback?: (result: { finished: boolean }) => void) => {
            if (
              typeof value?.setValue === "function" &&
              typeof config?.toValue === "number"
            ) {
              value.setValue(config.toValue);
            }
            callback?.({ finished: true });
          },
          stop: jest.fn(),
          reset: jest.fn(),
          _isUsingNativeDriver: () => false,
          _startNativeLoop: jest.fn(),
          _stopNativeLoop: jest.fn(),
        }) as any,
    );
  });

  afterAll(() => {
    timingSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};

    appStateListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as any);

    mockUsePrayerTimes.mockReturnValue({
      prayerTimes: [{ label: "Fajr", time: "05:15" }],
      loading: false,
      error: null,
      retry: jest.fn(),
      prayerTimesDateKey: "2026-03-22",
    });
    mockUseNextPrayer.mockReturnValue({
      nextPrayer: null,
      timeLeft: "",
    });
    mockUseRamadanTracker.mockReturnValue({
      isRamadan: false,
      isFastMissed: false,
      loadingRamadan: false,
      toggleMissedFast: jest.fn(),
    });
    mockGetHolidayMapForYear.mockResolvedValue({});
    mockDateKeyFromDate.mockImplementation((date: Date) =>
      date.toISOString().slice(0, 10),
    );
  });

  afterEach(() => {
    appStateListenerSpy.mockRestore();
  });

  it("registers tab routes in the tabs layout", () => {
    const expoRouter = jest.requireMock("expo-router") as {
      Tabs: jest.Mock & { Screen: jest.Mock };
    };

    render(<TabLayout />);

    expect(expoRouter.Tabs).toHaveBeenCalled();
    const tabsProps = expoRouter.Tabs.mock.calls[0]?.[0];
    expect(tabsProps.screenOptions).toEqual(
      expect.objectContaining({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }),
    );

    const routeNames = Array.from(
      new Set(expoRouter.Tabs.Screen.mock.calls.map(([props]) => props.name)),
    );
    expect(routeNames).toEqual([
      "index",
      "Quran",
      "Qibla",
      "Mosques",
      "Calendar",
    ]);
  });

  it("registers tabs and Settings routes in the root stack", async () => {
    const expoRouter = jest.requireMock("expo-router") as {
      Stack: jest.Mock & { Screen: jest.Mock };
    };

    render(<RootLayout />);

    await waitFor(() => {
      expect(expoRouter.Stack).toHaveBeenCalled();
    });

    const stackProps = expoRouter.Stack.mock.calls[0]?.[0];
    expect(stackProps.screenOptions).toEqual(
      expect.objectContaining({
        headerShown: false,
        animation: "fade",
        animationDuration: 280,
      }),
    );

    const registrations = expoRouter.Stack.Screen.mock.calls.map(
      ([props]) => props,
    );
    const routeNames = Array.from(
      new Set(registrations.map((registration) => registration.name)),
    );
    expect(routeNames).toEqual(expect.arrayContaining(["(tabs)", "Settings"]));
    expect(routeNames).not.toContain("MosqueMap");
  });
});
