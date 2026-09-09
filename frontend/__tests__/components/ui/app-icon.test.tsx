import { Platform } from "react-native";
import { render } from "@testing-library/react-native";

import AppIcon, { IONICON_TO_SF, type AppIconName } from "@/components/ui/AppIcon";

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`ionicon:${name}`}</Text> };
});

jest.mock("expo-symbols", () => {
  const { Text } = require("react-native");
  return { SymbolView: ({ name }: { name: string }) => <Text>{`symbol:${name}`}</Text> };
});

const mapped = Object.entries(IONICON_TO_SF) as [AppIconName, string][];

describe("AppIcon", () => {
  afterEach(() => {
    Platform.OS = "ios";
  });

  it.each(mapped)("renders the SF Symbol for %s on iOS", (name, symbol) => {
    Platform.OS = "ios";
    const { getByText } = render(<AppIcon name={name} />);
    expect(getByText(`symbol:${symbol}`)).toBeTruthy();
  });

  it.each(mapped)("falls back to the Ionicon for %s on Android", (name) => {
    Platform.OS = "android";
    const { getByText } = render(<AppIcon name={name} />);
    expect(getByText(`ionicon:${name}`)).toBeTruthy();
  });

  it("renders the Ionicon on both platforms when the name is unmapped", () => {
    Platform.OS = "ios";
    expect(render(<AppIcon name="flask-outline" />).getByText("ionicon:flask-outline")).toBeTruthy();
    Platform.OS = "android";
    expect(render(<AppIcon name="flask-outline" />).getByText("ionicon:flask-outline")).toBeTruthy();
  });
});
