import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import Button from "@/components/ui/Button";
import NativeSheet from "@/components/ui/NativeSheet";
import Segmented from "@/components/ui/Segmented";
import { Caption, Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";
import { submitFeedback, type FeedbackType } from "@/services/feedback";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TYPE_OPTIONS = [
  { value: "feedback" as const, label: "Feedback" },
  { value: "bug" as const, label: "Bug" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSent: () => void;
};

export default function FeedbackSheet({ visible, onClose, onSent }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { email: accountEmail } = useAuthState();

  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(accountEmail ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start fresh each time the sheet opens.
  const previousVisibleRef = useRef(visible);
  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      setType("feedback");
      setMessage("");
      setEmail(accountEmail ?? "");
      setError(null);
    }
    previousVisibleRef.current = visible;
  }, [visible, accountEmail]);

  const isBug = type === "bug";
  const canSend = message.trim().length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_SHAPE.test(trimmedEmail)) {
      setError("Check the email address.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await submitFeedback({ type, message, email });
      onSent();
    } catch {
      setError("Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <NativeSheet visible={visible} onClose={onClose} title="Send feedback" dismissDisabled={sending}>
      <View style={styles.body}>
        <Segmented options={TYPE_OPTIONS} value={type} onChange={setType} accessibilityLabel="Report type" />

        <TextInput
          placeholder={isBug ? "What went wrong?" : "What's on your mind?"}
          placeholderTextColor={colors.textTertiary}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={4000}
          style={[styles.input, styles.message]}
          accessibilityLabel="Message"
          maxFontSizeMultiplier={1.4}
        />

        <TextInput
          placeholder="Email (if you'd like a reply)"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          maxLength={254}
          style={styles.input}
          accessibilityLabel="Email"
          maxFontSizeMultiplier={1.4}
        />

        {isBug ? (
          <Caption color={colors.textTertiary}>Includes app version, device, basic settings and recent errors.</Caption>
        ) : null}

        {error ? (
          <Footnote color={colors.danger} accessibilityLiveRegion="polite">
            {error}
          </Footnote>
        ) : null}

        <Button
          label="Send"
          accessibilityLabel="Send"
          size="lg"
          onPress={send}
          disabled={!canSend}
          loading={sending}
          loadingLabel="Sending"
          style={styles.send}
        />
      </View>
    </NativeSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  const isLight = theme.name === "light";
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
    input: {
      backgroundColor: isLight ? withOpacity(colors.black, 0.05) : withOpacity(colors.white, 0.07),
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 48,
      color: colors.white,
      fontSize: 16,
    },
    message: { minHeight: 120, textAlignVertical: "top" },
    send: { marginTop: spacing.sm },
  });
};
