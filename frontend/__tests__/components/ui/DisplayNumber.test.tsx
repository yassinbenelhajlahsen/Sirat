import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import DisplayNumber from "@/components/ui/DisplayNumber";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("DisplayNumber", () => {
  it("renders the value in the system face with tight, tabular figures", () => {
    const { getByText } = render(wrap(<DisplayNumber value={12} size={40} />));
    const flat = StyleSheet.flatten(getByText("12").props.style);
    expect(flat.fontFamily).toBeUndefined();
    expect(flat.fontSize).toBe(40);
    expect(flat.fontWeight).toBe("700");
    expect(flat.letterSpacing).toBeCloseTo(-1.2, 5);
    expect(flat.fontVariant).toEqual(["tabular-nums"]);
    expect(flat.marginLeft).toBeUndefined();
  });

  it("hangs the glyph left when flush, so it optically aligns with copy", () => {
    const { getByText } = render(wrap(<DisplayNumber value="5:42" size={72} flush />));
    expect(StyleSheet.flatten(getByText("5:42").props.style).marginLeft).toBe(-3);
  });
});
