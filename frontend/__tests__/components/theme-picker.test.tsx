// frontend/__tests__/components/theme-picker.test.tsx
import { fireEvent, render } from "@testing-library/react-native";

const mockHaptic = jest.fn();
const mockSetTheme = jest.fn();

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({
      theme: defaultTheme,
      themeName: "default",
      setTheme: mockSetTheme,
    }),
  };
});
jest.mock("@/hooks/useHaptics", () => ({ useHaptics: () => mockHaptic }));
jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

import ThemePicker from "@/components/settings/ThemePicker";

describe("ThemePicker", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the three themes", () => {
    const { getByLabelText } = render(<ThemePicker />);
    expect(getByLabelText("Default theme")).toBeTruthy();
    expect(getByLabelText("Dark theme")).toBeTruthy();
    expect(getByLabelText("Light theme")).toBeTruthy();
  });

  it("selecting a non-active theme calls setTheme with a haptic", () => {
    const { getByLabelText } = render(<ThemePicker />);
    fireEvent.press(getByLabelText("Dark theme"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(mockHaptic).toHaveBeenCalledWith("selection");
  });

  it("re-selecting the active theme is a no-op", () => {
    const { getByLabelText } = render(<ThemePicker />);
    fireEvent.press(getByLabelText("Default theme"));
    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it("marks the active theme via accessibility state", () => {
    const { getByLabelText } = render(<ThemePicker />);
    expect(getByLabelText("Default theme").props.accessibilityState.selected).toBe(true);
    expect(getByLabelText("Dark theme").props.accessibilityState.selected).toBe(false);
  });
});
