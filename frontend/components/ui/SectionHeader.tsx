import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import { Footnote, Subhead } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  title: string;
  /** Right-aligned text action, iOS style (accent, semibold). */
  actionLabel?: string;
  onActionPress?: () => void;
  actionAccessibilityLabel?: string;
  testID?: string;
};

/** The grouped-list header iOS uses above a card: small, tracked, tertiary. */
export default function SectionHeader({
  title,
  actionLabel,
  onActionPress,
  actionAccessibilityLabel,
  testID,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} testID={testID}>
      <Footnote
        accessibilityRole="header"
        color={theme.colors.textTertiary}
        style={styles.title}
      >
        {title.toUpperCase()}
      </Footnote>
      {actionLabel && onActionPress ? (
        <PressableScale
          variant="button"
          onPress={onActionPress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
        >
          <Subhead color={theme.colors.accent} style={styles.action}>
            {actionLabel}
          </Subhead>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Explanatory text under a grouped card. */
export function SectionFooter({ children, testID }: { children: string; testID?: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Footnote color={theme.colors.textTertiary} style={styles.footer} testID={testID}>
      {children}
    </Footnote>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      marginLeft: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    title: { letterSpacing: 0.4 },
    action: { fontWeight: "600" },
    footer: {
      marginTop: 6,
      marginHorizontal: theme.spacing.lg,
    },
  });
