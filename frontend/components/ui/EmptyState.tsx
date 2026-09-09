import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import AppIcon, { type AppIconName } from "@/components/ui/AppIcon";
import Button from "@/components/ui/Button";
import { Body, Footnote, Title3 } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  icon: AppIconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  actionAccessibilityLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryAccessibilityLabel?: string;
  /** Small print next to the secondary action (permissions caveats). */
  note?: string;
  testID?: string;
};

/** The shared bare-canvas empty state: glyph, title, one line, one action. */
export default function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  actionLoading = false,
  actionAccessibilityLabel,
  secondaryLabel,
  onSecondary,
  secondaryAccessibilityLabel,
  note,
  testID,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap} testID={testID}>
      <AppIcon name={icon} size={32} color={theme.colors.iconMuted} />
      <Title3 accessibilityRole="header" style={styles.title}>
        {title}
      </Title3>
      {message ? (
        <Body color={theme.colors.textSecondary} style={styles.message}>
          {message}
        </Body>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          loading={actionLoading}
          accessibilityLabel={actionAccessibilityLabel}
          style={styles.action}
        />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button
          label={secondaryLabel}
          variant="ghost"
          onPress={onSecondary}
          accessibilityLabel={secondaryAccessibilityLabel}
        />
      ) : null}
      {note ? (
        <Footnote color={theme.colors.textTertiary} style={styles.message}>
          {note}
        </Footnote>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xxl,
    },
    title: { textAlign: "center", marginTop: theme.spacing.xs },
    message: { textAlign: "center" },
    action: { marginTop: theme.spacing.sm, alignSelf: "stretch" },
  });
