import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import GlassSurface from "@/components/ui/GlassSurface";
import { Title3, Subhead, Headline } from "@/components/ui/Text";
import PressableScale from "../PressableScale";

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
        <Ionicons name="sparkles" size={13} color={withOpacity(theme.colors.accent, 0.7)} />
        <View style={styles.ornamentLine} />
      </View>
      <Title3 style={styles.title}>
        You have reached the end of the Quran
      </Title3>
      <Subhead color={withOpacity(theme.colors.white, 0.85)} style={styles.subtitle}>
        May this journey of recitation bring you continued blessings.
      </Subhead>
      <PressableScale
        accessibilityRole="button"
        style={styles.backToTopButton}
        onPress={onBackToTop}
      >
        <Headline color={theme.colors.onAccent}>Back to Top</Headline>
      </PressableScale>
    </GlassSurface>
  );
}

export default memo(QuranCompletionCard);

const createStyles = (theme: AppTheme) => {
  const { colors } = theme;

  return StyleSheet.create({
    container: {
      marginTop: 32,
      marginBottom: 60,
      marginHorizontal: 16,
      padding: 24,
      alignItems: "center",
    },
    ornament: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 16,
    },
    ornamentLine: {
      height: 1,
      width: 40,
      backgroundColor: withOpacity(colors.accent, 0.3),
    },
    title: {
      textAlign: "center",
      marginBottom: 10,
    },
    subtitle: {
      textAlign: "center",
      marginBottom: 20,
    },
    backToTopButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: theme.radii.pill,
    },
  });
};
