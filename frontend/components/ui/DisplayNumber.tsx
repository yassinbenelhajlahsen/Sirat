import { ReactNode } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

import { useTheme } from "@/context/ThemeContext";

type Props = {
  value: ReactNode;
  size: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Large stat numerals. The system face, tightened and set in tabular figures —
 * iOS uses SF for display numbers, and a serif reads as someone else's brand.
 */
export default function DisplayNumber({ value, size, color, style }: Props) {
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
        },
        style,
      ]}
    >
      {value}
    </Text>
  );
}
