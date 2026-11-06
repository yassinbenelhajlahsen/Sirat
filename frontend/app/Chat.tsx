// frontend/app/Chat.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, Stack, type NativeStackHeaderItem } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CopyToast from "@/components/CopyToast";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatComposer from "@/components/chat/ChatComposer";
import ChatConsent from "@/components/chat/ChatConsent";
import EmptyState from "@/components/ui/EmptyState";
import Screen from "@/components/ui/Screen";
import { Footnote } from "@/components/ui/Text";
import { glassTintFor, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";
import { useChat } from "@/hooks/useChat";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { hasConsented, type ChatMessage } from "@/services/chat/chatStore";

// The native header bar sits under the status bar; the toast clears both.
const HEADER_BAR_HEIGHT = 44;

export default function Chat() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isLoaded, isSignedIn } = useAuthState();
  const [consented, setConsentedState] = useState<boolean | null>(null);

  useEffect(() => {
    void hasConsented().then(setConsentedState);
  }, []);

  if (!isLoaded || consented === null) {
    return <Screen safeArea={false}>{null}</Screen>;
  }

  if (!isSignedIn) {
    return (
      <Screen safeArea={false}>
        <View style={styles.centered}>
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="Sign in to ask"
            actionLabel="Sign in"
            onAction={() => router.push("/SignIn")}
          />
        </View>
      </Screen>
    );
  }

  if (!consented) {
    return (
      <Screen safeArea={false}>
        <ChatConsent onContinue={() => setConsentedState(true)} />
      </Screen>
    );
  }

  return (
    <Screen safeArea={false}>
      <Conversation />
    </Screen>
  );
}

function Conversation() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const screenMargin = useScreenMargin();
  const { messages, remaining, allowance, resetsAt, sending, send, retry, report } = useChat();
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const onSend = () => {
    const text = draft;
    setDraft("");
    void send(text);
  };

  const onReport = async (id: string) => {
    await report(id);
    setToast("Thanks, we'll review this answer.");
  };

  const headerRightItems = (): NativeStackHeaderItem[] => {
    const close: NativeStackHeaderItem = {
      type: "button",
      label: "Close",
      icon: { type: "sfSymbol", name: "xmark" },
      variant: "prominent",
      tintColor: glassTintFor(theme),
      onPress: () => router.back(),
    };
    const count: NativeStackHeaderItem = {
      type: "custom",
      element: <Footnote color={colors.white}>{`${remaining} left`}</Footnote>,
    };
    return remaining === null ? [close] : [count, close];
  };

  return (
    <>
      <Stack.Screen options={{ unstable_headerRightItems: headerRightItems }} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              allowance={allowance}
              resetsAt={resetsAt}
              onRetry={retry}
              onReport={onReport}
            />
          )}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingHorizontal: screenMargin }]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={onSend}
          sending={sending}
          remaining={remaining}
        />
      </KeyboardAvoidingView>
      <CopyToast
        visible={toast !== null}
        message={toast ?? undefined}
        onHide={hideToast}
        placement="top"
        topOffset={insets.top + HEADER_BAR_HEIGHT}
      />
    </>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    centered: { flex: 1, justifyContent: "center" },
    list: { paddingVertical: theme.spacing.lg, gap: theme.spacing.lg },
  });
