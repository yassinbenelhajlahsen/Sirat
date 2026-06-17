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
  const tintBase = m.solid;

  return (
    <BlurView
      tint={blurTint}
      intensity={blurIntensity}
      style={[shared, style]}
      {...rest}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: withOpacity(tintBase, 0.15) }]}
      />
      {children}
    </BlurView>
  );
}
