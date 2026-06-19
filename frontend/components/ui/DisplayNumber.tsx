import { ReactNode } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

import { useTheme } from "@/context/ThemeContext";

export const DISPLAY_FONT_FAMILY = "Fraunces_700Bold";

type Props = {
  value: ReactNode;
  size: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/** Large stat numerals only — the app's single custom display face. */
export default function DisplayNumber({ value, size, color, style }: Props) {
  const { theme } = useTheme();
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily: DISPLAY_FONT_FAMILY,
          fontSize: size,
          lineHeight: Math.round(size * 1.02),
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
