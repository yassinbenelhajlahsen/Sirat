import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import IconButton from "@/components/ui/IconButton";
import { Footnote, Title3 } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
};

/** Title, optional subtitle and a standard close control for bottom sheets. */
export default function SheetHeader({
  title,
  subtitle,
  onClose,
  closeLabel = "Close",
  closeDisabled = false,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Title3 accessibilityRole="header">{title}</Title3>
        {subtitle ? (
          <Footnote color={theme.colors.textSecondary} style={styles.subtitle}>
            {subtitle}
          </Footnote>
        ) : null}
      </View>
      {onClose ? (
        <IconButton
          icon="close"
          size={36}
          iconSize={18}
          accessibilityLabel={closeLabel}
          onPress={onClose}
          disabled={closeDisabled}
        />
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    text: { flex: 1, minWidth: 0 },
    subtitle: { marginTop: 2 },
  });
