import { ReactNode } from "react";
import { Platform, StyleProp, View, ViewProps, ViewStyle } from "react-native";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";

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

  return (
    <View style={[shared, { backgroundColor: m.solid }, style]} {...rest}>
      {children}
    </View>
  );
}
