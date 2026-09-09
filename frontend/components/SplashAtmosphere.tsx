import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

// Exported so a test can pin how far this is allowed to go. The in-app Aurora
// is deliberately faint because content has to stay readable on top of it; the
// splash has no content to protect, so it can carry a real atmosphere — and it
// is the only screen in the app that can.
export const HORIZON_OPACITY = 0.18;
export const VIGNETTE_OPACITY = 0.22;

/** How much of the screen each layer rises or falls through. */
const HORIZON_HEIGHT = "58%";
const VIGNETTE_HEIGHT = "42%";

/**
 * Splash-only atmosphere, layered over the base gradient and above `Aurora`:
 * a warm glow rising off the bottom edge, and a deepening at the top that
 * gives the masthead a darker field to sit on. Absolute-fill, non-interactive.
 *
 * Both layers are gradients on purpose. Film grain would suit this better, but
 * there is no way to draw it here: `react-native-svg`'s `FeTurbulence` is a
 * stub that renders nothing, and `Image` with `resizeMode="repeat"` does not
 * tile under the New Architecture — it draws a single tile in the corner.
 */
export default function SplashAtmosphere() {
  const { colors } = useTheme().theme;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[withOpacity(colors.black, VIGNETTE_OPACITY), "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.vignette}
      />
      <LinearGradient
        colors={["transparent", withOpacity(colors.accent, HORIZON_OPACITY)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.horizon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  vignette: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: VIGNETTE_HEIGHT,
  },
  horizon: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: HORIZON_HEIGHT,
  },
});
