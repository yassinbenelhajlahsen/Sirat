import React from "react";
import { Animated, Linking } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { defaultTheme } from "@/constants/theme";

const mockPush = jest.fn();

const mockRefresh = jest.fn(async () => {});
const mockSubmitDua = jest.fn();
const mockCloseDua = jest.fn();
const mockScrollToBottom = jest.fn();

const mockHandleLocationToggle = jest.fn(async () => {});
const mockSetTheme = jest.fn(async () => {});
const mockSetCityModalVisible = jest.fn();
const mockSelectCityByKey = jest.fn();

const mockPauseAudio = jest.fn();
const mockStopAudio = jest.fn();
const mockPlaySurah = jest.fn();
const mockClearPendingSurahFocus = jest.fn();

const mockGoToPreviousMonth = jest.fn();
const mockGoToNextMonth = jest.fn();
const mockGoBackToToday = jest.fn();
const mockSetNavigating = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: jest.fn(),
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Ionicons: (props: unknown) => <View {...(props as object)} />,
    FontAwesome5: (props: unknown) => <View {...(props as object)} />,
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: jest.fn(() => 0),
}));

jest.mock("react-native-dropdown-picker", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return function DropDownPickerMock({
    value,
  }: {
    value?: string | number | null;
  }) {
    return <Text testID="dropdown-picker">{String(value ?? "")}</Text>;
  };
});

jest.mock("@/hooks/useHomePrayerTimes", () => ({
  useHomePrayerTimes: jest.fn(),
}));

jest.mock("@/hooks/useDuaInteraction", () => ({
  useDuaInteraction: jest.fn(),
}));

jest.mock("@/hooks/useKeyboardAutoScroll", () => ({
  useKeyboardAutoScroll: jest.fn(),
}));

jest.mock("@/hooks/useModalTransition", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/hooks/usePrayerSettingsState", () => ({
  usePrayerSettingsState: jest.fn(),
}));

jest.mock("@/hooks/useSettingsPermissions", () => ({
  useSettingsPermissions: jest.fn(),
}));

jest.mock("@/hooks/useSettingsDropdowns", () => ({
  useSettingsDropdowns: jest.fn(),
}));

jest.mock("@/hooks/useQuranDisplayModes", () => ({
  useQuranDisplayModes: jest.fn(),
}));

jest.mock("@/hooks/useCalendarViewState", () => ({
  useCalendarViewState: jest.fn(),
}));

jest.mock("@/hooks/useCalendarData", () => ({
  useCalendarData: jest.fn(),
}));

jest.mock("@/hooks/useCalendarNavigationTransitions", () => ({
  useCalendarNavigationTransitions: jest.fn(),
}));

jest.mock("@/hooks/useCalendarSummaryTransition", () => ({
  useCalendarSummaryTransition: jest.fn(),
}));

jest.mock("@/context/QuranAudioProvider", () => ({
  useQuranAudioController: jest.fn(),
}));

jest.mock("@/services/quranData", () => ({
  getAllAyat: jest.fn(),
  getSurahMeta: jest.fn(),
  getAyatIndexForSurahAndAyah: jest.fn(),
}));

jest.mock("@/services/quranProgress", () => ({
  getLastReadAyahIndex: jest.fn(),
  saveLastReadAyahIndex: jest.fn(),
  saveLastReadSurahAndAyah: jest.fn(),
}));

jest.mock("@/services/quranBookmarks", () => ({
  getBookmarks: jest.fn(),
  getBookmarkKey: jest.fn(),
  upsertBookmark: jest.fn(),
  deleteBookmark: jest.fn(),
}));

jest.mock("@/services/holidayService", () => ({
  dateKeyFromDate: jest.fn(),
}));

jest.mock("@/services/getNearbyMosques", () => ({
  getCachedMosques: jest.fn(),
  getNearbyMosques: jest.fn(),
}));

