import React from "react";
import { StyleSheet, Text } from "react-native";
import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = require("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import { isLiquidGlassAvailable } from "expo-glass-effect";
import GlassSurface from "@/components/ui/GlassSurface";
import { defaultTheme } from "@/constants/theme";

const mockApiAvailable = isLiquidGlassAvailable as jest.Mock;

describe("GlassSurface", () => {
  it("renders children and uses the glass node for chrome when the API is available", () => {
    mockApiAvailable.mockReturnValue(true);
    const { getByTestId, getByText } = render(
      <GlassSurface tier="chrome" testID="surface"><Text>hi</Text></GlassSurface>,
    );
    expect(getByText("hi")).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId("surface").props.style).backgroundColor).toBeUndefined();
  });

  it("paints cards and rows the same solid color even when glass is available", () => {
    mockApiAvailable.mockReturnValue(true);
    const { getByTestId } = render(
      <>
        <GlassSurface tier="card" testID="card"><Text>a</Text></GlassSurface>
        <GlassSurface tier="row" testID="row"><Text>b</Text></GlassSurface>
      </>,
    );
    const solid = defaultTheme.materials.card.solid;
    expect(StyleSheet.flatten(getByTestId("card").props.style).backgroundColor).toBe(solid);
    expect(StyleSheet.flatten(getByTestId("row").props.style).backgroundColor).toBe(solid);
  });

  it("leaves the rim to the glass unless a border is asked for", () => {
    mockApiAvailable.mockReturnValue(true);
    const { getByTestId, rerender } = render(
      <GlassSurface tier="chrome" testID="surface"><Text>hi</Text></GlassSurface>,
    );
    expect(StyleSheet.flatten(getByTestId("surface").props.style).borderWidth).toBe(0);
    rerender(
      <GlassSurface tier="chrome" bordered testID="surface"><Text>hi</Text></GlassSurface>,
    );
    expect(StyleSheet.flatten(getByTestId("surface").props.style).borderWidth).toBe(1);
  });

  it("keeps a hairline in the non-glass fallback", () => {
    mockApiAvailable.mockReturnValue(false);
    const { getByTestId } = render(
      <GlassSurface tier="card" testID="surface"><Text>hi</Text></GlassSurface>,
    );
    expect(StyleSheet.flatten(getByTestId("surface").props.style).borderWidth).toBe(
      StyleSheet.hairlineWidth,
    );
  });

  it("falls back to a frosted surface when the glass API is unavailable", () => {
    mockApiAvailable.mockReturnValue(false);
    const { getByTestId, getByText } = render(
      <GlassSurface tier="card" testID="surface-fallback"><Text>hi</Text></GlassSurface>,
    );
    // The fallback renders a BlurView (mocked as View) that wraps a tint overlay + children.
    expect(getByTestId("surface-fallback")).toBeTruthy();
    expect(getByText("hi")).toBeTruthy();
  });
});
