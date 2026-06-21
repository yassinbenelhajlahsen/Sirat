import { render, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const mockUseAuthState = jest.fn();
jest.mock("@/hooks/useAuthState", () => ({ useAuthState: () => mockUseAuthState() }));
jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});
jest.mock("@/hooks/useHaptics", () => ({ useHaptics: () => jest.fn() }));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { AccountSection } from "@/components/settings/AccountSection";

describe("AccountSection", () => {
  const handlers = { onSignIn: jest.fn(), onSignOut: jest.fn(), onDeleteAccount: jest.fn() };
  beforeEach(() => {
    mockUseAuthState.mockReset();
    Object.values(handlers).forEach((h) => h.mockReset());
  });

  it("shows a sign-in row when signed out", () => {
    mockUseAuthState.mockReturnValue({ isLoaded: true, isSignedIn: false, userId: null, email: null });
    const { getByText, queryByText } = render(<AccountSection {...handlers} />);
    fireEvent.press(getByText("Sign in"));
    expect(handlers.onSignIn).toHaveBeenCalledTimes(1);
    expect(queryByText("Sign out")).toBeNull();
  });

  it("shows email, sign out, and delete when signed in", () => {
    mockUseAuthState.mockReturnValue({ isLoaded: true, isSignedIn: true, userId: "u1", email: "a@b.com" });
    const { getByText } = render(<AccountSection {...handlers} />);
    expect(getByText("a@b.com")).toBeTruthy();
    fireEvent.press(getByText("Sign out"));
    expect(handlers.onSignOut).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText("Delete account"));
    expect(handlers.onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("renders the Delete account title in the danger color", () => {
    mockUseAuthState.mockReturnValue({ isLoaded: true, isSignedIn: true, userId: "u1", email: null });
    const { getByText } = render(<AccountSection {...handlers} />);
    const titleEl = getByText("Delete account");
    const flatStyle = StyleSheet.flatten(titleEl.props.style);
    expect(flatStyle.color).toBe("#ff7070");
  });
});
