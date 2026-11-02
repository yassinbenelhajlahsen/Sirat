import { ReactNode } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { useTheme } from "@/context/ThemeContext";

type Tier = "chrome" | "card" | "row";

type GlassSurfaceProps = ViewProps & {
  tier?: Tier;
  radius?: number;
  // Full-capsule surfaces (radius >= height/2) need "circular": the continuous
  // squircle curve degrades at clamped pill radii and renders an uneven border.
  curve?: ViewStyle["borderCurve"];
  // iOS 26 Liquid Glass draws its own specular rim, so nothing draws a border
  // on top of it by default. The non-glass fallback keeps a hairline for
  // definition. Pass `bordered` explicitly to force (or drop) the drawn edge.
  bordered?: boolean;
  // Tints the Liquid Glass so it stays legible over busy content such as a map.
  tint?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function GlassSurface({
  tier = "card",
  radius,
  curve = "continuous",
  bordered,
  tint,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const m = theme.materials[tier];
  const r = radius ?? theme.radii.card;

  // Only floating chrome (tab bar, round buttons, toasts, mini player) is Liquid
  // Glass; cards and rows are a solid surface so neighbouring ones always match.
  // Chrome is always "clear": the frosted "regular" material reads as a grey panel
  // on the light theme's cream canvas.
  const useGlass = tier === "chrome" && Platform.OS === "ios" && isLiquidGlassAvailable();
  const isLight = theme.name === "light";

  const shared: ViewStyle = {
    borderRadius: r,
    borderCurve: curve,
    borderColor: m.border,
    overflow: "hidden",
  };

  if (useGlass) {
    return (
      <GlassView
        key={theme.name}
        glassEffectStyle="clear"
        tintColor={tint}
        colorScheme={isLight ? "light" : "dark"}
        style={[shared, { borderWidth: bordered ? 1 : 0 }, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        shared,
        { borderWidth: bordered ? 1 : StyleSheet.hairlineWidth },
        { backgroundColor: tier === "chrome" ? m.fill : m.solid },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
