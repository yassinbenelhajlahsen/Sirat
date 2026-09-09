import { ReactNode } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

import { useTheme } from "@/context/ThemeContext";

// Tabular figures pad every digit to a uniform advance, so a numeral carries
// side bearing that text does not. At display sizes that reads as an indent.
const OPTICAL_INSET_RATIO = 0.04;

type Props = {
  value: ReactNode;
  size: number;
  color?: string;
  /** Hang the glyph past the layout edge so it optically aligns with copy. */
  flush?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * Large stat numerals. The system face, tightened and set in tabular figures —
 * iOS uses SF for display numbers, and a serif reads as someone else's brand.
 */
export default function DisplayNumber({ value, size, color, flush = false, style }: Props) {
  const { theme } = useTheme();
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontSize: size,
          fontWeight: "700",
          letterSpacing: -size * 0.03,
          lineHeight: Math.round(size * 1.05),
          color: color ?? theme.colors.white,
          fontVariant: ["tabular-nums"],
          marginLeft: flush ? -Math.round(size * OPTICAL_INSET_RATIO) : undefined,
        },
        style,
      ]}
    >
      {value}
    </Text>
  );
}
