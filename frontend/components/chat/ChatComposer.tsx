// frontend/components/chat/ChatComposer.tsx
import { useMemo } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import IconButton from "@/components/ui/IconButton";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useScreenMargin } from "@/hooks/useScreenMargin";

// Matches the server's question cap, so a typed question is never cut short by the request.
export const QUESTION_MAX_LENGTH = 1000;
const COUNT_FROM = 900;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  remaining: number | null;
};

export default function ChatComposer({ value, onChangeText, onSend, sending, remaining }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const screenMargin = useScreenMargin();
  const canSend = !sending && value.trim().length > 0 && remaining !== 0;

  return (
    <View style={[styles.wrap, { paddingHorizontal: screenMargin, paddingBottom: insets.bottom + theme.spacing.sm }]}>
      <View style={styles.shell}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask a question"
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={QUESTION_MAX_LENGTH}
          accessibilityLabel="Your question"
          maxFontSizeMultiplier={1.4}
          style={styles.input}
        />
        {value.length >= COUNT_FROM ? (
          <Caption color={colors.textTertiary} style={styles.count}>
            {`${value.length}/${QUESTION_MAX_LENGTH}`}
          </Caption>
        ) : null}
      </View>
      <IconButton
        icon="arrow-up"
        variant="primary"
        accessibilityLabel="Send"
        onPress={onSend}
        disabled={!canSend}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, radii, type } = theme;
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    shell: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.row,
      backgroundColor: withOpacity(colors.white, 0.08),
    },
    input: {
      ...type.body,
      color: colors.white,
      maxHeight: 120,
    },
    count: { alignSelf: "flex-end" },
  });
};
