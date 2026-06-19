import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});

import SheetBackground from "@/components/ui/SheetBackground";

describe("SheetBackground", () => {
  it("renders without crashing given bottom-sheet background props", () => {
    const animatedIndex = { value: 1 } as any;
    const tree = render(
      <SheetBackground
        animatedIndex={animatedIndex}
        animatedPosition={{ value: 0 } as any}
        style={{}}
        testID="sheet-bg"
      />,
    );
    expect(tree.getByTestId("sheet-bg")).toBeTruthy();
  });
});
