import { ReactNode } from "react";
import { Platform, StyleProp, View, ViewProps, ViewStyle } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

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

  const useGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
  // The light theme's cream canvas makes the frosted "regular" material read as a
  // grey panel, so the light theme uses the more transparent "clear" glass.
  const isLight = theme.name === "light";

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
        key={theme.name}
        glassEffectStyle={tier === "chrome" || isLight ? "clear" : "regular"}
        colorScheme={isLight ? "light" : "dark"}
        style={[shared, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[shared, { backgroundColor: m.fill }, style]} {...rest}>
      {children}
    </View>
  );
}
