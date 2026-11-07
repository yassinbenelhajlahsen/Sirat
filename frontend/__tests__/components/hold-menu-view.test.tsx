import { render } from "@testing-library/react-native";
import { Text, View } from "react-native";

// The global setup mocks this wrapper; here the real one runs against a mocked expo probe.
jest.unmock("@/components/chat/HoldMenuView");

const mockNative = jest.fn((props: any) => <View testID="native-menu" {...props} />);
const mockProbe = jest.fn();
jest.mock("expo", () => ({
  requireOptionalNativeModule: (name: string) => mockProbe(name),
  requireNativeView: () => mockNative,
}));

const load = () => {
  let HoldMenuView: typeof import("@/components/chat/HoldMenuView").default;
  jest.isolateModules(() => {
    HoldMenuView = require("@/components/chat/HoldMenuView").default;
  });
  return HoldMenuView!;
};
const handlers = { canReport: true, onCopy: jest.fn(), onReport: jest.fn() };

describe("HoldMenuView", () => {
  it("renders the children in a plain View when the native module is absent (Android, older builds)", () => {
    mockProbe.mockReturnValue(null);
    const HoldMenuView = load();
    const { getByText, queryByTestId, getByTestId } = render(
      <HoldMenuView testID="menu" {...handlers}>
        <Text>Answer</Text>
      </HoldMenuView>,
    );

    expect(mockProbe).toHaveBeenCalledWith("SiratContextMenu");
    expect(getByText("Answer")).toBeTruthy();
    expect(queryByTestId("native-menu")).toBeNull();
    expect(getByTestId("menu").props.onCopy).toBeUndefined();
  });

  it("hands the children and menu props to the native view when the module is present", () => {
    mockProbe.mockReturnValue({});
    const HoldMenuView = load();
    const { getByText, getByTestId } = render(
      <HoldMenuView {...handlers}>
        <Text>Answer</Text>
      </HoldMenuView>,
    );

    expect(getByText("Answer")).toBeTruthy();
    expect(getByTestId("native-menu").props).toMatchObject(handlers);
  });
});
