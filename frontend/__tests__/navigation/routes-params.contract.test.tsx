import React from "react";
import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { Animated } from "react-native";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockLocalSearchParams: Record<string, unknown> = {};

const mockUseCalendarViewState = jest.fn();
const mockUseCalendarData = jest.fn();
const mockUseCalendarNavigationTransitions = jest.fn();
const mockUseCalendarSummaryTransition = jest.fn();
const mockUsePrayerDay = jest.fn();
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
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
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

jest.mock("../../hooks/usePrayerDay", () => ({
  usePrayerDay: (...args: any[]) => mockUsePrayerDay(...args),
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

import CalendarScreen from "@/app/(tabs)/Calendar";
import MosqueScreen from "@/app/(tabs)/Mosques";

describe("route params and path wiring contract", () => {
  const firstMissedFastDate = new Date("2026-03-05T00:00:00.000Z");

  let timingSpy: jest.SpyInstance;
  let idleSpy: jest.SpyInstance;
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

    idleSpy = jest
      .spyOn(global, "requestIdleCallback")
      .mockImplementation((task: any) => {
        if (typeof task === "function") {
          task({ didTimeout: false, timeRemaining: () => 50 });
        }
        return 1 as any;
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
    idleSpy.mockRestore();
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
      fullMatrix: [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [10, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ],
      visibleMatrix: [[10, 0, 0, 0, 0, 0, 0]],
      monthName: "March",
    });

    mockUseCalendarData.mockReturnValue({
      holidayMap: {},
      loadingHolidays: false,
      ramadanSummary: {
        totalMissed: 2,
        missedDays: ["Mar 5", "Mar 6"],
      },
      ramadanMonthActive: true,
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

    mockUsePrayerDay.mockReturnValue({
      prayerDay: require("@/services/prayerDay").buildPrayerDay(new Date(2026, 2, 22), [{ label: "Fajr", time: "5:15 AM" }]),
      loading: false,
      error: null,
      retry: jest.fn(),
      nextPrayer: null,
      timeLeft: "",
      hijri: "",
      statuses: {},
      logSheet: { visible: false, prayerName: null, prayerLabel: "", currentStatus: undefined, onSelect: jest.fn(), onClear: jest.fn(), onClose: jest.fn() },
      openLogSheet: jest.fn(),
    });

    mockUseRamadanTracker.mockReturnValue({
      isRamadan: false,
      isFastMissed: false,
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

  it("selects the day inline from the calendar grid (no navigation)", () => {
    const expectedIso = new Date(2026, 2, 10).toISOString();
    const { getByLabelText } = render(<CalendarScreen />);

    fireEvent.press(getByLabelText("Select March 10, 2026"));

    expect(mockPush).not.toHaveBeenCalled();
    const calls = mockUsePrayerDay.mock.calls;
    const lastArg = calls[calls.length - 1][0] as Date | null;
    expect(lastArg?.toISOString()).toBe(expectedIso);
  });

  it("selects the first missed fast date inline from the Ramadan summary", () => {
    const { getByLabelText } = render(<CalendarScreen />);

    fireEvent.press(getByLabelText("Open first missed Ramadan fast date"));

    expect(mockPush).not.toHaveBeenCalled();
    const calls = mockUsePrayerDay.mock.calls;
    const lastArg = calls[calls.length - 1][0] as Date | null;
    // firstMissedFastDate (2026-03-05) is in the viewed month (March) → selected directly.
    expect(lastArg?.toISOString()).toBe(firstMissedFastDate.toISOString());
  });

  it("pre-selects the day passed via the `date` param (e.g. tomorrow from Home)", async () => {
    mockLocalSearchParams = {
      date: encodeURIComponent("2026-03-22T00:00:00.000Z"),
      month: "2",
      year: "2026",
    };

    render(<CalendarScreen />);

    await waitFor(() => {
      const calls = mockUsePrayerDay.mock.calls;
      const lastArg = calls[calls.length - 1][0] as Date | null;
      expect(lastArg?.toISOString()).toBe("2026-03-22T00:00:00.000Z");
    });
  });

  it("brings the month into view for a `date` param outside the month showing", async () => {
    const setViewMonth = jest.fn();
    const setViewYear = jest.fn();
    mockUseCalendarViewState.mockReturnValue({
      ...mockUseCalendarViewState(),
      setViewMonth,
      setViewYear,
    });
    mockLocalSearchParams = {
      date: encodeURIComponent("2026-04-12T12:00:00.000Z"),
      month: "3",
      year: "2026",
    };

    render(<CalendarScreen />);

    await waitFor(() => {
      expect(setViewMonth).toHaveBeenCalledWith(3);
      expect(setViewYear).toHaveBeenCalledWith(2026);
    });
  });
});
