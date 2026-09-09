import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useMemo } from "react";
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import PressableScale from "@/components/PressableScale";
import { Footnote, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

export type ButtonVariant = "primary" | "secondary" | "tonal" | "ghost" | "danger";
// md is the 44pt HIG default; lg for full-width sheet CTAs; sm only for
// inline chips inside an already-tappable row (hitSlop pads it back to 44).
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IoniconName;
  iconPosition?: "leading" | "trailing";
  /** Custom leading node (e.g. a brand mark) when an Ionicon won't do. */
  leading?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const PAD_H: Record<ButtonSize, number> = { sm: 12, md: 16, lg: 20 };

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "leading",
  leading,
  disabled = false,
  loading = false,
  loadingLabel,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const palette = useMemo(() => variantPalette(theme, variant), [theme, variant]);
  const inactive = disabled || loading;

  const Label = size === "sm" ? Footnote : Headline;
  const text = loading ? loadingLabel ?? label : label;
  const iconSize = size === "sm" ? 14 : 18;

  const glyph = loading ? (
    <ActivityIndicator size="small" color={palette.text} />
  ) : icon ? (
    <Ionicons name={icon} size={iconSize} color={palette.text} />
  ) : (
    leading ?? null
  );

  return (
    <PressableScale
      scaleTo={0.97}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? 4 : undefined}
      testID={testID}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: PAD_H[size],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: palette.border === "transparent" ? 0 : 1,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {glyph && iconPosition === "leading" ? <View style={styles.glyph}>{glyph}</View> : null}
      <Label color={palette.text} numberOfLines={1} style={size === "sm" ? styles.smLabel : undefined}>
        {text}
      </Label>
      {glyph && iconPosition === "trailing" ? <View style={styles.glyph}>{glyph}</View> : null}
    </PressableScale>
  );
}

function variantPalette(theme: AppTheme, variant: ButtonVariant) {
  const { colors } = theme;
  switch (variant) {
    case "primary":
      return { bg: colors.accent, border: "transparent", text: colors.onAccent };
    case "secondary":
      return { bg: "transparent", border: colors.accent, text: colors.accent };
    case "tonal":
      return {
        bg: withOpacity(colors.white, 0.07),
        border: withOpacity(colors.white, 0.14),
        text: colors.white,
      };
    case "danger":
      return { bg: "transparent", border: "transparent", text: colors.danger };
    case "ghost":
    default:
      return { bg: "transparent", border: "transparent", text: colors.textSecondary };
  }
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    base: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
    },
    glyph: { alignItems: "center", justifyContent: "center" },
    smLabel: { fontWeight: "600" },
    disabled: { opacity: 0.45 },
  });
