// frontend/components/chat/QuickPrompts.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import { Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useScreenMargin } from "@/hooks/useScreenMargin";

type Props = { prompts: string[]; onPick: (text: string) => void };

export default function QuickPrompts({ prompts, onPick }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screenMargin = useScreenMargin();

  return (
    <View style={[styles.row, { paddingHorizontal: screenMargin }]}>
      {prompts.map((prompt) => (
        <PressableScale
          key={prompt}
          variant="button"
          onPress={() => onPick(prompt)}
          accessibilityRole="button"
          accessibilityLabel={prompt}
          style={styles.chip}
        >
          <Footnote color={theme.colors.textSecondary} style={styles.text}>{prompt}</Footnote>
        </PressableScale>
      ))}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: spacing.sm },
    chip: {
      minHeight: 36,
      justifyContent: "center",
      backgroundColor: withOpacity(colors.white, theme.name === "light" ? 0.05 : 0.1),
      borderRadius: theme.radii.pill,
      borderCurve: "circular",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    text: { fontWeight: "600" },
  });
};
