// frontend/components/chat/ChatConsent.tsx
import { useContext, useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const insets = useSafeAreaInsets();

  const handleContinue = async () => {
    await setConsented();
    onContinue();
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: screenMargin,
          paddingTop: headerHeight + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
      ]}
    >
      <Title2 accessibilityRole="header">Before you ask</Title2>
      <Body color={colors.textSecondary}>
        Your question and recent messages from this chat are sent to a third-party AI service, to write the
        answer.
      </Body>
      <Body color={colors.textSecondary}>
        Your chat history stays on this phone. Sirat only keeps a count of how many messages you send each month.
      </Body>
      <Body color={colors.textSecondary}>Avoid sharing details you&apos;d rather keep private.</Body>
      <Subhead color={colors.textTertiary}>{CHAT_DISCLAIMER}</Subhead>
      <View style={styles.footer}>
        <Button label="Continue" size="lg" onPress={handleContinue} />
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    content: { flexGrow: 1, gap: theme.spacing.md },
    // Pins Continue to the bottom; on small screens it follows the text instead.
    footer: { marginTop: "auto", paddingTop: theme.spacing.lg },
  });
