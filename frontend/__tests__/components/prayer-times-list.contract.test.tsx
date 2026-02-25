import { Animated } from "react-native";
import { render } from "@testing-library/react-native";

import PrayerTimesList from "@/components/PrayerTimesList";
import type { PrayerTime } from "@/services/prayerTimes";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) => (
      <Text testID={`icon-${name}`}>{name}</Text>
    ),
  };
});

describe("PrayerTimesList contract", () => {
  const prayerTimes: PrayerTime[] = [
    { label: "Fajr", time: "05:14 AM" },
    { label: "Dhuhr", time: "12:22 PM" },
    { label: "Maghrib", time: "06:40 PM" },
  ];

  it("renders shimmer placeholders while loading", () => {
    const { UNSAFE_getAllByProps, queryByText } = render(
      <PrayerTimesList loading prayerTimes={prayerTimes} />
    );

    expect(
      UNSAFE_getAllByProps({ accessibilityRole: "progressbar" }).length
    ).toBeGreaterThanOrEqual(6);
    expect(queryByText("Fajr")).toBeNull();
  });

  it("renders prayer labels, times, and mapped icons in loaded state", () => {
    const { getByTestId, getByText } = render(
      <PrayerTimesList loading={false} prayerTimes={prayerTimes} />
    );

    expect(getByText("Fajr")).toBeTruthy();
    expect(getByText("05:14 AM")).toBeTruthy();
    expect(getByText("Dhuhr")).toBeTruthy();
    expect(getByText("12:22 PM")).toBeTruthy();
    expect(getByTestId("icon-moon-waning-crescent")).toBeTruthy();
    expect(getByTestId("icon-white-balance-sunny")).toBeTruthy();
  });

  it("uses a fallback icon for unknown prayer labels", () => {
    const { getByTestId, getByText } = render(
      <PrayerTimesList
        loading={false}
        prayerTimes={[{ label: "Tahajjud", time: "01:45 AM" }]}
        timeOpacity={new Animated.Value(1)}
        timeSlide={new Animated.Value(0)}
      />
    );

    expect(getByText("Tahajjud")).toBeTruthy();
    expect(getByText("01:45 AM")).toBeTruthy();
    expect(getByTestId("icon-time-outline")).toBeTruthy();
  });
});