jest.mock("expo-audio", () => ({
  setIsAudioActiveAsync: jest.fn(async () => {}),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = ({ children, ...props }: { children: React.ReactNode }) => (
    <View {...props}>{children}</View>
  );
  return {
    __esModule: true,
    default: MapView,
    Marker: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
    Callout: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  const FlashList = React.forwardRef(function FlashListMock(
    props: {
      data: unknown[];
      onLoad?: () => void;
    },
    ref: React.ForwardedRef<{
      scrollToIndex: () => void;
      scrollToOffset: () => void;
    }>,
  ) {
    React.useImperativeHandle(ref, () => ({
      scrollToIndex: jest.fn(),
      scrollToOffset: jest.fn(),
    }));

    React.useEffect(() => {
      props.onLoad?.();
    }, [props.onLoad]);

    return (
      <View>
        <Text testID="flash-list-mock">items:{props.data?.length ?? 0}</Text>
      </View>
    );
  });

  return { FlashList };
});

jest.mock("@/components/PrayerArc", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return function PrayerArcMock({
    loading,
    prayerTimes,
  }: {
    loading: boolean;
    prayerTimes: unknown[];
  }) {
    return (
      <Text testID="prayer-arc">
        loading:{String(loading)} count:{prayerTimes.length}
      </Text>
    );
  };
});

jest.mock("@/components/DuaCard", () => {
  const React = require("react");
  const { Text, TouchableOpacity, View } = require("react-native");

  return function DuaCardMock({
    loading,
    onSubmit,
    onInputFocus,
  }: {
    loading: boolean;
    onSubmit: (value: string) => void;
    onInputFocus: () => void;
  }) {
    return (
      <View>
        <Text>DuaCardMock</Text>
        <Text>{loading ? "dua-loading" : "dua-idle"}</Text>
        <TouchableOpacity
          accessibilityLabel="Submit dua request"
          onPress={() => onSubmit("help me")}
        >
          <Text>Submit Dua</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Focus dua input"
          onPress={onInputFocus}
        >
          <Text>Focus Dua</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock("@/components/DuaResultCard", () => {
  const React = require("react");
  const { Text, TouchableOpacity, View } = require("react-native");

  return function DuaResultCardMock({
    onClose,
    dua,
  }: {
    onClose: () => void;
    dua: { id?: string };
  }) {
    return (
      <View>
        <Text>DuaResultCardMock</Text>
        <Text>{dua?.id ?? "no-dua-id"}</Text>
        <TouchableOpacity accessibilityLabel="Close dua result" onPress={onClose}>
          <Text>Close Dua</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock("@/components/PressableScale", () => {
  const React = require("react");
  const { TouchableOpacity } = require("react-native");

  return function PressableScaleMock({
    children,
    onPress,
    ...rest
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) {
    return (
      <TouchableOpacity onPress={onPress} {...rest}>
        {children}
      </TouchableOpacity>
    );
  };
});

jest.mock("@/components/CitySearchModal", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return function CitySearchModalMock({ visible }: { visible: boolean }) {
    return <Text>CitySearchModal:{visible ? "open" : "closed"}</Text>;
  };
});

jest.mock("@/components/NotificationSettings", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return function NotificationSettingsMock({ notifStatus }: { notifStatus: string }) {
    return <Text>NotificationSettings:{notifStatus}</Text>;
  };
});

jest.mock("@/components/quran/navigator/NavigatorModal", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return function NavigatorModalMock({ visible }: { visible: boolean }) {
    return <Text>NavigatorModal:{visible ? "open" : "closed"}</Text>;
  };
});

jest.mock("@/components/quran/QuranAyahCard", () => {
  const React = require("react");
  const { View } = require("react-native");

  return function QuranAyahCardMock() {
    return <View />;
  };
});

jest.mock("@/components/quran/QuranBookmarkModal", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return function QuranBookmarkModalMock({ visible }: { visible: boolean }) {
    return <Text>QuranBookmarkModal:{visible ? "open" : "closed"}</Text>;
  };
});

jest.mock("@/components/quran/QuranCompletionCard", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return function QuranCompletionCardMock() {
    return <Text>QuranCompletionCard</Text>;
  };
});

jest.mock("@/components/quran/QuranDisplaySettingsModal", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return function QuranDisplaySettingsModalMock({
    visible,
  }: {
    visible: boolean;
  }) {
    return <Text>QuranDisplaySettingsModal:{visible ? "open" : "closed"}</Text>;
  };
});

import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import Home from "@/app/(tabs)/index";
import Settings from "@/app/Settings";
import QuranScreen from "@/app/(tabs)/Quran";
import CalendarScreen from "@/app/(tabs)/Calendar";
import MosqueScreen from "@/app/(tabs)/Mosques";
import { useTheme } from "@/context/ThemeContext";
import { useDuaInteraction } from "@/hooks/useDuaInteraction";
import { useHomePrayerTimes } from "@/hooks/useHomePrayerTimes";
import { useKeyboardAutoScroll } from "@/hooks/useKeyboardAutoScroll";
import useModalTransition from "@/hooks/useModalTransition";
import { usePrayerSettingsState } from "@/hooks/usePrayerSettingsState";
import { useSettingsDropdowns } from "@/hooks/useSettingsDropdowns";
import { useSettingsPermissions } from "@/hooks/useSettingsPermissions";
import { useQuranAudioController } from "@/context/QuranAudioProvider";
import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useCalendarNavigationTransitions } from "@/hooks/useCalendarNavigationTransitions";
import { useCalendarSummaryTransition } from "@/hooks/useCalendarSummaryTransition";
import { useCalendarViewState } from "@/hooks/useCalendarViewState";
import { deleteBookmark, getBookmarkKey, getBookmarks, upsertBookmark } from "@/services/quranBookmarks";
import { getAllAyat, getAyatIndexForSurahAndAyah, getSurahMeta } from "@/services/quranData";
import { getCachedMosques, getNearbyMosques } from "@/services/getNearbyMosques";
import { dateKeyFromDate } from "@/services/holidayService";
import { getLastReadAyahIndex, saveLastReadAyahIndex, saveLastReadSurahAndAyah } from "@/services/quranProgress";

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseLocalSearchParams =
  useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;
const mockUseHomePrayerTimes = useHomePrayerTimes as jest.MockedFunction<
  typeof useHomePrayerTimes
>;
const mockUseDuaInteraction = useDuaInteraction as jest.MockedFunction<
  typeof useDuaInteraction
>;
const mockUseKeyboardAutoScroll =
  useKeyboardAutoScroll as jest.MockedFunction<typeof useKeyboardAutoScroll>;
const mockUseModalTransition = useModalTransition as jest.MockedFunction<
  typeof useModalTransition
>;
const mockUsePrayerSettingsState =
  usePrayerSettingsState as jest.MockedFunction<typeof usePrayerSettingsState>;
const mockUseSettingsPermissions =
  useSettingsPermissions as jest.MockedFunction<typeof useSettingsPermissions>;
const mockUseSettingsDropdowns =
  useSettingsDropdowns as jest.MockedFunction<typeof useSettingsDropdowns>;
const mockUseQuranAudioController =
  useQuranAudioController as jest.MockedFunction<typeof useQuranAudioController>;
const mockUseQuranDisplayModes =
  useQuranDisplayModes as jest.MockedFunction<typeof useQuranDisplayModes>;
const mockUseCalendarViewState =
  useCalendarViewState as jest.MockedFunction<typeof useCalendarViewState>;
const mockUseCalendarData =
  useCalendarData as jest.MockedFunction<typeof useCalendarData>;
const mockUseCalendarNavigationTransitions =
  useCalendarNavigationTransitions as jest.MockedFunction<
    typeof useCalendarNavigationTransitions
  >;
const mockUseCalendarSummaryTransition =
  useCalendarSummaryTransition as jest.MockedFunction<
    typeof useCalendarSummaryTransition
  >;

const mockGetAllAyat = getAllAyat as jest.MockedFunction<typeof getAllAyat>;
const mockGetSurahMeta = getSurahMeta as jest.MockedFunction<typeof getSurahMeta>;
const mockGetAyatIndexForSurahAndAyah =
  getAyatIndexForSurahAndAyah as jest.MockedFunction<
    typeof getAyatIndexForSurahAndAyah
  >;
const mockGetLastReadAyahIndex =
  getLastReadAyahIndex as jest.MockedFunction<typeof getLastReadAyahIndex>;
const mockSaveLastReadAyahIndex =
  saveLastReadAyahIndex as jest.MockedFunction<typeof saveLastReadAyahIndex>;
const mockSaveLastReadSurahAndAyah =
  saveLastReadSurahAndAyah as jest.MockedFunction<
    typeof saveLastReadSurahAndAyah
  >;
const mockGetBookmarks = getBookmarks as jest.MockedFunction<typeof getBookmarks>;
const mockGetBookmarkKey =
  getBookmarkKey as jest.MockedFunction<typeof getBookmarkKey>;
const mockUpsertBookmark =
  upsertBookmark as jest.MockedFunction<typeof upsertBookmark>;
const mockDeleteBookmark =
  deleteBookmark as jest.MockedFunction<typeof deleteBookmark>;
const mockDateKeyFromDate =
  dateKeyFromDate as jest.MockedFunction<typeof dateKeyFromDate>;
const mockGetCachedMosques =
  getCachedMosques as jest.MockedFunction<typeof getCachedMosques>;
const mockGetNearbyMosques =
  getNearbyMosques as jest.MockedFunction<typeof getNearbyMosques>;

const mockHasServicesEnabledAsync =
  Location.hasServicesEnabledAsync as jest.MockedFunction<
    typeof Location.hasServicesEnabledAsync
  >;
const mockGetForegroundPermissionsAsync =
  Location.getForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.getForegroundPermissionsAsync
  >;
const mockRequestForegroundPermissionsAsync =
  Location.requestForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.requestForegroundPermissionsAsync
  >;
const mockGetCurrentPositionAsync =
  Location.getCurrentPositionAsync as jest.MockedFunction<
    typeof Location.getCurrentPositionAsync
  >;

const sampleAyah = {
  surahNumber: 1,
  surahNameAr: "الفاتحة",
  surahNameEn: "Al-Fatihah",
  juzNumber: 1,
  ayahNumber: 1,
  arabicText: "الْحَمْدُ لِلَّهِ",
  englishText: "All praise is for Allah",
  transliteration: "Alhamdu lillah",
};

const sampleSurah = {
  surahNumber: 1,
  arabicName: "الفاتحة",
  englishName: "Al-Fatihah",
  ayahCount: 7,
  revelationPlace: "Mecca",
  revelationType: "Meccan",
  pages: "1",
  juzRanges: [{ juzNumber: 1, startAyah: 1, endAyah: 7 }],
};

const ramadanStart = new Date("2026-03-01T00:00:00.000Z");
const ramadanEnd = new Date("2026-03-30T00:00:00.000Z");
const firstMissedFastDate = new Date("2026-03-05T00:00:00.000Z");

const buildHomePrayerState = (overrides: Record<string, unknown> = {}) => ({
  prayerTimes: [{ label: "Fajr", time: "5:00 AM" }],
  nextPrayer: { label: "Dhuhr", time: "12:30 PM" },
  nextDayFajr: null,
  timeLeft: "2h 12m",
  loading: false,
  refreshing: false,
  banner: null,
  locationLabel: "Chicago, US",
  refresh: mockRefresh,
  ...overrides,
});

const buildDuaInteraction = (overrides: Record<string, unknown> = {}) => ({
  selectedDua: null,
  duaLoading: false,
  duaSwapAnim: new Animated.Value(1),
  submitDua: mockSubmitDua,
  closeDua: mockCloseDua,
  ...overrides,
});

const buildPrayerSettingsState = (overrides: Record<string, unknown> = {}) => ({
  useLocation: true,
  setUseLocation: jest.fn(),
  method: 2,
  setMethod: jest.fn(),
  city: { name: "Chicago", country: "US" },
  cityModalVisible: false,
  setCityModalVisible: mockSetCityModalVisible,
  cityItems: [{ label: "Chicago", value: "chicago" }],
  selectCityByKey: mockSelectCityByKey,
  ...overrides,
});

const buildPermissionsState = (overrides: Record<string, unknown> = {}) => ({
  permissionStatus: "granted",
  notifStatus: "granted",
  handleLocationToggle: mockHandleLocationToggle,
  ...overrides,
});

const buildDropdownState = (overrides: Record<string, unknown> = {}) => ({
  methodOpen: false,
  setMethodOpen: jest.fn(),
  methodItems: [{ label: "MWL", value: 2 }],
  setMethodItems: jest.fn(),
  themeOpen: false,
  setThemeOpen: jest.fn(),
  themeItems: [{ label: "Default", value: "default" }],
  setThemeItems: jest.fn(),
  methodScaleStyle: {},
  themeScaleStyle: {},
  locationAnim: new Animated.Value(1),
  toggleScale: new Animated.Value(1),
  ...overrides,
});

const buildAudioController = (overrides: Record<string, unknown> = {}) => ({
  isPlaying: false,
  isAudioLoading: false,
  audioIconName: "play",
  audioAccessibilityLabel: "Play current surah",
  pauseAudio: mockPauseAudio,
  stopAudio: mockStopAudio,
  offlinePillVisible: false,
  playSurah: mockPlaySurah,
  pendingSurahFocusNumber: null,
  clearPendingSurahFocus: mockClearPendingSurahFocus,
  ...overrides,
});

const buildCalendarViewState = (overrides: Record<string, unknown> = {}) => ({
  today: new Date("2026-03-10T00:00:00.000Z"),
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
  ...overrides,
});

const buildCalendarData = (overrides: Record<string, unknown> = {}) => ({
  holidayMap: {},
  loadingHolidays: false,
  ramadanStart,
  ramadanEnd,
  ramadanSummary: { totalMissed: 2, missedDays: ["Mar 5"] },
  firstMissedFastDate,
  missedDaysLabel: "Mar 5",
  showRamadanSummary: true,
  ...overrides,
});

const buildCalendarNavigation = (overrides: Record<string, unknown> = {}) => ({
  navigating: false,
  setNavigating: mockSetNavigating,
  fadeAnim: new Animated.Value(1),
  translateX: new Animated.Value(0),
  backToTodayAnim: new Animated.Value(1),
  panHandlers: {},
  goToPreviousMonth: mockGoToPreviousMonth,
  goToNextMonth: mockGoToNextMonth,
  goBackToToday: mockGoBackToToday,
  ...overrides,
});

const buildCalendarSummaryTransition = (
  overrides: Record<string, unknown> = {},
) => ({
  ramadanSummaryAnim: new Animated.Value(1),
  renderRamadanSummary: true,
  ...overrides,
});

describe("Screen contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: mockPush,
    } as any);
    mockUseLocalSearchParams.mockReturnValue({
      month: "2",
      year: "2026",
    } as any);

    mockUseTheme.mockReturnValue({
      theme: defaultTheme,
      themeName: "default",
      setTheme: mockSetTheme,
    } as any);

    mockUseHomePrayerTimes.mockReturnValue(buildHomePrayerState() as any);
    mockUseDuaInteraction.mockReturnValue(buildDuaInteraction() as any);
    mockUseKeyboardAutoScroll.mockReturnValue({
      scrollViewRef: { current: null },
      keyboardHeight: 0,
      onDuaSectionLayout: jest.fn(),
      onScrollViewLayout: jest.fn(),
    } as any);
    mockUseModalTransition.mockReturnValue({
      shouldRender: true,
      cardAnimatedStyle: {},
    } as any);

    mockUsePrayerSettingsState.mockReturnValue(
      buildPrayerSettingsState() as any,
    );
    mockUseSettingsPermissions.mockReturnValue(buildPermissionsState() as any);
    mockUseSettingsDropdowns.mockReturnValue(buildDropdownState() as any);

    mockUseQuranAudioController.mockReturnValue(buildAudioController() as any);
    mockUseQuranDisplayModes.mockReturnValue({
      isModeEnabled: jest.fn(() => true),
    } as any);
    mockGetAllAyat.mockReturnValue([sampleAyah] as any);
    mockGetSurahMeta.mockReturnValue([sampleSurah] as any);
    mockGetAyatIndexForSurahAndAyah.mockReturnValue(0 as any);
    mockGetLastReadAyahIndex.mockResolvedValue(0);
    mockSaveLastReadAyahIndex.mockResolvedValue(undefined as any);
    mockSaveLastReadSurahAndAyah.mockResolvedValue(undefined as any);
    mockGetBookmarks.mockResolvedValue([]);
    mockGetBookmarkKey.mockImplementation(
      ((surahNumber: number, ayahNumber: number) =>
        `${surahNumber}:${ayahNumber}`) as any,
    );
    mockUpsertBookmark.mockResolvedValue([] as any);
    mockDeleteBookmark.mockResolvedValue([] as any);

    mockUseCalendarViewState.mockReturnValue(buildCalendarViewState() as any);
    mockUseCalendarData.mockReturnValue(buildCalendarData() as any);
    mockUseCalendarNavigationTransitions.mockReturnValue(
      buildCalendarNavigation() as any,
    );
    mockUseCalendarSummaryTransition.mockReturnValue(
      buildCalendarSummaryTransition() as any,
    );
    mockDateKeyFromDate.mockImplementation((date: Date) =>
      date.toISOString().slice(0, 10),
    );

    mockHasServicesEnabledAsync.mockResolvedValue(true);
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as any);
    mockRequestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as any);
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 43.6532, longitude: -79.3832 },
    } as any);
    mockGetCachedMosques.mockResolvedValue([]);
    mockGetNearbyMosques.mockResolvedValue([]);
  });

  describe("Home", () => {
    it("renders the prayer and dua sections contract", () => {
      const { getByText, getByTestId, getByLabelText } = render(<Home />);

      expect(getByText("Chicago, US")).toBeTruthy();
      expect(getByText("Dhuhr")).toBeTruthy();
      expect(getByText("DuaCardMock")).toBeTruthy();
      expect(getByTestId("prayer-arc")).toHaveTextContent("loading:false count:1");
      expect(getByLabelText("Open settings")).toBeTruthy();
    });

    it("opens settings from the header gear", () => {
      const { getByLabelText } = render(<Home />);
      fireEvent.press(getByLabelText("Open settings"));
      expect(mockPush).toHaveBeenCalledWith("/Settings");
    });

    it("navigates to tomorrow prayer details from the completion branch", () => {
      mockUseHomePrayerTimes.mockReturnValue(
        buildHomePrayerState({
          nextPrayer: null,
          nextDayFajr: "5:11 AM",
        }) as any,
      );

      const { getByLabelText } = render(<Home />);

      fireEvent.press(getByLabelText("View tomorrow prayer times"));

      expect(mockPush).toHaveBeenCalledTimes(1);
      const pushPayload = mockPush.mock.calls[0][0] as {
        pathname: string;
        params: Record<string, string>;
      };
      expect(pushPayload.pathname).toBe("../[date]");
      expect(pushPayload.params).toEqual(
        expect.objectContaining({
          date: expect.any(String),
          month: expect.any(String),
          year: expect.any(String),
        }),
      );
    });
  });

  describe("Settings", () => {
    it("renders settings title and notifications contract", () => {
      const { getByText } = render(<Settings />);

      expect(getByText("Settings")).toBeTruthy();
      expect(
        getByText(
          "Using live location. Turn this off to choose a fixed city.",
        ),
      ).toBeTruthy();
      expect(getByText("NotificationSettings:granted")).toBeTruthy();
    });

    it("routes location toggle changes through permissions hook", async () => {
      const { getByLabelText } = render(<Settings />);

      fireEvent(getByLabelText("Use my location"), "valueChange", false);

      await waitFor(() => {
        expect(mockHandleLocationToggle).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("Quran", () => {
    it("renders quran header and list contract", async () => {
      const { getByText, getByTestId } = render(<QuranScreen />);

      expect(getByText("Quran")).toBeTruthy();

      await waitFor(() => {
        expect(getByTestId("flash-list-mock")).toHaveTextContent("items:2");
      });
    });

    it("wires play button to audio controller", async () => {
      const { getByLabelText, getByTestId } = render(<QuranScreen />);

      await waitFor(() => {
        expect(getByTestId("flash-list-mock")).toHaveTextContent("items:2");
      });

      fireEvent.press(getByLabelText("Play current surah"));

      expect(mockPlaySurah).toHaveBeenCalledWith({
        surahNumber: 1,
        englishName: "Al-Fatihah",
        arabicName: "الفاتحة",
      });
    });
  });

  describe("Calendar", () => {
    it("renders calendar header and month contract", () => {
      const { getByText, getByLabelText } = render(<CalendarScreen />);

      expect(getByText("Calendar")).toBeTruthy();
      expect(getByText("March 2026")).toBeTruthy();
      expect(getByLabelText("Open March 10, 2026")).toBeTruthy();
    });

    it("routes next month button to transition handler", () => {
      const { getByLabelText } = render(<CalendarScreen />);

      fireEvent.press(getByLabelText("Next month"));

      expect(mockGoToNextMonth).toHaveBeenCalledTimes(1);
    });
  });

  describe("Mosques", () => {
    it("renders location-services gate contract when services are off", async () => {
      mockHasServicesEnabledAsync.mockResolvedValue(false);
      mockGetForegroundPermissionsAsync.mockResolvedValue({
        status: "undetermined",
      } as any);
      mockRequestForegroundPermissionsAsync.mockResolvedValue({
        status: "undetermined",
      } as any);

      const { getByText } = render(<MosqueScreen />);

      await waitFor(() => {
        expect(getByText("Nearby Mosques")).toBeTruthy();
      });
      expect(getByText("Location Services Off")).toBeTruthy();
      expect(
        getByText(
          "Location is required to show nearby mosques and center the map.",
        ),
      ).toBeTruthy();
    });

    it("opens device settings from denied-permission gate branch", async () => {
      mockHasServicesEnabledAsync.mockResolvedValue(true);
      mockGetForegroundPermissionsAsync.mockResolvedValue({
        status: "denied",
      } as any);
      mockRequestForegroundPermissionsAsync.mockResolvedValue({
        status: "denied",
      } as any);

      const openSettingsSpy = jest
        .spyOn(Linking, "openSettings")
        .mockResolvedValueOnce(undefined);

      const { getByLabelText } = render(<MosqueScreen />);

      const openSettingsButton = await waitFor(() =>
        getByLabelText("Open device settings"),
      );
      fireEvent.press(openSettingsButton);

      await waitFor(() => {
        expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      });
      openSettingsSpy.mockRestore();
    });
  });
});
