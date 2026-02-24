import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import PressableScale from "../PressableScale";

type QuranCompletionCardProps = {
  onBackToTop: () => void;
};

function QuranCompletionCard({ onBackToTop }: QuranCompletionCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You have reached the end of the Quran</Text>
      <Text style={styles.subtitle}>
        May this journey of recitation bring you continued blessings.
      </Text>
      <PressableScale
        accessibilityRole="button"
        style={styles.backToTopButton}
        onPress={onBackToTop}
      >
        <Text style={styles.backToTopText}>Back to Top</Text>
      </PressableScale>
    </View>
  );
}

export default memo(QuranCompletionCard);

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;

  return StyleSheet.create({
    container: {
      marginTop: 32,
      marginBottom: 60,
      padding: 24,
      borderRadius: 20,
      backgroundColor: withOpacity(themeColors.white, 0.04),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.25),
      alignItems: "center",
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: themeColors.white,
      textAlign: "center",
      marginBottom: 12,
    },
    subtitle: {
      color: themeColors.white,
      opacity: 0.85,
      fontSize: 15,
      textAlign: "center",
      marginBottom: 20,
    },
    backToTopButton: {
      backgroundColor: themeColors.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
    },
    backToTopText: {
      fontWeight: "600",
      color: themeColors.onAccent,
      fontSize: 15,
    },
  });
};
