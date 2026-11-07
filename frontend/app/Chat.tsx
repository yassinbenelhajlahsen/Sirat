// frontend/app/Chat.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, type ViewProps } from "react-native";
import { router, Stack, type NativeStackHeaderItem } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CopyToast from "@/components/CopyToast";
import PressableScale from "@/components/PressableScale";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatComposer from "@/components/chat/ChatComposer";
import ChatConsent from "@/components/chat/ChatConsent";
import ChatHeaderTitle from "@/components/chat/ChatHeaderTitle";
import QuickPrompts from "@/components/chat/QuickPrompts";
import TypingBubble from "@/components/chat/TypingBubble";
import EmptyState from "@/components/ui/EmptyState";
import Screen from "@/components/ui/Screen";
import { Body, Caption, Footnote } from "@/components/ui/Text";
import { glassTintFor, withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";
import { useChat } from "@/hooks/useChat";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { hasConsented, type ChatMessage } from "@/services/chat/chatStore";
import { limitLines } from "@/services/chat/limit";
import { pickPrompts, promptsEligible } from "@/services/chat/quickPrompts";
import { formatTimeLine, timeLineAt } from "@/services/chat/timeline";
import { useChatDevBypass } from "@/utils/devChat";
import { mixColors } from "@/utils/sky";

const NOTICE = "Answers are an aid and may be wrong. Please consult a trusted scholar.";
const REPORT_THANKS = "Thanks, we'll review this answer.";
const REPORT_FAILED = "Couldn't send the report. Please try again.";

const isReportable = (m: ChatMessage) => m.role === "assistant" && !m.notice && !m.reported;

// What the list keeps in view as content grows: the end, or a message (or one of its source rows) near the top.
type Pin = "end" | { id: string; n?: number } | null;

// FlatList item layouts are relative to their cell, which always sits at 0; the cell's own y is the content offset.
const CellLayoutContext = createContext<(id: string, y: number) => void>(() => {});
type CellProps = ViewProps & { item: ChatMessage; index: number; cellKey: string };
function MeasuredCell({ item, index: _index, cellKey: _cellKey, onLayout, ...rest }: CellProps) {
  const onCellLayout = useContext(CellLayoutContext);
  return (
    <View
      {...rest}
      testID={`chat-cell-${item.id}`}
      onLayout={(e) => {
        onCellLayout(item.id, e.nativeEvent.layout.y);
        onLayout?.(e);
      }}
    />
  );
}

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
  const insets = useSafeAreaInsets();
  const screenMargin = useScreenMargin();
  const { messages, remaining, allowance, resetsAt, sending, loaded, send, retry, report } = useChat();
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [openedAt] = useState(Date.now);
  const [prompts] = useState(() => pickPrompts());
  const [sentHere, setSentHere] = useState(false);
  const [selecting, setSelecting] = useState<{ active: boolean; selectedId: string | null }>({
    active: false,
    selectedId: null,
  });
  const [reporting, setReporting] = useState(false);
  const [focus, setFocus] = useState<{ id: string; n: number; token: number } | null>(null);
  const reportInFlight = useRef(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const pin = useRef<Pin>("end");
  const seen = useRef<Set<string> | null>(null);
  const layout = useRef({
    content: 0,
    frame: 0,
    cells: {} as Record<string, number>,
    bubbles: {} as Record<string, number>,
    sources: {} as Record<string, Record<number, number>>,
  });
  const hideToast = useCallback(() => setToast(null), []);
  const topInset = headerHeight + theme.spacing.sm;
  // The screen gradient runs diagonally from primaryDeep to primaryLift; these approximate it across the header band and just above the composer.
  const fades = useMemo(
    () => ({
      top: mixColors(colors.primaryDeep, colors.primary, 0.5),
      bottom: mixColors(colors.primary, colors.primaryLift, 0.3),
    }),
    [colors],
  );

  const limit = remaining === 0 && !sending ? limitLines(allowance, resetsAt) : null;
  const shown = limit && messages[messages.length - 1]?.notice === "limit" ? messages.slice(0, -1) : messages;
  const showPrompts =
    loaded && !sentHere && !sending && limit === null && !selecting.active && promptsEligible(messages, openedAt);

  // Re-applied on every layout change, so the target stays put while bubbles and source rows finish measuring.
  const applyPin = useCallback(() => {
    const target = pin.current;
    const list = listRef.current;
    const m = layout.current;
    if (!target || !list) return;
    if (target === "end") {
      list.scrollToEnd({ animated: false });
      return;
    }
    const cell = m.cells[target.id];
    if (cell === undefined) return;
    const inner = target.n === undefined ? 0 : (m.bubbles[target.id] ?? 0) + (m.sources[target.id]?.[target.n] ?? 0);
    // iOS doesn't clamp a programmatic scroll, so going past the end would leave blank space under the last message.
    const max = Math.max(0, m.content - m.frame);
    list.scrollToOffset({ offset: Math.min(max, Math.max(0, cell + inner - topInset)), animated: true });
  }, [topInset]);

  const onCellLayout = useCallback(
    (id: string, y: number) => {
      layout.current.cells[id] = y;
      applyPin();
    },
    [applyPin],
  );

  useEffect(() => {
    if (!loaded) return;
    const before = seen.current;
    seen.current = new Set(messages.map((m) => m.id));
    const arrived = before && messages.find((m) => m.role === "assistant" && !before.has(m.id));
    if (arrived && arrived.notice !== "limit") {
      pin.current = { id: arrived.id };
      applyPin();
    }
  }, [loaded, messages, applyPin]);

  const sendText = (text: string) => {
    setSentHere(true);
    pin.current = "end";
    void send(text);
  };

  const onSend = () => {
    const text = draft;
    setDraft("");
    sendText(text);
  };

  const onRetry = (id: string) => {
    setSentHere(true);
    pin.current = "end";
    void retry(id);
  };

  // report(id) alone doesn't stop a second tap from sending the same report twice.
  const sendReport = (id: string, onSuccess?: () => void) => {
    if (reportInFlight.current) return;
    reportInFlight.current = true;
    setReporting(true);
    report(id)
      .then(
        () => {
          setToast(REPORT_THANKS);
          onSuccess?.();
        },
        () => setToast(REPORT_FAILED),
      )
      .finally(() => {
        reportInFlight.current = false;
        setReporting(false);
      });
  };

  const onRefPress = (id: string, n: number) => {
    setFocus((f) => ({ id, n, token: (f?.token ?? 0) + 1 }));
    pin.current = { id, n };
    applyPin();
  };

  const onSourceLayout = (id: string, n: number, y: number) => {
    layout.current.sources[id] = { ...layout.current.sources[id], [n]: y };
    applyPin();
  };

  const headerRightItems = (): NativeStackHeaderItem[] => [
    {
      type: "button",
      label: "Close",
      icon: { type: "sfSymbol", name: "xmark" },
      variant: "prominent",
      tintColor: glassTintFor(theme),
      onPress: () => router.back(),
    },
  ];

  const footer = sending ? (
    <TypingBubble />
  ) : !selecting.active && shown.some(isReportable) ? (
    <PressableScale
      variant="button"
      onPress={() => setSelecting({ active: true, selectedId: null })}
      accessibilityRole="button"
      accessibilityLabel="Report a message"
      style={styles.reportLink}
    >
      <Footnote color={colors.textTertiary}>Report a message</Footnote>
    </PressableScale>
  ) : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <ChatHeaderTitle remaining={remaining} allowance={allowance} />,
          unstable_headerRightItems: headerRightItems,
        }}
      />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.fill}>
          <CellLayoutContext.Provider value={onCellLayout}>
            <FlatList
              ref={listRef}
              data={shown}
              keyExtractor={(message) => message.id}
              CellRendererComponent={MeasuredCell}
              ListHeaderComponent={
                <Caption color={colors.textTertiary} style={styles.notice}>
                  {NOTICE}
                </Caption>
              }
              renderItem={({ item, index }) => {
                const ts = timeLineAt(shown, index);
                const line = ts === null ? null : formatTimeLine(ts, new Date());
                const selectable = isReportable(item);
                return (
                  <View style={styles.item}>
                    {line ? (
                      <Caption color={colors.textTertiary} style={styles.timeLine}>
                        <Caption color={colors.textTertiary} style={styles.timeDay}>
                          {line.day}
                        </Caption>
                        {` ${line.time}`}
                      </Caption>
                    ) : null}
                    <View
                      onLayout={(e) => {
                        layout.current.bubbles[item.id] = e.nativeEvent.layout.y;
                      }}
                    >
                      <ChatBubble
                        message={item}
                        allowance={allowance}
                        resetsAt={resetsAt}
                        sourceFocus={focus?.id === item.id ? { n: focus.n, token: focus.token } : null}
                        selection={{
                          active: selecting.active,
                          selectable,
                          selected: selecting.selectedId === item.id,
                          onSelect: () => setSelecting((s) => ({ ...s, selectedId: item.id })),
                        }}
                        onRetry={onRetry}
                        onReport={(id) => sendReport(id)}
                        onRefPress={onRefPress}
                        onSourceLayout={onSourceLayout}
                      />
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={footer}
              // The list sits inside the keyboard wrapper, where iOS doesn't inset it under the transparent header.
              contentInsetAdjustmentBehavior="never"
              contentContainerStyle={[
                styles.list,
                { paddingHorizontal: screenMargin, paddingTop: headerHeight + theme.spacing.lg },
              ]}
              keyboardShouldPersistTaps="handled"
              // Any touch hands scrolling back to the person; a tap that targets something sets a new pin after this.
              onTouchStart={() => {
                pin.current = null;
              }}
              // A drag can start without a touch reaching JS (the scroll indicator, a touch the native menu claims).
              onScrollBeginDrag={() => {
                pin.current = null;
              }}
              onLayout={(e) => {
                layout.current.frame = e.nativeEvent.layout.height;
                applyPin();
              }}
              onContentSizeChange={(_w, h) => {
                layout.current.content = h;
                applyPin();
              }}
            />
          </CellLayoutContext.Provider>
          <LinearGradient
            testID="chat-bottom-fade"
            pointerEvents="none"
            colors={[withOpacity(fades.bottom, 0), fades.bottom]}
            style={styles.bottomFade}
          />
        </View>
        {showPrompts ? <QuickPrompts prompts={prompts} onPick={sendText} /> : null}
        {selecting.active ? (
          <View
            style={[
              styles.selectionBar,
              { paddingHorizontal: screenMargin, paddingBottom: insets.bottom + theme.spacing.sm },
            ]}
          >
            <PressableScale
              variant="button"
              onPress={() => setSelecting({ active: false, selectedId: null })}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.barButton}
            >
              <Body>Cancel</Body>
            </PressableScale>
            <PressableScale
              variant="button"
              disabled={!selecting.selectedId || reporting}
              onPress={() => {
                if (selecting.selectedId) {
                  sendReport(selecting.selectedId, () => setSelecting({ active: false, selectedId: null }));
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Report"
              style={[styles.barButton, (!selecting.selectedId || reporting) && styles.barDisabled]}
            >
              <Body color={colors.danger} style={styles.barReport}>
                Report
              </Body>
            </PressableScale>
          </View>
        ) : (
          <ChatComposer value={draft} onChangeText={setDraft} onSend={onSend} sending={sending} limit={limit} />
        )}
      </KeyboardAvoidingView>
      {/* The header is transparent, so messages would scroll under the title; they fade out first, like Messages. */}
      <LinearGradient
        testID="chat-top-fade"
        pointerEvents="none"
        colors={[fades.top, fades.top, withOpacity(fades.top, 0)]}
        locations={[0, 0.7, 1]}
        style={[styles.topFade, { height: headerHeight + theme.spacing.lg }]}
      />
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

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    fill: { flex: 1 },
    centered: { flex: 1, justifyContent: "center" },
    list: { paddingBottom: spacing.lg, gap: spacing.lg },
    topFade: { position: "absolute", top: 0, left: 0, right: 0 },
    bottomFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: spacing.lg },
    notice: { textAlign: "center", paddingHorizontal: spacing.xl },
    item: { gap: spacing.sm },
    timeLine: { textAlign: "center" },
    timeDay: { fontWeight: "600" },
    reportLink: { alignSelf: "center", paddingVertical: spacing.xs },
    selectionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(colors.white, 0.09),
    },
    barButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
    barDisabled: { opacity: 0.4 },
    barReport: { fontWeight: "600" },
  });
};
