import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DayDetailPanel from "@/components/calendar/DayDetailPanel";
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

const TIMES = [
  { label: "Fajr", time: "5:12 AM" }, { label: "Dhuhr", time: "1:01 PM" },
  { label: "Asr", time: "3:42 PM" }, { label: "Maghrib", time: "6:30 PM" }, { label: "Isha", time: "8:01 PM" },
] as any;
const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("DayDetailPanel logging", () => {
  beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

  it("logs a prayer for a past date", async () => {
    const past = new Date(2025, 5, 16); // 2025-06-16, local
    const { getByLabelText, getByText } = render(
      wrap(
        <DayDetailPanel
          date={past} isToday={false} holiday={null} loading={false}
          prayerTimes={TIMES} error={null} onRetry={jest.fn()} onOpenSettings={jest.fn()}
          nextPrayer={null} timeLeft=""
        />,
      ),
    );
    fireEvent.press(getByLabelText("Log Maghrib"));
    fireEvent.press(getByText("Missed"));
    await waitFor(async () => {
      expect((await getDayStatuses("2025-06-16")).maghrib).toBe("missed");
    });
  });
});
