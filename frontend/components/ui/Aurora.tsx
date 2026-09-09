import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "@/context/ThemeContext";

// Bloom opacities, exported so a test can pin the toned-down atmosphere.
export const AURORA_ACCENT_OPACITY = 0.13;
export const AURORA_SECONDARY_OPACITY = 0.12;

/**
 * Ambient aurora background — two soft corner blooms, themed per palette, kept
 * faint so the content grid reads before the atmosphere does.
 * Absolute-fill and non-interactive: drop it behind screen content, above the
 * base gradient.
 */
export default function Aurora() {
  const { aurora } = useTheme().theme;
  // Unique gradient ids per instance so two Auroras can't reference each other.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const accentId = `auroraAccent${uid}`;
  const secondaryId = `auroraSecondary${uid}`;

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={accentId} cx="0.85" cy="0.0" r="0.62">
          <Stop offset="0" stopColor={aurora.accent} stopOpacity={AURORA_ACCENT_OPACITY} />
          <Stop offset="1" stopColor={aurora.accent} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={secondaryId} cx="0.10" cy="1.0" r="0.66">
          <Stop offset="0" stopColor={aurora.secondary} stopOpacity={AURORA_SECONDARY_OPACITY} />
          <Stop offset="1" stopColor={aurora.secondary} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${accentId})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${secondaryId})`} />
    </Svg>
  );
}
