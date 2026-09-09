// frontend/components/settings/SettingsRow.tsx
import { ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon, { type AppIconName } from "@/components/ui/AppIcon";
import { Body, Footnote, Subhead } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

type SettingsRowProps = {
  /** Optional: rows in an icon-less group (prayer alerts) leave the slot out. */
  icon?: AppIconName;
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  first?: boolean;
  accessibilityLabel?: string;
  danger?: boolean;
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
  danger,
}: SettingsRowProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const haptics = useHaptics();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // A string `value` becomes a right-aligned detail that fills leftover space and
  // truncates; the title then keeps its natural width. A custom `trailing` (e.g. a
  // Switch) is fixed-size, so the text block keeps growing to push it to the edge.
  const hasValue = !trailing && !!value;

  const content = (
    <View style={[styles.row, subtitle ? styles.rowTall : null, disabled && styles.disabled]}>
      {!first ? (
        <View
          pointerEvents="none"
          style={[styles.separator, icon ? styles.separatorInset : styles.separatorFlush]}
        />
      ) : null}
      {icon ? (
        <View style={styles.iconSlot}>
          <AppIcon name={icon} size={20} color={danger ? colors.danger : colors.accent} />
        </View>
      ) : null}
      <View style={[styles.textBlock, hasValue && styles.textBlockTight]}>
        <Body color={danger ? colors.danger : colors.white} numberOfLines={1}>
          {title}
        </Body>
        {subtitle ? (
          <Footnote color={colors.textTertiary} style={styles.subtitle}>
            {subtitle}
          </Footnote>
        ) : null}
      </View>
      <View style={[styles.trailing, hasValue && styles.trailingFill]}>
        {trailing ??
          (value ? (
            <Subhead
              color={colors.textTertiary}
              numberOfLines={1}
              style={styles.value}
            >
              {value}
            </Subhead>
          ) : null)}
        {showChevron ? (
          <View style={styles.chevron}>
            <AppIcon name="chevron-forward" size={18} color={colors.iconMuted} />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableScale
      variant="row"
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
      minHeight: 44,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    rowTall: { minHeight: 56 },
    // Hairline drawn inside the row so insetting it never shifts the content.
    separator: {
      position: "absolute",
      top: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: withOpacity(colors.white, 0.1),
    },
    // Inset to the text edge: the 16 padding plus the 28 glyph slot and its gap.
    separatorInset: { left: spacing.lg + 28 + spacing.md },
    separatorFlush: { left: spacing.lg },
    disabled: { opacity: 0.5 },
    iconSlot: { width: 28, alignItems: "center", justifyContent: "center" },
    textBlock: { flex: 1, minWidth: 0 },
    textBlockTight: { flex: 0, flexBasis: "auto" },
    subtitle: { marginTop: 2 },
    trailing: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    trailingFill: { flex: 1, justifyContent: "flex-end", minWidth: 0 },
    value: { flexShrink: 1 },
    chevron: { marginLeft: spacing.xs },
  });
};
