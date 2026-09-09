import { render } from "@testing-library/react-native";
import { StyleProp, StyleSheet, Text, ViewStyle } from "react-native";

import PressableScale from "@/components/PressableScale";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("PressableScale variants", () => {
  it("does not transform rows", () => {
    const { getByTestId } = render(
      wrap(
        <PressableScale variant="row" testID="row">
          <Text>row</Text>
        </PressableScale>,
      ),
    );
    expect(StyleSheet.flatten(getByTestId("row").props.style).transform).toBeUndefined();
  });

  // The row highlight is an absolute overlay on the pressable, so when the
  // rounded surface is a child it can only learn its corners from `radius`.
  it("rounds the row highlight from the radius prop", () => {
    const { getByTestId } = render(
      wrap(
        <PressableScale variant="row" radius={16} testID="row">
          <Text>row</Text>
        </PressableScale>,
      ),
    );

    const overlay = getByTestId("row").children[0] as { props: { style: StyleProp<ViewStyle> } };
    expect(StyleSheet.flatten(overlay.props.style).borderRadius).toBe(16);
  });

  it("falls back to the pressable's own radius for the row highlight", () => {
    const { getByTestId } = render(
      wrap(
        <PressableScale variant="row" style={{ borderRadius: 24 }} testID="row">
          <Text>row</Text>
        </PressableScale>,
      ),
    );

    const overlay = getByTestId("row").children[0] as { props: { style: StyleProp<ViewStyle> } };
    expect(StyleSheet.flatten(overlay.props.style).borderRadius).toBe(24);
  });

  it("scales buttons and cards", () => {
    const { getByTestId } = render(
      wrap(
        <>
          <PressableScale variant="button" testID="button">
            <Text>button</Text>
          </PressableScale>
          <PressableScale testID="card">
            <Text>card</Text>
          </PressableScale>
        </>,
      ),
    );
    expect(StyleSheet.flatten(getByTestId("button").props.style).transform).toBeDefined();
    expect(StyleSheet.flatten(getByTestId("card").props.style).transform).toBeDefined();
  });
});
