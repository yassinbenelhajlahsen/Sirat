import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import Segmented from "@/components/ui/Segmented";
import { ThemeProvider } from "@/context/ThemeContext";

const OPTIONS = [
  { value: "a", label: "Five" },
  { value: "b", label: "Fifteen" },
  { value: "c", label: "Thirty" },
];

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Segmented", () => {
  it("is a radiogroup of radios with the current value selected", () => {
    const { getByLabelText, getAllByRole } = render(
      wrap(<Segmented options={OPTIONS} value="b" onChange={jest.fn()} accessibilityLabel="Offset" />),
    );
    expect(getByLabelText("Offset").props.accessibilityRole).toBe("radiogroup");
    const radios = getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.props.accessibilityState.selected)).toEqual([false, true, false]);
  });

  it("reports the pressed option's value", () => {
    const onChange = jest.fn();
    const { getByRole } = render(wrap(<Segmented options={OPTIONS} value="a" onChange={onChange} />));
    fireEvent.press(getByRole("radio", { name: "Thirty" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("positions the thumb over the selected index", () => {
    const { getByTestId } = render(
      wrap(<Segmented options={OPTIONS} value="c" onChange={jest.fn()} testID="seg" />),
    );
    fireEvent(getByTestId("seg"), "layout", { nativeEvent: { layout: { width: 302 } } });
    const thumb = StyleSheet.flatten(getByTestId("seg-thumb").props.style);
    // (302 - 2*2) / 3 = 99.33 per segment, index 2 starts at 2 + 2*99.33.
    expect(thumb.width).toBeCloseTo(99.333, 2);
    expect(thumb.left).toBeCloseTo(200.666, 2);
  });
});
