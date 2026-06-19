import { fireEvent, render } from "@testing-library/react-native";

import QuranDisplaySettingsModal from "@/components/quran/QuranDisplaySettingsModal";
import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }: any) => <>{children}</>,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
  };
});

jest.mock("@/components/PressableScale", () => {
  const { Pressable } = require("react-native");
  return ({ children, ...props }: any) => (
    <Pressable {...props}>
      {children}
    </Pressable>
  );
});

jest.mock("@/hooks/useQuranDisplayModes", () => ({
  useQuranDisplayModes: jest.fn(),
}));

const mockUseQuranDisplayModes = useQuranDisplayModes as jest.MockedFunction<
  typeof useQuranDisplayModes
>;

describe("QuranDisplaySettingsModal contract", () => {
  it("returns null when visible is false", () => {
    mockUseQuranDisplayModes.mockReturnValue({
      displayModes: ["arabic", "english"],
      isModeEnabled: (mode: string) => mode === "arabic" || mode === "english",
      toggleDisplayMode: jest.fn(),
    } as any);

    const { queryByText } = render(
      <QuranDisplaySettingsModal visible={false} onClose={jest.fn()} />
    );

    expect(queryByText("Display Text")).toBeNull();
  });

  it("renders display options, exposes checkbox contract, and wires toggles/close", () => {
    const toggleDisplayMode = jest.fn(async () => ["arabic", "english"]);
    const onClose = jest.fn();
    mockUseQuranDisplayModes.mockReturnValue({
      displayModes: ["arabic", "english"],
      isModeEnabled: (mode: string) => mode === "arabic" || mode === "english",
      toggleDisplayMode,
    } as any);

    const { getAllByRole, getByText, getByAccessibilityHint } = render(
      <QuranDisplaySettingsModal visible onClose={onClose} />
    );

    expect(getByText("Display Text")).toBeTruthy();
    expect(getByText("Select which text to show")).toBeTruthy();
    expect(getByText("Arabic")).toBeTruthy();
    expect(getByText("English")).toBeTruthy();
    expect(getByText("Transliteration")).toBeTruthy();

    const modeRows = getAllByRole("checkbox");
    expect(modeRows).toHaveLength(3);
    expect(modeRows[0].props.accessibilityState).toEqual({
      checked: true,
      disabled: false,
    });
    expect(modeRows[1].props.accessibilityState).toEqual({
      checked: true,
      disabled: false,
    });
    expect(modeRows[2].props.accessibilityState).toEqual({
      checked: false,
      disabled: false,
    });

    fireEvent.press(getByText("Transliteration"));

    expect(toggleDisplayMode).toHaveBeenCalledWith("transliteration");

    const dismissButton = getAllByRole("button")[0];
    fireEvent.press(dismissButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("prevents toggling the last enabled mode while allowing other toggles", () => {
    const toggleDisplayMode = jest.fn(async () => ["arabic"]);
    mockUseQuranDisplayModes.mockReturnValue({
      displayModes: ["arabic"],
      isModeEnabled: (mode: string) => mode === "arabic",
      toggleDisplayMode,
    } as any);

    const { getAllByRole, getByText } = render(
      <QuranDisplaySettingsModal visible onClose={jest.fn()} />
    );

    const modeRows = getAllByRole("checkbox");
    expect(modeRows[0].props.accessibilityState).toEqual({
      checked: true,
      disabled: true,
    });

    fireEvent.press(getByText("Arabic"));
    expect(toggleDisplayMode).not.toHaveBeenCalled();

    fireEvent.press(getByText("English"));
    expect(toggleDisplayMode).toHaveBeenCalledWith("english");
  });
});
