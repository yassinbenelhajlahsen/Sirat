import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import AppIcon from "@/components/ui/AppIcon";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import { Title3, Subhead } from "@/components/ui/Text";

type QuranCompletionCardProps = {
  onBackToTop: () => void;
};

function QuranCompletionCard({ onBackToTop }: QuranCompletionCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.container}>
      <View style={styles.ornament}>
        <View style={styles.ornamentLine} />
        <AppIcon name="sparkles" size={13} color={withOpacity(theme.colors.accent, 0.7)} />
        <View style={styles.ornamentLine} />
      </View>
      <Title3 style={styles.title}>
        You have reached the end of the Quran
      </Title3>
      <Subhead color={theme.colors.textSecondary} style={styles.subtitle}>
        May this journey of recitation bring you continued blessings.
      </Subhead>
      <Button label="Back to top" icon="arrow-up" onPress={onBackToTop} />
    </GlassSurface>
  );
}

export default memo(QuranCompletionCard);

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;

  return StyleSheet.create({
    container: {
      marginTop: spacing.xxxl,
      marginBottom: spacing.huge + spacing.xl,
      marginHorizontal: spacing.lg,
      padding: spacing.xxl,
      alignItems: "center",
    },
    ornament: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    ornamentLine: {
      height: 1,
      width: 40,
      backgroundColor: withOpacity(colors.accent, 0.3),
    },
    title: {
      textAlign: "center",
      marginBottom: spacing.md,
    },
    subtitle: {
      textAlign: "center",
      marginBottom: spacing.xl,
    },
  });
};
