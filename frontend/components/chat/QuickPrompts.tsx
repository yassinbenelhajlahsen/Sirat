// frontend/components/chat/QuickPrompts.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import { Body, Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = { prompts: string[]; onPick: (text: string) => void };

// Sits at the end of the conversation, shaped like the person's own bubbles so a tap reads as "send this".
export default function QuickPrompts({ prompts, onPick }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.column}>
      <Caption color={theme.colors.textTertiary} style={styles.label}>
        Try asking
      </Caption>
      {prompts.map((prompt) => (
        <PressableScale
          key={prompt}
          variant="button"
          onPress={() => onPick(prompt)}
          accessibilityRole="button"
          accessibilityLabel={prompt}
          style={styles.bubble}
        >
          <Body color={theme.colors.textPrimary}>{prompt}</Body>
        </PressableScale>
      ))}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    column: { alignItems: "flex-end", gap: spacing.sm },
    label: { fontWeight: "600" },
    // Same shape as the sent bubble in ChatBubble, but outlined so it doesn't read as already sent.
    bubble: {
      maxWidth: "78%",
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderBottomRightRadius: 6,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.55),
      backgroundColor: withOpacity(colors.accent, 0.1),
    },
  });
};
