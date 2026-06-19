import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import { LargeTitle, Body, Caption } from "@/components/ui/Text";

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
});
