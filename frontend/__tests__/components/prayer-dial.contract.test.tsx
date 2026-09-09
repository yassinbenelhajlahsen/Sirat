import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const Mock = ({ children, ...props }: any) => React.createElement(View, props, children);
  // SVG <Text> has to mock to a real Text node, or its content is invisible to
  // queries even though the component renders it.
  const TextMock = ({ children, ...props }: any) =>
    React.createElement(Text, props, children);
  return {
    __esModule: true,
    default: Mock,
    Svg: Mock,
    Path: Mock,
    Line: Mock,
    Circle: Mock,
    G: Mock,
    Defs: Mock,
    LinearGradient: Mock,
    RadialGradient: Mock,
    Stop: Mock,
    Text: TextMock,
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Ionicons: (props: any) => React.createElement(View, props) };
});

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import PrayerDial from "@/components/PrayerDial";

const COORDS = { latitude: 33.5731, longitude: -7.5898 };

const FULL = [
  { label: "Fajr", time: "5:35 AM" },
  { label: "Sunrise", time: "6:57 AM" },
  { label: "Dhuhr", time: "1:00 PM" },
  { label: "Asr", time: "4:15 PM" },
  { label: "Maghrib", time: "6:33 PM" },
  { label: "Isha", time: "7:53 PM" },
];

const DAY = new Date(2026, 2, 4);
const AFTERNOON = new Date(2026, 2, 4, 17, 30, 0);

describe("PrayerDial columns", () => {
  it("lists the five prayers and leaves Sunrise off the row", () => {
    const { getByText, queryByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={{ label: "Maghrib", time: "6:33 PM" }}
        now={AFTERNOON}
        date={DAY}
        coords={COORDS}
      />,
    );
    ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach((l) =>
      expect(getByText(l)).toBeTruthy(),
    );
    // Sunrise is a notch on the ring, not a sixth column pretending to be a prayer.
    expect(queryByText("Sunrise")).toBeNull();
  });

  it("keeps the sunrise time on the ring even though it has no column", () => {
    // It ends the Fajr window, so losing it entirely would drop real information.
    const { getByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={null}
        live={false}
        date={DAY}
      />,
    );
    expect(getByText("6:57")).toBeTruthy();
  });

  it("strips the period from column times", () => {
    const { getByText, queryByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={null}
        live={false}
        date={DAY}
      />,
    );
    expect(getByText("4:15")).toBeTruthy();
    expect(queryByText("4:15 PM")).toBeNull();
  });

  it("renders em dashes rather than crashing when a time is missing", () => {
    const { getAllByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={[{ label: "Fajr", time: "5:35 AM" }]}
        nextPrayer={null}
        live={false}
        date={DAY}
      />,
    );
    expect(getAllByText("—").length).toBe(4);
  });
});

describe("PrayerDial centre", () => {
  it("leads with the next prayer, its time and the live countdown", () => {
    const { getByTestId, getByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={{ label: "Maghrib", time: "6:33 PM" }}
        timeLeft="1h 3m 12s"
        now={AFTERNOON}
        date={DAY}
        coords={COORDS}
      />,
    );
    expect(getByTestId("dial-label")).toHaveTextContent("MAGHRIB");
    expect(getByTestId("dial-value")).toHaveTextContent("6:33");
    // Seconds are kept: this is what the removed Home hero used to provide.
    expect(getByText("in 1h 3m 12s")).toBeTruthy();
  });

  it("rolls over to tomorrow once the day's prayers are done", () => {
    const { getByTestId, getByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={null}
        tomorrowFajr="5:34 AM"
        now={new Date(2026, 2, 4, 22, 0, 0)}
        date={DAY}
        coords={COORDS}
      />,
    );
    expect(getByTestId("dial-label")).toHaveTextContent("FAJR TOMORROW");
    expect(getByTestId("dial-value")).toHaveTextContent("5:34");
    expect(getByText("Prayers done for today")).toBeTruthy();
  });

  it("exposes the tomorrow shortcut the old hero carried", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={null}
        tomorrowFajr="5:34 AM"
        now={new Date(2026, 2, 4, 22, 0, 0)}
        date={DAY}
        coords={COORDS}
        onPressCentre={onPress}
      />,
    );
    expect(getByLabelText("View tomorrow's prayer times")).toBeTruthy();
  });
});

describe("PrayerDial on a day that is not today", () => {
  const PAST = new Date(2026, 2, 3);

  it("shows the date and that day's daylight when nothing is logged", () => {
    const { getByTestId, getByText, queryByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={null}
        live={false}
        date={PAST}
        coords={COORDS}
      />,
    );
    expect(getByTestId("dial-value")).toHaveTextContent("3 Mar");
    // A day with no logs must not present an empty scoreboard.
    expect(queryByText("0 of 5 prayed")).toBeNull();
    expect(getByText(/of daylight$/)).toBeTruthy();
  });

  it("swaps the daylight line for a count once prayers are logged", () => {
    const { getByText, queryByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={null}
        live={false}
        date={PAST}
        coords={COORDS}
        statuses={{ fajr: "prayed", dhuhr: "prayed", asr: "late", isha: "missed" }}
      />,
    );
    expect(getByText("3 of 5 prayed")).toBeTruthy();
    expect(queryByText(/of daylight$/)).toBeNull();
  });

  it("treats a future date exactly like a past one", () => {
    // Neither has a "now", so neither gets a distinct treatment. The dashed
    // future ring only ever read as stitching across the dial.
    const future = new Date(Date.now() + 7 * 864e5);
    const { getByText, queryByText } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={null}
        live={false}
        date={future}
        coords={COORDS}
      />,
    );
    expect(getByText(/of daylight$/)).toBeTruthy();
    expect(queryByText(/prayed$/)).toBeNull();
  });

  it("draws the non-today ring solid, never dashed", () => {
    const { UNSAFE_queryAllByProps } = render(
      <PrayerDial
        loading={false}
        prayerTimes={FULL}
        nextPrayer={null}
        live={false}
        date={new Date(Date.now() + 7 * 864e5)}
        coords={COORDS}
      />,
    );
    expect(UNSAFE_queryAllByProps({ strokeDasharray: "1.5 8" })).toHaveLength(0);
  });

  it("does not mutate the date it is handed", () => {
    const past = new Date(2026, 2, 3, 9, 30, 0);
    const before = past.getTime();
    render(
      <PrayerDial loading={false} prayerTimes={FULL} nextPrayer={null} live={false} date={past} />,
    );
    expect(past.getTime()).toBe(before);
  });
});

describe("PrayerDial loading", () => {
  it("renders the labels with no centre value and does not crash", () => {
    const { getByText, queryByText } = render(
      <PrayerDial loading prayerTimes={[]} nextPrayer={null} now={AFTERNOON} date={DAY} />,
    );
    expect(getByText("Fajr")).toBeTruthy();
    expect(queryByText("6:33")).toBeNull();
  });
});
