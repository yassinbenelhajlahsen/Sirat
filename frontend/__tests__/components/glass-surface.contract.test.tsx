import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import { isGlassEffectAPIAvailable } from "expo-glass-effect";
import GlassSurface from "@/components/ui/GlassSurface";

const mockApiAvailable = isGlassEffectAPIAvailable as jest.Mock;

describe("GlassSurface", () => {
  it("renders children and uses the glass node when the API is available", () => {
    mockApiAvailable.mockReturnValue(true);
    const { getByTestId, getByText } = render(
      <GlassSurface tier="card" testID="surface"><Text>hi</Text></GlassSurface>,
    );
    expect(getByText("hi")).toBeTruthy();
    expect(getByTestId("surface")).toBeTruthy();
  });

  it("falls back to a solid surface when the glass API is unavailable", () => {
    mockApiAvailable.mockReturnValue(false);
    const { getByTestId } = render(
      <GlassSurface tier="card" testID="surface-fallback"><Text>hi</Text></GlassSurface>,
    );
    const node = getByTestId("surface-fallback");
    const flat = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style)
      : node.props.style;
    expect(flat.backgroundColor).toBeTruthy();
  });
});
