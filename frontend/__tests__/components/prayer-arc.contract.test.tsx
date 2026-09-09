import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Mock = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  return {
    __esModule: true,
    default: Mock,
    Svg: Mock,
    Path: Mock,
    Line: Mock,
    Circle: Mock,
    G: Mock,
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

import PrayerArc from "@/components/PrayerArc";
import { arcPoint } from "@/utils/prayerArc";

// Same construction as the component's ARC_PATH.
const ARC_PATH_D = `M${arcPoint(0).x},${arcPoint(0).y} Q150,2 ${arcPoint(1).x},${arcPoint(1).y}`;

const FULL = [
  { label: "Fajr", time: "5:00 AM" },
  { label: "Sunrise", time: "6:30 AM" },
  { label: "Dhuhr", time: "12:30 PM" },
  { label: "Asr", time: "3:30 PM" },
  { label: "Maghrib", time: "6:00 PM" },
  { label: "Isha", time: "8:00 PM" },
];

const NOW = (() => {
  const d = new Date(2026, 5, 17);
  d.setHours(16, 30, 0, 0);
  return d;
})();

const TIMES = [
  { label: "Fajr", time: "5:31 AM" },
  { label: "Sunrise", time: "7:48 AM" },
  { label: "Dhuhr", time: "12:18 PM" },
  { label: "Asr", time: "3:42 PM" },
  { label: "Maghrib", time: "6:02 PM" },
  { label: "Isha", time: "7:29 PM" },
];

describe("PrayerArc live vs static", () => {
  it("shows the live label by default", () => {
    const { getByText } = render(
      <PrayerArc loading={false} prayerTimes={TIMES as any} nextPrayer={{ label: "Asr", time: "3:42 PM" }} />,
    );
    expect(getByText("TODAY'S PRAYERS")).toBeTruthy();
  });

  it("shows the static label and no next highlight when live=false", () => {
    const { getByText, queryByText } = render(
      <PrayerArc loading={false} prayerTimes={TIMES as any} nextPrayer={null} live={false} />,
    );
    expect(getByText("PRAYER TIMES")).toBeTruthy();
    expect(queryByText("TODAY'S PRAYERS")).toBeNull();
  });
});

describe("PrayerArc contract", () => {
  it("renders all six prayers with their (period-stripped) times", () => {
    const { getByText } = render(
      <PrayerArc
        loading={false}
        prayerTimes={FULL}
        nextPrayer={{ label: "Maghrib", time: "6:00 PM" }}
        now={NOW}
      />,
    );

    ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach((label) =>
      expect(getByText(label)).toBeTruthy(),
    );
    expect(getByText("6:00")).toBeTruthy();
  });

  it("marks live progress with a thumb instead of a sun/moon glyph", () => {
    const { getByTestId, UNSAFE_queryAllByProps } = render(
      <PrayerArc
        loading={false}
        prayerTimes={FULL}
        nextPrayer={{ label: "Maghrib", time: "6:00 PM" }}
        now={NOW}
      />,
    );
    expect(getByTestId("arc-thumb")).toBeTruthy();
    expect(UNSAFE_queryAllByProps({ name: "sunny" })).toHaveLength(0);
    expect(UNSAFE_queryAllByProps({ name: "moon" })).toHaveLength(0);
  });

  it("draws the full grey arc again after switching from a live day to a static one", () => {
    const { rerender, UNSAFE_getAllByProps } = render(
      <PrayerArc
        loading={false}
        prayerTimes={FULL}
        nextPrayer={{ label: "Maghrib", time: "6:00 PM" }}
        now={NOW}
      />,
    );
    // The svg mock yields a composite and a host node per Path, so count "some".
    const dashedBase = UNSAFE_getAllByProps({ strokeWidth: 2 }).filter(
      (n) => typeof n.props.strokeDasharray === "string" && n.props.strokeDasharray.startsWith("0 "),
    );
    expect(dashedBase.length).toBeGreaterThan(0);

    rerender(
      <PrayerArc loading={false} prayerTimes={FULL} nextPrayer={null} live={false} now={NOW} />,
    );
    const base = UNSAFE_getAllByProps({ strokeWidth: 2 }).filter((n) => n.props.d === ARC_PATH_D);
    expect(base.length).toBeGreaterThan(0);
    base.forEach((n) => expect(n.props.strokeDasharray).toBeUndefined());
  });

  it("shows no thumb for a static (non-today) timeline or while loading", () => {
    const stat = render(
      <PrayerArc loading={false} prayerTimes={FULL} nextPrayer={null} live={false} now={NOW} />,
    );
    expect(stat.queryByTestId("arc-thumb")).toBeNull();

    const loading = render(<PrayerArc loading prayerTimes={FULL} nextPrayer={null} now={NOW} />);
    expect(loading.queryByTestId("arc-thumb")).toBeNull();
  });

  it("renders a loading state with placeholder times and no crash", () => {
    const { queryByText, getByText } = render(
      <PrayerArc loading prayerTimes={[]} nextPrayer={null} now={NOW} />,
    );

    expect(getByText("Fajr")).toBeTruthy();
    expect(queryByText("6:00")).toBeNull();
  });
});
