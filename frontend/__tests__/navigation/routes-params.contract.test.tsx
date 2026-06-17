import React from "react";
import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { Animated, InteractionManager } from "react-native";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockLocalSearchParams: Record<string, unknown> = {};

const mockUseCalendarViewState = jest.fn();
const mockUseCalendarData = jest.fn();
const mockUseCalendarNavigationTransitions = jest.fn();
const mockUseCalendarSummaryTransition = jest.fn();
const mockUsePrayerTimes = jest.fn();
const mockUseNextPrayer = jest.fn();
const mockUseRamadanTracker = jest.fn();
const mockGetHolidayMapForYear = jest.fn();
const mockDateKeyFromDate = jest.fn();
const mockGetCachedMosques = jest.fn();
const mockGetNearbyMosques = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockLocalSearchParams,
}));

jest.mock("@/context/ThemeContext", () => {
  const { darkTheme } = require("@/constants/theme");
  return {
    useTheme: () => ({ theme: darkTheme }),
  };
});

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Ionicons: (props: any) => React.createElement(View, props),
    FontAwesome5: (props: any) => React.createElement(View, props),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(async () => {}),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  hasServicesEnabledAsync: jest.fn(async () => true),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 43.6532, longitude: -79.3832 },
  })),
}));

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  return {
    __esModule: true,
    default: MapView,
    Marker: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    Callout: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("../../hooks/useCalendarViewState", () => ({
  useCalendarViewState: (...args: any[]) => mockUseCalendarViewState(...args),
}));

jest.mock("../../hooks/useCalendarData", () => ({
  useCalendarData: (...args: any[]) => mockUseCalendarData(...args),
}));

jest.mock("../../hooks/useCalendarNavigationTransitions", () => ({
  useCalendarNavigationTransitions: (...args: any[]) =>
    mockUseCalendarNavigationTransitions(...args),
}));

jest.mock("../../hooks/useCalendarSummaryTransition", () => ({
  useCalendarSummaryTransition: (...args: any[]) =>
    mockUseCalendarSummaryTransition(...args),
}));

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

jest.mock("../../services/getNearbyMosques", () => ({
  getCachedMosques: (...args: any[]) => mockGetCachedMosques(...args),
  getNearbyMosques: (...args: any[]) => mockGetNearbyMosques(...args),
}));

jest.mock("../../components/PrayerTimesList", () => {
  const React = require("react");
  const { View } = require("react-native");
  return () => React.createElement(View);
});

import CalendarScreen from "@/app/(tabs)/Calendar";
import MosqueScreen from "@/app/(tabs)/Mosques";
import CalendarDetail from "@/app/[date]";

describe("route params and path wiring contract", () => {
  const ramadanStart = new Date("2026-03-01T00:00:00.000Z");
  const ramadanEnd = new Date("2026-03-30T00:00:00.000Z");
  const firstMissedFastDate = new Date("2026-03-05T00:00:00.000Z");

  let timingSpy: jest.SpyInstance;
  let interactionSpy: jest.SpyInstance;
  let loopSpy: jest.SpyInstance;

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

    interactionSpy = jest
      .spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation((task: any) => {
        if (typeof task === "function") {
          task();
        }
        return { cancel: jest.fn() } as any;
      });

    loopSpy = jest.spyOn(Animated, "loop").mockImplementation(
      () =>
        ({
          start: jest.fn(),
          stop: jest.fn(),
          reset: jest.fn(),
          _isUsingNativeDriver: () => false,
        }) as any,
    );
  });

  afterAll(() => {
    timingSpy.mockRestore();
    interactionSpy.mockRestore();
    loopSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockLocalSearchParams = {};

    mockUseCalendarViewState.mockReturnValue({
      today: new Date("2026-02-01T00:00:00.000Z"),
      minDate: new Date("2026-01-01T00:00:00.000Z"),
      maxDate: new Date("2027-12-31T00:00:00.000Z"),
      viewYear: 2026,
      setViewYear: jest.fn(),
      viewMonth: 2,
      setViewMonth: jest.fn(),
      viewMonthRef: { current: 2 },
      viewYearRef: { current: 2026 },
      initialIsViewingToday: false,
      isViewingToday: false,
      canGoPrev: true,
      canGoNext: true,
      dayButtonSize: 40,
      visibleMatrix: [[10, 0, 0, 0, 0, 0, 0]],
      monthName: "March",
    });

    mockUseCalendarData.mockReturnValue({
      holidayMap: {},
      loadingHolidays: false,
      ramadanStart,
      ramadanEnd,
      ramadanSummary: {
        totalMissed: 2,
        missedDays: ["Mar 5", "Mar 6"],
      },
      firstMissedFastDate,
      missedDaysLabel: "Mar 5, Mar 6",
      showRamadanSummary: true,
    });

    mockUseCalendarNavigationTransitions.mockReturnValue({
      navigating: false,
      setNavigating: jest.fn(),
      fadeAnim: new Animated.Value(1),
      translateX: new Animated.Value(0),
      backToTodayAnim: new Animated.Value(1),
      panHandlers: {},
      goToPreviousMonth: jest.fn(),
      goToNextMonth: jest.fn(),
      goBackToToday: jest.fn(),
    });

    mockUseCalendarSummaryTransition.mockReturnValue({
      ramadanSummaryAnim: new Animated.Value(1),
      renderRamadanSummary: true,
    });

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

    const mosques = [
      {
        id: "mosque-1",
        name: "Masjid One",
        address: "123 Main St",
        lat: 43.654,
        lng: -79.384,
      },
    ];
    mockGetCachedMosques.mockResolvedValue(mosques);
    mockGetNearbyMosques.mockResolvedValue(mosques);
  });

  it("pushes /[date] with selected day params from the calendar grid", () => {
    jest.useFakeTimers();
    const expectedDateIso = new Date(2026, 2, 10).toISOString();
    const { getByLabelText } = render(<CalendarScreen />);

    fireEvent.press(getByLabelText("Open March 10, 2026"));
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/[date]",
      params: {
        date: expectedDateIso,
        month: "2",
        year: "2026",
        holiday: "",
        ramadanStart: ramadanStart.toISOString(),
        ramadanEnd: ramadanEnd.toISOString(),
      },
    });
  });

  it("pushes /[date] with first missed fast params from Ramadan summary", () => {
    const { getByLabelText } = render(<CalendarScreen />);

    fireEvent.press(getByLabelText("Open first missed Ramadan fast date"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/[date]",
      params: {
        date: firstMissedFastDate.toISOString(),
        month: "2",
        year: "2026",
        holiday: "",
        ramadanStart: ramadanStart.toISOString(),
        ramadanEnd: ramadanEnd.toISOString(),
      },
    });
  });

  it("decodes [date] param and replaces back to Calendar with month/year query", async () => {
    mockLocalSearchParams = {
      date: encodeURIComponent("2026-03-22T00:00:00.000Z"),
      month: "2",
      year: "2026",
      holiday: "",
      ramadanStart: ramadanStart.toISOString(),
      ramadanEnd: ramadanEnd.toISOString(),
    };

    const { getByText } = render(<CalendarDetail />);

    await waitFor(() => {
      expect(mockUsePrayerTimes).toHaveBeenLastCalledWith(expect.any(Date));
    });

    const lastPrayerTimesArg =
      mockUsePrayerTimes.mock.calls[mockUsePrayerTimes.mock.calls.length - 1][0];
    expect(lastPrayerTimesArg.toISOString()).toBe("2026-03-22T00:00:00.000Z");

    fireEvent.press(getByText("Calendar"));
    expect(mockReplace).toHaveBeenCalledWith("/Calendar?month=2&year=2026");
  });

  it("wires map preview press to ../MosqueMap", async () => {
    const { getByLabelText } = render(<MosqueScreen />);

    const openMapButton = await waitFor(() =>
      getByLabelText("Open full mosque map"),
    );
    fireEvent.press(openMapButton);

    expect(mockPush).toHaveBeenCalledWith("../MosqueMap");
  });
});
