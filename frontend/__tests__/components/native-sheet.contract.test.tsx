import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import NativeSheet from "@/components/ui/NativeSheet";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

// Keep children mounted after dismissal starts, like the native sheet does
// while it slides away.
jest.mock("@expo/ui/swift-ui", () => {
  const { View } = require("react-native");
  const Passthrough = ({ children }: any) => <View>{children}</View>;
  return { Host: Passthrough, Group: Passthrough, RNHostView: Passthrough, BottomSheet: Passthrough };
});

describe("NativeSheet", () => {
  it("keeps the last title and content while closing", () => {
    const { getByText, rerender } = render(
      <NativeSheet visible onClose={jest.fn()} title="Log Fajr">
        <Text>Prayed</Text>
      </NativeSheet>,
    );
    expect(getByText("Log Fajr")).toBeTruthy();

    rerender(
      <NativeSheet visible={false} onClose={jest.fn()} title="Log">
        <Text>Nothing</Text>
      </NativeSheet>,
    );

    expect(getByText("Log Fajr")).toBeTruthy();
    expect(getByText("Prayed")).toBeTruthy();
  });
});
