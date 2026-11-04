// frontend/__tests__/screens/home-prayer-logging.test.tsx
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Home from "@/app/(tabs)/index";
import { ThemeProvider } from "@/context/ThemeContext";
import { getDayStatuses } from "@/services/prayerTracker";

jest.mock("@gorhom/portal", () => ({ Portal: ({ children }: any) => children }));
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});
// Provide deterministic prayer times so the arc renders passed prayers.
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
    prayerDay: require("@/services/prayerDay").buildPrayerDay(new Date(), [
      { label: "Fajr", time: "5:12 AM" },
      { label: "Dhuhr", time: "1:01 PM" },
      { label: "Asr", time: "3:42 PM" },
      { label: "Maghrib", time: "6:30 PM" },
      { label: "Isha", time: "8:01 PM" },
    ]),
    nextPrayer: { name: "Isha", at: new Date(2026, 0, 1, 20, 1) },
    nextDayFajr: null, timeLeft: "1h", loading: false, refreshing: false,
    banner: "", locationLabel: "Tunis", refresh: jest.fn(),
  }),
}));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Home prayer logging", () => {
  // Only Fajr..Asr have passed at this hour; without pinning, "Log Fajr" exists only when the suite runs after 5:12 AM.
  beforeEach(async () => {
    jest.useFakeTimers({
      now: new Date(2026, 5, 16, 16, 0),
      doNotFake: [
        "setTimeout", "clearTimeout", "setInterval", "clearInterval",
        "setImmediate", "clearImmediate", "nextTick", "queueMicrotask",
        "requestAnimationFrame", "cancelAnimationFrame", "performance",
      ],
    });
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });
  afterEach(() => { jest.useRealTimers(); });

  it("logs a prayer from the arc and persists it", async () => {
    const { getByLabelText, getByText } = render(wrap(<Home />));
    fireEvent.press(getByLabelText("Log Fajr"));
    fireEvent.press(getByText("Prayed"));
    await waitFor(async () => {
      const today = new Intl.DateTimeFormat("en-CA").format(new Date()); // YYYY-MM-DD
      expect((await getDayStatuses(today)).Fajr).toBe("prayed");
    });
  });
});
