import Svg, { Rect } from "react-native-svg";

import { useTheme } from "@/context/ThemeContext";

/**
 * Flat Kaaba glyph: black cube, gold kiswah band, gold door. Replaces the 🕋
 * emoji, which rendered differently per OS and could not take theme colours.
 */
export default function KaabaMark({ size = 26 }: { size?: number }) {
  const { colors } = useTheme().theme;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image" accessibilityLabel="Kaaba">
      <Rect x="4" y="4" width="16" height="16" rx="1.6" fill={colors.black} />
      <Rect x="4" y="8.2" width="16" height="2.6" fill={colors.accent} />
      <Rect x="10.4" y="13.2" width="3.2" height="6.8" rx="0.7" fill={colors.accent} opacity={0.9} />
    </Svg>
  );
}
