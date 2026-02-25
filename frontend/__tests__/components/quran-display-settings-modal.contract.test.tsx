import { fireEvent, render } from "@testing-library/react-native";
import { Modal } from "react-native";

import QuranDisplaySettingsModal from "@/components/quran/QuranDisplaySettingsModal";
import useModalTransition from "@/hooks/useModalTransition";
import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
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

jest.mock("@/hooks/useModalTransition", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/hooks/useQuranDisplayModes", () => ({
  useQuranDisplayModes: jest.fn(),
}));

const mockUseModalTransition = useModalTransition as jest.MockedFunction<
  typeof useModalTransition
>;
const mockUseQuranDisplayModes = useQuranDisplayModes as jest.MockedFunction<
  typeof useQuranDisplayModes
>;

describe("QuranDisplaySettingsModal contract", () => {
  beforeEach(() => {
    mockUseModalTransition.mockReturnValue({
      shouldRender: true,
      overlayAnimatedStyle: {},
      cardAnimatedStyle: {},
    } as any);
  });

  it("returns null when transition keeps the modal hidden", () => {
    mockUseModalTransition.mockReturnValue({
      shouldRender: false,
      overlayAnimatedStyle: {},
      cardAnimatedStyle: {},
    } as any);
    mockUseQuranDisplayModes.mockReturnValue({
      displayModes: ["arabic", "english"],
      isModeEnabled: (mode: string) => mode === "arabic" || mode === "english",
      toggleDisplayMode: jest.fn(),
    } as any);

    const { queryByText } = render(
      <QuranDisplaySettingsModal visible onClose={jest.fn()} />
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

    const { UNSAFE_getByType, getAllByRole, getByText } = render(
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
    fireEvent(UNSAFE_getByType(Modal), "onRequestClose");

    expect(toggleDisplayMode).toHaveBeenCalledWith("transliteration");
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
