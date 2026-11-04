import { fireEvent, render } from "@testing-library/react-native";

import RamadanCard from "@/components/home/RamadanCard";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }: any) => <>{children}</>,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const TIMES = [
  { label: "Fajr", time: "5:30 AM" },
  { label: "Maghrib", time: "5:30 PM" },
];

describe("RamadanCard", () => {
  afterEach(() => resetTestTime());

  it("shows the day, the iftar target with a countdown, and opens the missed-fast action", () => {
    freezeTestTime(new Date(2027, 1, 10, 12, 0, 0)); // Ramadan 3, midday
    const onLog = jest.fn();
    const { getByText, getByLabelText } = render(
      <RamadanCard enabled prayerTimes={TIMES as any} tomorrowFajr="5:29 AM" onLogMissedFast={onLog} />,
    );

    expect(getByText("Ramadan 3")).toBeTruthy();
    expect(getByText(/^Iftar at /)).toBeTruthy();
    expect(getByText("in 5h 30m 0s")).toBeTruthy();

    fireEvent.press(getByLabelText("Log a missed fast"));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it("renders nothing outside Ramadan or when the mode is off", () => {
    freezeTestTime(new Date(2026, 10, 4, 12, 0, 0));
    const outside = render(
      <RamadanCard enabled prayerTimes={TIMES as any} tomorrowFajr={null} onLogMissedFast={jest.fn()} />,
    );
    expect(outside.queryByLabelText("Log a missed fast")).toBeNull();

    freezeTestTime(new Date(2027, 1, 10, 12, 0, 0));
    const off = render(
      <RamadanCard enabled={false} prayerTimes={TIMES as any} tomorrowFajr={null} onLogMissedFast={jest.fn()} />,
    );
    expect(off.queryByLabelText("Log a missed fast")).toBeNull();
  });
});
