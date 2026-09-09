// frontend/__tests__/components/PrayerDial.logging.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import PrayerDial from "@/components/PrayerDial";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const TIMES = [
  { label: "Fajr", time: "5:12 AM" },
  { label: "Sunrise", time: "6:40 AM" },
  { label: "Dhuhr", time: "1:01 PM" },
  { label: "Asr", time: "3:42 PM" },
  { label: "Maghrib", time: "6:30 PM" },
  { label: "Isha", time: "8:01 PM" },
] as any;

const DAY = new Date(2026, 2, 4);
const AFTERNOON = new Date(2026, 2, 4, 16, 0, 0);

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("PrayerDial logging mode", () => {
  it("renders status dots for logged prayers", () => {
    const { getByTestId } = render(
      wrap(
        <PrayerDial
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={{ label: "Asr", time: "3:42 PM" }}
          live={false}
          date={DAY}
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
        <PrayerDial
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={{ label: "Asr", time: "3:42 PM" }}
          now={AFTERNOON}
          date={DAY}
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

  it("exposes the logged status to assistive tech without changing the label", () => {
    const { getByLabelText } = render(
      wrap(
        <PrayerDial
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={{ label: "Asr", time: "3:42 PM" }}
          now={AFTERNOON}
          date={DAY}
          live
          logging
          statuses={{ fajr: "prayed" }}
          onPressPrayer={jest.fn()}
        />,
      ),
    );
    const fajr = getByLabelText("Log Fajr");
    expect(fajr.props.accessibilityValue).toEqual({ text: "Marked prayed" });
  });

  it("never offers Sunrise as something to log", () => {
    const { queryByLabelText } = render(
      wrap(
        <PrayerDial
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={null}
          live={false}
          date={DAY}
          logging
          statuses={{}}
          onPressPrayer={jest.fn()}
        />,
      ),
    );
    expect(queryByLabelText("Log Sunrise")).toBeNull();
  });

  it("leaves a prayer that has not come round yet unloggable", () => {
    const { queryByLabelText, getByLabelText } = render(
      wrap(
        <PrayerDial
          loading={false}
          prayerTimes={TIMES}
          nextPrayer={{ label: "Asr", time: "3:42 PM" }}
          now={AFTERNOON}
          date={DAY}
          live
          logging
          statuses={{}}
          onPressPrayer={jest.fn()}
        />,
      ),
    );
    expect(getByLabelText("Log Asr")).toBeTruthy();
    expect(queryByLabelText("Log Isha")).toBeNull();
  });
});
