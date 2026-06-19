import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "@/context/ThemeContext";

/**
 * Ambient aurora background — soft accent + secondary light blooms plus a faint
 * core, themed per palette. Replaces the old full-screen repeating gold motif.
 * Absolute-fill and non-interactive: drop it behind screen content, above the
 * base gradient.
 */
export default function Aurora() {
  const { aurora } = useTheme().theme;
  // Unique gradient ids per instance so two Auroras can't reference each other.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const accentId = `auroraAccent${uid}`;
  const secondaryId = `auroraSecondary${uid}`;
  const coreId = `auroraCore${uid}`;

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={accentId} cx="0.82" cy="0.08" r="0.62">
          <Stop offset="0" stopColor={aurora.accent} stopOpacity={0.3} />
          <Stop offset="1" stopColor={aurora.accent} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={secondaryId} cx="0.12" cy="0.9" r="0.66">
          <Stop offset="0" stopColor={aurora.secondary} stopOpacity={0.24} />
          <Stop offset="1" stopColor={aurora.secondary} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={coreId} cx="0.5" cy="0.4" r="0.7">
          <Stop offset="0" stopColor={aurora.core} stopOpacity={0.05} />
          <Stop offset="1" stopColor={aurora.core} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${accentId})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${secondaryId})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${coreId})`} />
    </Svg>
  );
}
