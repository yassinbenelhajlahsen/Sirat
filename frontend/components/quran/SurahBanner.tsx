import { StyleSheet, Text, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Caption, Footnote } from "@/components/ui/Text";

export default function SurahBanner({
  arabicName,
  englishName,
}: {
  arabicName: string;
  englishName?: string;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.banner}>
      <View style={styles.rule}>
        <View style={styles.line} />
        <Caption color={theme.colors.accent}>❖</Caption>
        <View style={styles.line} />
      </View>
      <Text style={styles.arabic} maxFontSizeMultiplier={1.2}>
        {arabicName}
      </Text>
      {englishName ? (
        <Footnote color={theme.colors.textSecondary}>{englishName}</Footnote>
      ) : null}
      <View style={styles.rule}>
        <View style={styles.line} />
        <Caption color={theme.colors.accent}>❖</Caption>
        <View style={styles.line} />
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    banner: {
      alignItems: "center",
      marginVertical: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    rule: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      opacity: 0.6,
      alignSelf: "stretch",
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: withOpacity(theme.colors.accent, 0.5),
    },
    // Its own style: the 28pt Arabic display line is not a Caption override.
    arabic: {
      fontSize: 28,
      fontWeight: "600",
      lineHeight: 38,
      color: theme.colors.accent,
      textAlign: "center",
    },
  });
