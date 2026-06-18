// frontend/components/settings/SettingsRow.tsx
import { ComponentProps, ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import PressableScale from "@/components/PressableScale";
import { Body, Footnote, Subhead } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

type SettingsRowProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  first?: boolean;
  accessibilityLabel?: string;
};

export default function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  trailing,
  showChevron,
  onPress,
  disabled,
  first,
  accessibilityLabel,
}: SettingsRowProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const haptics = useHaptics();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const content = (
    <View style={[styles.row, !first && styles.divider, disabled && styles.disabled]}>
      <View style={styles.iconTile}>
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.textBlock}>
        <Body color={colors.white}>{title}</Body>
        {subtitle ? (
          <Footnote color={withOpacity(colors.white, 0.55)} style={styles.subtitle}>
            {subtitle}
          </Footnote>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {trailing ??
          (value ? (
            <Subhead color={withOpacity(colors.white, 0.55)}>{value}</Subhead>
          ) : null)}
        {showChevron ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={withOpacity(colors.white, 0.35)}
            style={styles.chevron}
          />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableScale
      scaleTo={0.98}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={() => {
        if (disabled) return;
        haptics("selection");
        onPress();
      }}
    >
      {content}
    </PressableScale>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(colors.white, 0.08),
    },
    disabled: { opacity: 0.5 },
    iconTile: {
      width: 30,
      height: 30,
      borderRadius: 9,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.accent, 0.14),
    },
    textBlock: { flex: 1, minWidth: 0 },
    subtitle: { marginTop: 2 },
    trailing: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    chevron: { marginLeft: 2 },
  });
};
