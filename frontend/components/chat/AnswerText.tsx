import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Body, TEXT_MAX_FONT_SCALE } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { parseAnswer, type Inline } from "@/services/chat/answerFormat";

type Props = { text: string; sourceCount: number; onRefPress: (n: number) => void };

export default function AnswerText({ text, sourceCount, onRefPress }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const blocks = useMemo(() => parseAnswer(text, sourceCount), [text, sourceCount]);

  const renderInlines = (inlines: Inline[]) =>
    inlines.map((part, i) =>
      part.kind === "ref" ? (
        <Text
          key={i}
          style={styles.tag}
          accessibilityRole="button"
          accessibilityLabel={`Source ${part.n}`}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          onPress={() => onRefPress(part.n)}
        >
          {` ${part.n} `}
        </Text>
      ) : part.bold ? (
        <Text key={i} style={styles.bold}>
          {part.text}
        </Text>
      ) : (
        part.text
      ),
    );

  return (
    <View style={styles.root}>
      {blocks.map((block, i) =>
        block.kind === "paragraph" ? (
          <Body key={i}>{renderInlines(block.inlines)}</Body>
        ) : (
          <View key={i} style={styles.bullets}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.bulletRow}>
                <Body>{"•"}</Body>
                <Body style={styles.bulletText}>{renderInlines(item)}</Body>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { gap: theme.spacing.sm },
    bullets: { gap: theme.spacing.xs },
    bulletRow: { flexDirection: "row", gap: theme.spacing.sm },
    bulletText: { flex: 1 },
    bold: { fontWeight: "700" },
    tag: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.accent,
      backgroundColor: withOpacity(theme.colors.accent, 0.22),
    },
  });
