import { fireEvent, render } from "@testing-library/react-native";

import Segmented from "@/components/ui/Segmented";

const OPTIONS = [
  { value: "a", label: "Five" },
  { value: "b", label: "Fifteen" },
  { value: "c", label: "Thirty" },
];

describe("Segmented (iOS native control)", () => {
  it("exposes a radiogroup with the current value selected", () => {
    const { getByLabelText, getAllByRole } = render(
      <Segmented options={OPTIONS} value="b" onChange={jest.fn()} accessibilityLabel="Offset" />,
    );
    expect(getByLabelText("Offset").props.accessibilityRole).toBe("radiogroup");
    expect(getAllByRole("radio").map((r) => r.props.accessibilityState.selected)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("reports the chosen option's value", () => {
    const onChange = jest.fn();
    const { getByRole } = render(<Segmented options={OPTIONS} value="a" onChange={onChange} />);
    fireEvent.press(getByRole("radio", { name: "Thirty" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });
});
