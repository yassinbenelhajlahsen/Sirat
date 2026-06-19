// frontend/__tests__/screens/home-prayer-logging.test.tsx
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Home from "@/app/(tabs)/index";
import { ThemeProvider } from "@/context/ThemeContext";
import { getDayStatuses } from "@/services/prayerTracker";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp };
});
jest.mock("@gorhom/portal", () => ({ Portal: ({ children }: any) => children }));
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
// Provide deterministic prayer times so the arc renders passed prayers.
jest.mock("@/hooks/useHomePrayerTimes", () => ({
  useHomePrayerTimes: () => ({
    prayerTimes: [
      { label: "Fajr", time: "5:12 AM" },
      { label: "Dhuhr", time: "1:01 PM" },
      { label: "Asr", time: "3:42 PM" },
      { label: "Maghrib", time: "6:30 PM" },
      { label: "Isha", time: "8:01 PM" },
    ],
    nextPrayer: { label: "Isha", time: "8:01 PM" },
    nextDayFajr: null, timeLeft: "1h", loading: false, refreshing: false,
    banner: "", locationLabel: "Tunis", refresh: jest.fn(),
  }),
}));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Home prayer logging", () => {
  beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

  it("logs a prayer from the arc and persists it", async () => {
    const { getByLabelText, getByText } = render(wrap(<Home />));
    fireEvent.press(getByLabelText("Log Fajr"));
    fireEvent.press(getByText("Prayed"));
    await waitFor(async () => {
      const today = new Intl.DateTimeFormat("en-CA").format(new Date()); // YYYY-MM-DD
      expect((await getDayStatuses(today)).fajr).toBe("prayed");
    });
  });
});
