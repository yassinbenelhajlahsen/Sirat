// frontend/__tests__/components/PrayerArc.logging.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import PrayerArc from "@/components/PrayerArc";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const TIMES = [
  { label: "Fajr", time: "5:12 AM" },
  { label: "Sunrise", time: "6:40 AM" },
  { label: "Dhuhr", time: "1:01 PM" },
  { label: "Asr", time: "3:42 PM" },
  { label: "Maghrib", time: "6:30 PM" },
  { label: "Isha", time: "8:01 PM" },
] as any;

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("PrayerArc logging mode", () => {
  it("renders status dots for logged prayers", () => {
    const { getByTestId } = render(
      wrap(
        <PrayerArc
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={{ label: "Asr", time: "3:42 PM" }}
          live={false}
          logging
          statuses={{ fajr: "prayed", dhuhr: "late" }}
        />,
      ),
    );
    expect(getByTestId("dot-prayed")).toBeTruthy();
    expect(getByTestId("dot-late")).toBeTruthy();
  });

  it("calls onPressPrayer for a loggable (non-sunrise, passed) column", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      wrap(
        <PrayerArc
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={{ label: "Asr", time: "3:42 PM" }}
          live
          logging
          statuses={{}}
          onPressPrayer={onPress}
        />,
      ),
    );
    fireEvent.press(getByLabelText("Log Fajr"));
    expect(onPress).toHaveBeenCalledWith("fajr", "Fajr");
  });

  it("does not crash and renders nothing loggable for Sunrise", () => {
    const { queryByLabelText } = render(
      wrap(
        <PrayerArc loading={false} prayerTimes={TIMES} nextPrayer={null} live={false} logging statuses={{}} onPressPrayer={jest.fn()} />,
      ),
    );
    expect(queryByLabelText("Log Sunrise")).toBeNull();
  });
});
