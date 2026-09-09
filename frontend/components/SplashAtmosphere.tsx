import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, View } from "react-native";

import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

// Exported so a test can pin how far this is allowed to go. The in-app Aurora
// is deliberately faint because content has to stay readable on top of it; the
// splash has no content to protect, so it can carry a real atmosphere — and it
// is the only screen in the app that can.
export const HORIZON_OPACITY = 0.16;
export const GRAIN_OPACITY = 0.035;

/** How much of the screen the horizon glow rises through. */
const HORIZON_HEIGHT = "58%";

/**
 * Splash-only atmosphere, layered over the base gradient and above `Aurora`:
 * a warm glow rising off the bottom edge, and a grain overlay to stop the
 * gradient reading as flat vector fill. Absolute-fill and non-interactive.
 */
export default function SplashAtmosphere() {
  const { colors } = useTheme().theme;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={["transparent", withOpacity(colors.accent, HORIZON_OPACITY)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.horizon}
      />
      <Image
        source={require("../assets/images/noise.png")}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { opacity: GRAIN_OPACITY }]}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  horizon: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: HORIZON_HEIGHT,
  },
});
