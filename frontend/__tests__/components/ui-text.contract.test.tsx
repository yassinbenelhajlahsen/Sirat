import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import { LargeTitle, Body, Caption, TEXT_MAX_FONT_SCALE } from "@/components/ui/Text";

describe("typed Text", () => {
  it("renders content and applies the ramp font size", () => {
    const { getByText } = render(<LargeTitle>Hello</LargeTitle>);
    const node = getByText("Hello");
    const flat = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.flat())
      : node.props.style;
    expect(flat.fontSize).toBe(34);
  });
  it("renders Body and Caption", () => {
    const { getByText } = render(<><Body>b</Body><Caption>c</Caption></>);
    expect(getByText("b")).toBeTruthy();
    expect(getByText("c")).toBeTruthy();
  });
  it("supports Dynamic Type with a capped multiplier", () => {
    const { getByText } = render(<Body>scaled</Body>);
    const node = getByText("scaled");
    expect(node.props.allowFontScaling).not.toBe(false);
    expect(node.props.maxFontSizeMultiplier).toBe(TEXT_MAX_FONT_SCALE);
  });
  it("lets a caller tighten the multiplier", () => {
    const { getByText } = render(<Caption maxFontSizeMultiplier={1.2}>tight</Caption>);
    expect(getByText("tight").props.maxFontSizeMultiplier).toBe(1.2);
  });
});
