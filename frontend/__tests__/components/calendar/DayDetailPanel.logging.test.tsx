import { fireEvent, render } from "@testing-library/react-native";
import DayDetailPanel from "@/components/calendar/DayDetailPanel";
import { ThemeProvider } from "@/context/ThemeContext";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

const TIMES = [
  { label: "Fajr", time: "5:12 AM" }, { label: "Dhuhr", time: "1:01 PM" },
  { label: "Asr", time: "3:42 PM" }, { label: "Maghrib", time: "6:30 PM" }, { label: "Isha", time: "8:01 PM" },
] as any;

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("DayDetailPanel logging", () => {
  it("calls onPressPrayer with prayer name and label when a loggable prayer is pressed", () => {
    const past = new Date(2025, 5, 16);
    const onPressPrayer = jest.fn();
    const { getByLabelText } = render(
      wrap(
        <DayDetailPanel
          date={past} isToday={false} holiday={null} loading={false}
          prayerTimes={TIMES} error={null} onRetry={jest.fn()} onOpenSettings={jest.fn()}
          nextPrayer={null} timeLeft=""
          statuses={{}}
          onPressPrayer={onPressPrayer}
        />,
      ),
    );
    fireEvent.press(getByLabelText("Log Maghrib"));
    expect(onPressPrayer).toHaveBeenCalledWith("maghrib" as PrayerName, "Maghrib");
  });

  it("renders the prayed dot when statuses contain a prayed prayer", () => {
    const past = new Date(2025, 5, 16);
    const statuses: Partial<Record<PrayerName, PrayerStatus>> = { fajr: "prayed" };
    const { getByTestId } = render(
      wrap(
        <DayDetailPanel
          date={past} isToday={false} holiday={null} loading={false}
          prayerTimes={TIMES} error={null} onRetry={jest.fn()} onOpenSettings={jest.fn()}
          nextPrayer={null} timeLeft=""
          statuses={statuses}
          onPressPrayer={jest.fn()}
        />,
      ),
    );
    expect(getByTestId("dot-prayed")).toBeTruthy();
  });

  it("lists future days without log buttons or status dots", () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const { queryByLabelText, queryByTestId, getByText } = render(
      wrap(
        <DayDetailPanel
          date={future} isToday={false} holiday={null} loading={false}
          prayerTimes={TIMES} error={null} onRetry={jest.fn()} onOpenSettings={jest.fn()}
          nextPrayer={null} timeLeft=""
          statuses={{}}
          onPressPrayer={jest.fn()}
        />,
      ),
    );
    expect(getByText("Maghrib")).toBeTruthy();
    expect(queryByLabelText("Log Maghrib")).toBeNull();
    expect(queryByTestId("dot-loggable")).toBeNull();
  });
});
