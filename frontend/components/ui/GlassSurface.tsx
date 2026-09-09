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
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function GlassSurface({
  tier = "card",
  radius,
  curve = "continuous",
  bordered,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const m = theme.materials[tier];
  const r = radius ?? theme.radii.card;

  const useGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
  // The light theme's cream canvas makes the frosted "regular" material read as a
  // grey panel, so the light theme uses the more transparent "clear" glass.
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
        glassEffectStyle={tier === "chrome" || isLight ? "clear" : "regular"}
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
        { backgroundColor: m.fill },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
