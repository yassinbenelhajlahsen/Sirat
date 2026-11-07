// frontend/components/chat/ChatComposer.tsx
import { useMemo } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import IconButton from "@/components/ui/IconButton";
import { Caption, Footnote, TEXT_MAX_FONT_SCALE } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useScreenMargin } from "@/hooks/useScreenMargin";

// Matches the server's question cap, so a typed question is never cut short by the request.
export const QUESTION_MAX_LENGTH = 1000;
const COUNT_FROM = 900;
const SEND_SIZE = 30;
const INSET = 4;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  limit: [string, string] | null;
};

export default function ChatComposer({ value, onChangeText, onSend, sending, limit }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const screenMargin = useScreenMargin();

  return (
    <View style={[styles.wrap, { paddingHorizontal: screenMargin, paddingBottom: insets.bottom + theme.spacing.sm }]}>
      {limit ? (
        <View style={styles.limit}>
          {limit.map((line) => (
            <Footnote key={line} color={colors.textSecondary} style={styles.limitLine}>
              {line}
            </Footnote>
          ))}
        </View>
      ) : (
        <View style={styles.shell}>
          <View style={styles.fieldColumn}>
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder="Ask a question"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={QUESTION_MAX_LENGTH}
              accessibilityLabel="Your question"
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={styles.input}
            />
            {value.length >= COUNT_FROM ? (
              <Caption color={colors.textTertiary} style={styles.count}>
                {`${value.length}/${QUESTION_MAX_LENGTH}`}
              </Caption>
            ) : null}
          </View>
          {value.trim().length > 0 ? (
            <IconButton
              icon="arrow-up"
              variant="primary"
              size={SEND_SIZE}
              accessibilityLabel="Send"
              onPress={onSend}
              disabled={sending}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, type } = theme;
  return StyleSheet.create({
    wrap: { paddingTop: spacing.sm },
    shell: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      paddingLeft: spacing.md,
      paddingRight: INSET,
      paddingVertical: INSET,
      borderRadius: SEND_SIZE / 2 + INSET,
      borderCurve: "continuous",
      backgroundColor: withOpacity(colors.white, 0.08),
    },
    fieldColumn: { flex: 1 },
    input: {
      ...type.body,
      // One line is exactly as tall as the send circle, so both center in the shell; explicit padding also replaces iOS's default multiline paddingTop of 5.
      paddingTop: (SEND_SIZE - type.body.lineHeight) / 2,
      paddingBottom: (SEND_SIZE - type.body.lineHeight) / 2,
      color: colors.white,
      maxHeight: 120,
    },
    count: { alignSelf: "flex-end" },
    limit: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
    limitLine: { textAlign: "center" },
  });
};
