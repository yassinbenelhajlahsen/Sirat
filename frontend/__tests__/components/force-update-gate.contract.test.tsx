import { fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import ForceUpdateGate from "@/components/ForceUpdateGate";
import useModalTransition from "@/hooks/useModalTransition";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
  };
});

jest.mock("@/hooks/useModalTransition", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseModalTransition = useModalTransition as jest.MockedFunction<
  typeof useModalTransition
>;

const defaultProps = {
  visible: true,
  minVersion: "1.0.10",
  currentVersion: "1.0.8",
};

describe("ForceUpdateGate contract", () => {
  beforeEach(() => {
    mockUseModalTransition.mockReturnValue({
      shouldRender: true,
      overlayAnimatedStyle: {},
      cardAnimatedStyle: {},
    } as any);
    jest.clearAllMocks();
  });

  it("returns null when transition keeps it hidden", () => {
    mockUseModalTransition.mockReturnValue({
      shouldRender: false,
      overlayAnimatedStyle: {},
      cardAnimatedStyle: {},
    } as any);

    const { queryByText } = render(<ForceUpdateGate {...defaultProps} />);
    expect(queryByText("Update Required")).toBeNull();
  });

  it("renders title and description when visible", () => {
    const { getByText } = render(<ForceUpdateGate {...defaultProps} />);
    expect(getByText("Update Required")).toBeTruthy();
    expect(
      getByText(/This version of the app is no longer supported/),
    ).toBeTruthy();
  });

  it("shows version info when currentVersion is provided", () => {
    const { getByText } = render(<ForceUpdateGate {...defaultProps} />);
    expect(getByText(/1\.0\.8/)).toBeTruthy();
    expect(getByText(/1\.0\.10/)).toBeTruthy();
  });

  it("renders Update Now button that opens the App Store", () => {
    const openURLSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined);
    const { getByText } = render(<ForceUpdateGate {...defaultProps} />);

    fireEvent.press(getByText("Update Now"));

    expect(openURLSpy).toHaveBeenCalledWith(
      "https://apps.apple.com/us/app/sirat-the-path-to-your-deen/id6753838183",
    );
  });

  it("has no Later, Dismiss, or Close button", () => {
    const { queryByText } = render(<ForceUpdateGate {...defaultProps} />);
    expect(queryByText("Later")).toBeNull();
    expect(queryByText("Dismiss")).toBeNull();
    expect(queryByText("Close")).toBeNull();
  });
});
