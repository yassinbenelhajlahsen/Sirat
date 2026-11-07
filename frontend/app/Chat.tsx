// frontend/app/Chat.tsx
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, Stack, type NativeStackHeaderItem } from "expo-router";
import { HeaderHeightContext } from "expo-router/react-navigation";

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
import { limitMessage } from "@/services/chat/limit";
import { useChatDevBypass } from "@/utils/devChat";

// shortcut: no selection mode or source scrolling yet; Task 9 wires both.
const NO_SELECTION = { active: false, selectable: false, selected: false, onSelect: () => {} };
const noop = () => {};

export default function Chat() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isLoaded, isSignedIn } = useAuthState();
  const devChat = useChatDevBypass();
  const signedIn = isSignedIn || devChat;
  const [consented, setConsentedState] = useState<boolean | null>(null);

  useEffect(() => {
    void hasConsented().then(setConsentedState);
  }, []);

  if (!isLoaded || consented === null) {
    return <Screen safeArea={false}>{null}</Screen>;
  }

  if (!signedIn) {
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
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
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

  const onReport = (id: string) => {
    report(id).then(
      () => setToast("Thanks, we'll review this answer."),
      () => setToast("Couldn't send the report. Please try again."),
    );
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
              sourceFocus={null}
              selection={NO_SELECTION}
              onRetry={retry}
              onReport={onReport}
              onRefPress={noop}
            />
          )}
          ListFooterComponent={sending ? <PendingReply /> : null}
          // The list sits inside the keyboard wrapper, where iOS doesn't inset it under the transparent header.
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: screenMargin, paddingTop: headerHeight + theme.spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        {remaining === 0 && !sending && messages[messages.length - 1]?.notice !== "limit" ? (
          <Footnote color={colors.textSecondary} style={[styles.limit, { paddingHorizontal: screenMargin }]}>
            {limitMessage(allowance, resetsAt)}
          </Footnote>
        ) : null}
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={onSend}
          // shortcut: the field still shows at the limit and Send is just disabled; Task 9 passes limitLines here.
          sending={sending || remaining === 0}
          limit={null}
        />
      </KeyboardAvoidingView>
      <CopyToast
        visible={toast !== null}
        message={toast ?? undefined}
        onHide={hideToast}
        placement="top"
        topOffset={headerHeight}
      />
    </>
  );
}

function PendingReply() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.pending} accessible accessibilityLabel="Writing an answer">
      <ActivityIndicator color={theme.colors.accent} />
      <Footnote color={theme.colors.textSecondary}>Writing an answer...</Footnote>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    centered: { flex: 1, justifyContent: "center" },
    list: { paddingBottom: theme.spacing.lg, gap: theme.spacing.lg },
    pending: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: theme.spacing.sm },
    limit: { paddingTop: theme.spacing.sm },
  });
