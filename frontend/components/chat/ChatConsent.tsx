// frontend/components/chat/ChatConsent.tsx
import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { CHAT_DISCLAIMER } from "@/components/chat/ChatBubble";
import Button from "@/components/ui/Button";
import { Body, Subhead, Title2 } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { setConsented } from "@/services/chat/chatStore";

type Props = { onContinue: () => void };

export default function ChatConsent({ onContinue }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screenMargin = useScreenMargin();

  const handleContinue = async () => {
    await setConsented();
    onContinue();
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingHorizontal: screenMargin }]}
    >
      <Title2 accessibilityRole="header">Before you ask</Title2>
      <Body color={colors.textSecondary}>
        Your question and recent messages from this chat are sent to OpenAI, a third-party AI service, to write the
        answer.
      </Body>
      <Body color={colors.textSecondary}>
        Your chat history stays on this phone. Sirat only keeps a count of how many messages you send each month.
      </Body>
      <Body color={colors.textSecondary}>Avoid sharing details you&apos;d rather keep private.</Body>
      <Subhead color={colors.textTertiary}>{CHAT_DISCLAIMER}</Subhead>
      <Button label="Continue" size="lg" onPress={handleContinue} style={styles.button} />
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    content: {
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    button: { marginTop: theme.spacing.lg },
  });
