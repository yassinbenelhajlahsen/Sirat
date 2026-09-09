import { render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

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
