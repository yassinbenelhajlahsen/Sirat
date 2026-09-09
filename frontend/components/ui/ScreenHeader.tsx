import { ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import IconButton from "@/components/ui/IconButton";
import type { AppIconName } from "@/components/ui/AppIcon";
import { Footnote, LargeTitle } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  title: string;
  /** One supporting line under the title. There is deliberately no eyebrow. */
  subtitle?: string;
  leadingIcon?: AppIconName;
  onLeadingPress?: () => void;
  leadingAccessibilityLabel?: string;
  /** Trailing accessory on the title row (month switcher, settings button). */
  trailing?: ReactNode;
  testID?: string;
};

/** Large Title header: an optional glass nav button on its own row, then the title. */
export default function ScreenHeader({
  title,
  subtitle,
  leadingIcon,
  onLeadingPress,
  leadingAccessibilityLabel,
  trailing,
  testID,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap} testID={testID}>
      {leadingIcon && onLeadingPress ? (
        <View style={styles.navRow}>
          <IconButton
            icon={leadingIcon}
            variant="glass"
            size={36}
            iconSize={18}
            accessibilityLabel={leadingAccessibilityLabel ?? "Back"}
            onPress={onLeadingPress}
          />
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <LargeTitle accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </LargeTitle>
        {trailing ?? null}
      </View>
      {subtitle ? (
        <Footnote color={theme.colors.textTertiary} style={styles.subtitle}>
          {subtitle}
        </Footnote>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { gap: theme.spacing.xs },
    navRow: { height: 44, justifyContent: "center" },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    title: { flexShrink: 1 },
    subtitle: { marginTop: 2 },
  });
