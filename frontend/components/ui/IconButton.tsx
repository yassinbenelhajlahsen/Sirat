import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import PressableScale from "@/components/PressableScale";
import GlassSurface from "@/components/ui/GlassSurface";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

export type IconButtonVariant = "glass" | "tonal" | "plain" | "primary";

export type IconButtonProps = {
  icon: IoniconName;
  accessibilityLabel: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Visual diameter. Anything under 44 gets hitSlop so the target stays 44. */
  size?: number;
  iconSize?: number;
  variant?: IconButtonVariant;
  color?: string;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const ICON_BUTTON_MIN_TARGET = 44;

export default function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  onLongPress,
  size = ICON_BUTTON_MIN_TARGET,
  iconSize,
  variant = "tonal",
  color,
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: IconButtonProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hitSlop = Math.max(0, Math.ceil((ICON_BUTTON_MIN_TARGET - size) / 2));
  const glyphColor =
    color ?? (variant === "primary" ? colors.onAccent : withOpacity(colors.white, 0.9));
  const glyph = <Ionicons name={icon} size={iconSize ?? Math.round(size * 0.46)} color={glyphColor} />;
  const dims = { width: size, height: size, borderRadius: size / 2 };

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[disabled && styles.disabled, style]}
    >
      {variant === "glass" ? (
        <GlassSurface tier="chrome" radius={size / 2} curve="circular" style={[styles.center, dims]}>
          {glyph}
        </GlassSurface>
      ) : (
        <View
          style={[
            styles.center,
            dims,
            variant === "tonal" && styles.tonal,
            variant === "primary" && styles.primary,
          ]}
        >
          {glyph}
        </View>
      )}
    </PressableScale>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors } = theme;
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    tonal: {
      backgroundColor: withOpacity(colors.white, 0.1),
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.18),
    },
    primary: { backgroundColor: colors.accent },
    disabled: { opacity: 0.45 },
  });
};
