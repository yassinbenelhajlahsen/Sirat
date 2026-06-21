// frontend/__tests__/screens/home-tracker-affordance.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Home from "@/app/(tabs)/index";
import { ThemeProvider } from "@/context/ThemeContext";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp };
});
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ isLoaded: true, isSignedIn: true, userId: "u1", email: null }),
}));
jest.mock("@/services/auth/authPrompts", () => ({
  isHomeCardDismissed: () => Promise.resolve(true),
  dismissHomeCard: () => Promise.resolve(),
  shouldShowHomeCard: () => Promise.resolve(false),
  markHomeCardShown: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/hooks/useHomePrayerTimes", () => ({
  useHomePrayerTimes: () => ({
    prayerTimes: [{ label: "Fajr", time: "5:12 AM" }],
    nextPrayer: { label: "Isha", time: "8:01 PM" },
    nextDayFajr: null, timeLeft: "1h", loading: false, refreshing: false,
    banner: "", locationLabel: "Tunis", refresh: jest.fn(),
  }),
}));
jest.mock("@/hooks/useTrackingStats", () => ({
  useTrackingStats: () => ({
    streak: 9,
    completion: { overall: 0, byPrayer: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } },
    qada: 0, dailyScores: [], year: 2026, monthIndex0: 5,
  }),
}));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Home tracker affordance", () => {
  beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

  it("shows the streak and routes to the Tracker", () => {
    const { getByLabelText, getByText } = render(wrap(<Home />));
    expect(getByText("9 day streak")).toBeTruthy();
    fireEvent.press(getByLabelText("View tracker and habits"));
    expect(mockPush).toHaveBeenCalledWith("/Tracker");
  });
});
