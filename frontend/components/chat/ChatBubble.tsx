// frontend/components/chat/ChatBubble.tsx
import { useMemo, useRef } from "react";
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from "react-native";

import AnswerMenu from "@/components/chat/AnswerMenu";
import AnswerText from "@/components/chat/AnswerText";
import SourcesBlock from "@/components/chat/SourcesBlock";
import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import { Body, Caption, Subhead } from "@/components/ui/Text";
import { CRISIS_MESSAGE } from "@/constants/crisis";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { copyText, parseAnswer, plainAnswer } from "@/services/chat/answerFormat";
import type { ChatMessage } from "@/services/chat/chatStore";
import { limitMessage } from "@/services/chat/limit";
import { surahLabel } from "@/services/chat/sources";

export const CHAT_DISCLAIMER = "This is an aid and answers may be wrong. Please consult a trusted scholar.";
const BLOCKED_MESSAGE = "I can't help with that one. Please ask a trusted scholar.";
const SELECTOR_SIZE = 22;

type Props = {
  message: ChatMessage;
  allowance: number | null;
  resetsAt: string | null;
  sourceFocus: { n: number; token: number } | null;
  selection: { active: boolean; selectable: boolean; selected: boolean; onSelect: () => void };
  onRetry: (id: string) => void;
  onReport: (id: string) => void;
  onRefPress: (id: string, n: number) => void;
  onSourceLayout?: (id: string, n: number, y: number) => void;
};

export default function ChatBubble({
  message,
  allowance,
  resetsAt,
  sourceFocus,
  selection,
  onRetry,
  onReport,
  onRefPress,
  onSourceLayout,
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const blockY = useRef<number | null>(null);
  const rowYs = useRef<Record<number, number>>({});
  const dim = selection.active && !selection.selectable ? styles.dim : null;

  if (message.role === "user") {
    const failed = message.status === "failed";
    return (
      <View style={[styles.userColumn, dim]}>
        <View
          style={[styles.userBubble, failed && styles.failed]}
          accessible
          accessibilityLabel={`You said: ${message.text}`}
        >
          <Body color={colors.onAccent}>{message.text}</Body>
        </View>
        {failed ? (
          <PressableScale
            variant="button"
            hitSlop={8}
            onPress={() => onRetry(message.id)}
            accessibilityRole="button"
            accessibilityLabel="Not delivered. Tap to retry"
          >
            <Caption color={colors.danger}>Not delivered. Tap to retry</Caption>
          </PressableScale>
        ) : null}
      </View>
    );
  }

  if (message.notice === "crisis") {
    return (
      <View
        style={[styles.crisisBox, dim]}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={CRISIS_MESSAGE}
      >
        <Subhead color={colors.white}>{CRISIS_MESSAGE}</Subhead>
      </View>
    );
  }

  const notice = message.notice
    ? message.notice === "blocked"
      ? BLOCKED_MESSAGE
      : limitMessage(allowance, resetsAt)
    : null;
  const citations = notice === null ? (message.citations ?? []) : [];
  const selecting = selection.active && selection.selectable;
  const indent = selecting ? styles.indent : null;
  // Only the text is one "Answer: …" element; the sources stay separate so VoiceOver can reach them.
  const label = `Answer: ${notice ?? plainAnswer(message.text)}`;
  const content =
    notice !== null ? (
      <Body>{notice}</Body>
    ) : (
      <AnswerText text={message.text} sourceCount={citations.length} onRefPress={(n) => onRefPress(message.id, n)} />
    );

  // The bubble is one VoiceOver element, which hides the number tags inside it; each tag is offered as an action instead.
  const refs =
    notice === null
      ? [
          ...new Set(
            parseAnswer(message.text, citations.length)
              .flatMap((b) => (b.kind === "paragraph" ? b.inlines : b.items.flat()))
              .flatMap((part) => (part.kind === "ref" ? [part.n] : [])),
          ),
        ]
      : [];
  const a11y = {
    accessibilityLabel: label,
    accessibilityActions: refs.length ? refs.map((n) => ({ name: `Source ${n}`, label: `Source ${n}` })) : undefined,
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      const n = refs.find((r) => `Source ${r}` === e.nativeEvent.actionName);
      if (n !== undefined) onRefPress(message.id, n);
    },
  };

  const emitSource = (n: number) => {
    if (blockY.current !== null && rowYs.current[n] !== undefined) {
      onSourceLayout?.(message.id, n, blockY.current + rowYs.current[n]);
    }
  };

  let bubble = selecting ? (
    <Pressable
      style={styles.answerBubble}
      onPress={selection.onSelect}
      {...a11y}
      accessibilityState={{ selected: selection.selected }}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.answerBubble} accessible {...a11y}>
      {content}
    </View>
  );
  if (!selection.active) {
    bubble = (
      <AnswerMenu
        copy={notice ?? copyText(message, surahLabel)}
        canReport={notice === null && !message.reported}
        onReport={() => onReport(message.id)}
      >
        {bubble}
      </AnswerMenu>
    );
  }

  return (
    <View style={[styles.answer, dim]}>
      <View style={styles.answerRow}>
        {selecting ? (
          <Pressable
            onPress={selection.onSelect}
            hitSlop={8}
            accessibilityRole="radio"
            accessibilityLabel="Select this answer"
            accessibilityState={{ selected: selection.selected }}
            style={[styles.selector, selection.selected && styles.selectorOn]}
          >
            {selection.selected ? <AppIcon name="checkmark" size={14} color={colors.onAccent} /> : null}
          </Pressable>
        ) : null}
        <View style={styles.answerWrap}>{bubble}</View>
      </View>
      {citations.length ? (
        <View
          style={[styles.sources, indent]}
          onLayout={(e) => {
            blockY.current = e.nativeEvent.layout.y;
            Object.keys(rowYs.current).forEach((n) => emitSource(Number(n)));
          }}
        >
          <SourcesBlock
            citations={citations}
            focus={sourceFocus}
            messageId={message.id}
            onRowLayout={(n, y) => {
              rowYs.current[n] = y;
              emitSource(n);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, radii } = theme;
  return StyleSheet.create({
    dim: { opacity: 0.35 },
    userColumn: { alignItems: "flex-end", gap: spacing.xs },
    userBubble: {
      maxWidth: "78%",
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderBottomRightRadius: 6,
      backgroundColor: colors.accent,
    },
    failed: { opacity: 0.6 },
    answer: { gap: spacing.sm },
    answerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    answerWrap: { maxWidth: "85%", flexShrink: 1 },
    answerBubble: {
      alignSelf: "flex-start",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderBottomLeftRadius: 6,
      backgroundColor: withOpacity(colors.white, 0.11),
    },
    selector: {
      width: SELECTOR_SIZE,
      height: SELECTOR_SIZE,
      borderRadius: SELECTOR_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.textTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    selectorOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    indent: { marginLeft: SELECTOR_SIZE + spacing.sm },
    sources: { maxWidth: "85%" },
    crisisBox: {
      padding: spacing.md,
      borderRadius: radii.row,
      backgroundColor: withOpacity(colors.accent, 0.14),
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.4),
    },
  });
};
