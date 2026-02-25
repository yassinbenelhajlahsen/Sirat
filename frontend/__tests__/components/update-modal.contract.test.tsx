import { fireEvent, render } from "@testing-library/react-native";
import { Modal } from "react-native";

import UpdateModal from "@/components/UpdateModal";
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

describe("UpdateModal contract", () => {
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

    const { queryByText } = render(
      <UpdateModal
        visible
        isRestarting={false}
        onLater={jest.fn()}
        onRestart={jest.fn()}
      />
    );

    expect(mockUseModalTransition).toHaveBeenCalledWith(true);
    expect(queryByText("Update Ready")).toBeNull();
  });

  it("renders content and wires Later/Restart callbacks", () => {
    const onLater = jest.fn();
    const onRestart = jest.fn();
    const { UNSAFE_getByType, getByText } = render(
      <UpdateModal
        visible
        isRestarting={false}
        onLater={onLater}
        onRestart={onRestart}
      />
    );

    expect(getByText("Update Ready")).toBeTruthy();
    expect(
      getByText(
        "A new version has finished downloading. Restart now to apply it."
      )
    ).toBeTruthy();

    fireEvent.press(getByText("Later"));
    fireEvent.press(getByText("Restart"));
    fireEvent(UNSAFE_getByType(Modal), "onRequestClose");

    expect(onLater).toHaveBeenCalledTimes(2);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("shows restarting label and disables restart action while restarting", () => {
    const onRestart = jest.fn();
    const { getByText, queryByText } = render(
      <UpdateModal
        visible
        isRestarting
        onLater={jest.fn()}
        onRestart={onRestart}
      />
    );

    expect(queryByText("Restart")).toBeNull();

    fireEvent.press(getByText("Restarting..."));
    expect(onRestart).not.toHaveBeenCalled();
  });
});
