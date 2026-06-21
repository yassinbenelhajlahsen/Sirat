import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock("@/components/ui/GlassSurface", () => {
  const { View } = require("react-native");
  return ({ children, style }: { children: React.ReactNode; style?: object }) => (
    <View style={style}>{children}</View>
  );
});
jest.mock("@/components/ui/Text", () => {
  const { Text } = require("react-native");
  return {
    Body: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Caption: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

import SignInCard from "@/components/home/SignInCard";

describe("SignInCard", () => {
  it("renders the title text", () => {
    const { getByText } = render(
      <SignInCard onPress={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(getByText("Sign in to sync")).toBeTruthy();
  });

  it("calls onPress when the card is pressed", () => {
    const onPress = jest.fn();
    const onDismiss = jest.fn();
    const { getByRole } = render(
      <SignInCard onPress={onPress} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByRole("button", { name: "Sign in to sync" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("calls onDismiss when the dismiss button is pressed, not onPress", () => {
    const onPress = jest.fn();
    const onDismiss = jest.fn();
    const { getByLabelText } = render(
      <SignInCard onPress={onPress} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
