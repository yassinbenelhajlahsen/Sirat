import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Ionicons: ({ testID, ...p }: any) => React.createElement(View, { testID, ...p }) };
});

jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GlassView: ({ children, ...p }: any) => React.createElement(View, p, children),
    isGlassEffectAPIAvailable: () => false,
    isLiquidGlassAvailable: () => false,
  };
});

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

jest.mock("@/components/PrayerDial", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return (props: any) =>
    React.createElement(Text, { testID: "prayer-dial" }, props.live ? "live" : "static");
});

let mockRamadanMode = true;
jest.mock("@/hooks/useRamadanMode", () => ({
  useRamadanMode: () => ({ ramadanMode: mockRamadanMode, setRamadanMode: jest.fn() }),
}));

import DayDetailPanel from "@/components/calendar/DayDetailPanel";
import { buildPrayerDay } from "@/services/prayerDay";

const baseProps = {
  date: new Date(2026, 2, 15),
  isToday: false,
  holiday: null as string | null,
  hijri: "Jumada I 24, 1448 AH",
  loading: false,
  prayerDay: buildPrayerDay(new Date(2026, 2, 15), [{ label: "Fajr", time: "5:31 AM" }]),
  error: null,
  onRetry: jest.fn(),
  onOpenSettings: jest.fn(),
  nextPrayer: null,
  timeLeft: "",
  statuses: {} as any,
  onPressPrayer: jest.fn(),
};

describe("DayDetailPanel", () => {
  it("lists the times without an arc for a non-today day", () => {
    const { queryByTestId, getByText } = render(<DayDetailPanel {...baseProps} />);
    expect(queryByTestId("prayer-dial")).toBeNull();
    expect(getByText("5:31 AM")).toBeTruthy();
  });

  it("lists today's times too, with no arc", () => {
    const { queryByTestId, getByText } = render(<DayDetailPanel {...baseProps} isToday />);
    expect(queryByTestId("prayer-dial")).toBeNull();
    expect(getByText("5:31 AM")).toBeTruthy();
  });

  it("keeps the prayer names on screen while a day loads, with placeholders for the times", () => {
    const { getByText, queryByText } = render(
      <DayDetailPanel {...baseProps} loading prayerDay={null} />,
    );
    // Mar 15 2026 is in Ramadan, so Fajr and Maghrib carry their suhoor/iftar names.
    ["Fajr/Suhoor", "Sunrise", "Dhuhr", "Asr", "Maghrib/Iftar", "Isha"].forEach((name) =>
      expect(getByText(name)).toBeTruthy(),
    );
    expect(queryByText("No prayer times available for this date.")).toBeNull();
  });

  it("shows the Hijri date it is given on the supporting line", () => {
    const { getByText } = render(<DayDetailPanel {...baseProps} />);
    expect(getByText(/Jumada I 24, 1448 AH/)).toBeTruthy();
  });

  it("offers Open Settings only when the error is about location", () => {
    const onOpenSettings = jest.fn();
    const generic = render(
      <DayDetailPanel {...baseProps} error={{ code: "GENERIC", message: "boom" }} onOpenSettings={onOpenSettings} />,
    );
    expect(generic.queryByText("Open Settings")).toBeNull();
    generic.unmount();

    const location = render(
      <DayDetailPanel {...baseProps} error={{ code: "LOCATION", message: "Location is off" }} onOpenSettings={onOpenSettings} />,
    );
    fireEvent.press(location.getByText("Open Settings"));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("appends the holiday to the supporting line", () => {
    const { getByText } = render(<DayDetailPanel {...baseProps} holiday="Laylat al-Mi'raj" />);
    expect(getByText(" · Laylat al-Mi'raj")).toBeTruthy();
  });

  it("renders long holiday names without a line clamp", () => {
    const longName = "Lailat-ul-Bara'ah (Night of Forgiveness, 15th Sha'ban)";
    const { getByText } = render(<DayDetailPanel {...baseProps} holiday={longName} />);
    expect(getByText(` · ${longName}`).props.numberOfLines).toBeUndefined();
  });

  it("shows the error card with a retry action", () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <DayDetailPanel
        {...baseProps}
        error={{ code: "GENERIC", message: "boom" }}
        onRetry={onRetry}
      />,
    );
    fireEvent.press(getByText("Try again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  describe("Ramadan days", () => {
    const ramadanDay = {
      ...baseProps,
      date: new Date(2027, 1, 10), // Ramadan 3, 1448
      prayerDay: buildPrayerDay(new Date(2027, 1, 10), [
        { label: "Fajr", time: "5:31 AM" },
        { label: "Maghrib", time: "5:42 PM" },
      ]),
    };
    afterEach(() => {
      mockRamadanMode = true;
    });

    it("renames Fajr and Maghrib to Fajr/Suhoor and Maghrib/Iftar", () => {
      const { getByText, queryByText } = render(<DayDetailPanel {...ramadanDay} />);
      expect(getByText("Fajr/Suhoor")).toBeTruthy();
      expect(getByText("Maghrib/Iftar")).toBeTruthy();
      expect(queryByText("Fajr")).toBeNull();
    });

    it("leaves them out when Ramadan mode is off or the day is outside Ramadan", () => {
      mockRamadanMode = false;
      const off = render(<DayDetailPanel {...ramadanDay} />);
      expect(off.queryByText("Fajr/Suhoor")).toBeNull();
      expect(off.getByText("Fajr")).toBeTruthy();
      off.unmount();

      mockRamadanMode = true;
      const outside = render(<DayDetailPanel {...ramadanDay} date={new Date(2027, 2, 9)} />);
      expect(outside.queryByText("Fajr/Suhoor")).toBeNull();
    });
  });
});
