import { BlurView } from "expo-blur";
import { ReactNode } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";

import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Tier = "chrome" | "card" | "row";

type GlassSurfaceProps = ViewProps & {
  tier?: Tier;
  radius?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function GlassSurface({
  tier = "card",
  radius,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const m = theme.materials[tier];
  const r = radius ?? theme.radii.card;

  const useGlass = Platform.OS === "ios" && isGlassEffectAPIAvailable();

  const shared: ViewStyle = {
    borderRadius: r,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: m.border,
    overflow: "hidden",
  };

  if (useGlass) {
    return (
      <GlassView
        glassEffectStyle={tier === "chrome" ? "clear" : "regular"}
        style={[shared, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  const blurIntensity = tier === "chrome" ? 55 : 40;
  const blurTint = theme.name === "light" ? "light" : "dark";
  // withOpacity needs a hex; m.solid is already an rgba string. Use the surface
  // hex so the contrast tint actually renders (it carries legibility when blur
  // is a no-op, e.g. older Android).
  const surfaceHex =
    theme.name === "light" ? theme.colors.primaryLift : theme.colors.primarySurface;
  const tintAlpha = tier === "chrome" ? 0.45 : tier === "card" ? 0.38 : 0.3;

  return (
    <BlurView
      tint={blurTint}
      intensity={blurIntensity}
      experimentalBlurMethod="dimezisBlurView"
      style={[shared, style]}
      {...rest}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: withOpacity(surfaceHex, tintAlpha) }]}
      />
      {children}
    </BlurView>
  );
}
