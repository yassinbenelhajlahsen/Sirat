import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import DisplayNumber, { DISPLAY_FONT_FAMILY } from "@/components/ui/DisplayNumber";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("DisplayNumber", () => {
  it("renders the value with the Fraunces family, size and tabular figures", () => {
    const { getByText } = render(wrap(<DisplayNumber value={12} size={40} />));
    const node = getByText("12");
    const flat = StyleSheet.flatten(node.props.style);
    expect(flat.fontFamily).toBe(DISPLAY_FONT_FAMILY);
    expect(flat.fontSize).toBe(40);
    expect(flat.fontVariant).toEqual(["tabular-nums"]);
  });
});
