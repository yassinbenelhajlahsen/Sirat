// frontend/components/chat/ChatBubble.tsx
import { useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import CitationCard from "@/components/chat/CitationCard";
import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import { Body, Caption, Footnote, Subhead } from "@/components/ui/Text";
import { CRISIS_MESSAGE } from "@/constants/crisis";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { ChatMessage } from "@/services/chat/chatStore";

export const CHAT_DISCLAIMER = "This is an aid and answers may be wrong. Please consult a trusted scholar.";
const BLOCKED_MESSAGE = "I can't help with that one. Please ask a trusted scholar.";

type ReportState = "idle" | "sending" | "failed" | "sent";

type Props = {
  message: ChatMessage;
  allowance: number | null;
  resetsAt: string | null;
  onRetry: (id: string) => void;
  onReport: (id: string) => Promise<void>;
};

function limitMessage(allowance: number | null, resetsAt: string | null): string {
  const count = allowance === null ? "" : `${allowance} `;
  const when = resetsAt
    ? `on ${new Date(resetsAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
    : "at the start of next month";
  return `You've used this month's ${count}messages. They reset ${when}.`;
}

export default function ChatBubble({ message, allowance, resetsAt, onRetry, onReport }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [reportState, setReportState] = useState<ReportState>("idle");

  if (message.role === "user") {
    return (
      <View style={styles.userColumn}>
        <View style={styles.userBubble}>
          <Body color={colors.white}>{message.text}</Body>
        </View>
        {message.status === "failed" ? (
          <PressableScale
            variant="button"
            hitSlop={8}
            onPress={() => onRetry(message.id)}
            accessibilityRole="button"
            accessibilityLabel="Didn't send. Tap to retry"
          >
            <Caption color={colors.danger}>Didn&apos;t send. Tap to retry</Caption>
          </PressableScale>
        ) : null}
      </View>
    );
  }

  if (message.notice === "crisis") {
    return (
      <View
        style={styles.crisisBox}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={CRISIS_MESSAGE}
      >
        <Subhead color={colors.white}>{CRISIS_MESSAGE}</Subhead>
      </View>
    );
  }

  if (message.notice) {
    const text = message.notice === "blocked" ? BLOCKED_MESSAGE : limitMessage(allowance, resetsAt);
    return (
      <View style={styles.assistant}>
        <Body color={colors.white}>{text}</Body>
      </View>
    );
  }

  const handleReport = async () => {
    setReportState("sending");
    try {
      await onReport(message.id);
      setReportState("sent");
    } catch {
      setReportState("failed");
    }
  };

  return (
    <View style={styles.assistant}>
      <Body color={colors.white}>{message.text}</Body>
      {(message.citations ?? []).map((citation) => (
        <CitationCard
          key={citation.kind === "quran" ? `q${citation.surah}:${citation.ayah}` : `h${citation.id}`}
          citation={citation}
        />
      ))}
      {message.scholarLink ? (
        <PressableScale
          variant="button"
          onPress={() => void Linking.openURL(message.scholarLink!)}
          accessibilityRole="link"
          accessibilityLabel="Read a scholar's answer"
        >
          <Footnote color={colors.accent}>Read a scholar&apos;s answer</Footnote>
        </PressableScale>
      ) : null}
      <Caption color={colors.textTertiary}>{CHAT_DISCLAIMER}</Caption>
      {reportState !== "sent" ? (
        <>
          <PressableScale
            variant="button"
            hitSlop={8}
            disabled={reportState === "sending"}
            onPress={handleReport}
            accessibilityRole="button"
            accessibilityLabel="Report this answer"
            style={styles.reportRow}
          >
            <AppIcon name="flag-outline" size={12} color={colors.textTertiary} />
            <Caption color={colors.textTertiary}>Report</Caption>
          </PressableScale>
          {reportState === "failed" ? (
            <Caption color={colors.danger}>Couldn&apos;t send the report. Please try again.</Caption>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, radii } = theme;
  return StyleSheet.create({
    userColumn: { alignItems: "flex-end", gap: spacing.xs },
    userBubble: {
      maxWidth: "85%",
      padding: spacing.md,
      borderRadius: radii.row,
      backgroundColor: withOpacity(colors.accent, 0.18),
    },
    assistant: { gap: spacing.sm },
    crisisBox: {
      padding: spacing.md,
      borderRadius: radii.row,
      backgroundColor: withOpacity(colors.accent, 0.14),
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.4),
    },
    reportRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: spacing.xs,
      minHeight: 24,
    },
  });
};
