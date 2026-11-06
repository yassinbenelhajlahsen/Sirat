// app/(tabs)/index.tsx
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthState } from "@/hooks/useAuthState";
import { useChatStatus } from "@/hooks/useChatStatus";
import { useChatDevBypass } from "@/utils/devChat";
import SignInCard from "@/components/home/SignInCard";
import { shouldShowHomeCard, markHomeCardShown, dismissHomeCard } from "@/services/auth/authPrompts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "@/components/ui/AppIcon";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import SectionHeader from "@/components/ui/SectionHeader";
import { Body, Footnote, Subhead, Title1, Title3 } from "@/components/ui/Text";
import Screen from "@/components/ui/Screen";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { formatWeekdayMonthDay } from "@/utils/formatDate";
import { getGreeting } from "@/utils/greeting";
import { handleTabBarScroll } from "@/utils/tabBarChrome";
import DuaCard from "../../components/DuaCard";
import CopyToast from "../../components/CopyToast";
import DuaResultCard from "../../components/DuaResultCard";
import PrayerDial from "@/components/PrayerDial";
import RamadanCard from "@/components/home/RamadanCard";
import { useRamadanMode } from "@/hooks/useRamadanMode";
import PrayerLogSheet from "@/components/tracking/PrayerLogSheet";
import PressableScale from "../../components/PressableScale";
import { useDuaInteraction } from "../../hooks/useDuaInteraction";
import { usePrayerDay } from "../../hooks/usePrayerDay";
import { useKeyboardAutoScroll } from "../../hooks/useKeyboardAutoScroll";
import { useTrackingStats } from "@/hooks/useTrackingStats";
import { openAppSettings } from "@/utils/openAppSettings";
import { appNow } from "@/utils/devClock";
import { reportDuaMatch } from "@/services/reports";

export default function Home() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const screenMargin = useScreenMargin();

  const router = useRouter();
  const {
    prayerDay, nextPrayer, nextDayFajr, tomorrowFajr, timeLeft, hijri,
    loading, refreshing, error, locationLabel, coords, refresh, retry,
    statuses, logSheet, openLogSheet,
  } = usePrayerDay("today");
  const { ramadanMode } = useRamadanMode();
  const { selectedDua, notice, request, duaLoading, duaSwapAnim, submitDua, closeDua, anotherDua } = useDuaInteraction();
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const hideCopyToast = useCallback(() => setCopyToastVisible(false), []);
  const { scrollViewRef, keyboardHeight, onDuaSectionLayout, onScrollViewLayout } = useKeyboardAutoScroll();

  const handleSubmitDua = useCallback(async (userRequest: string) => {
    await submitDua(userRequest);
    setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 400);
  }, [submitDua, scrollViewRef]);


  const today = appNow();
  const stats = useTrackingStats();

  const { isLoaded, isSignedIn, firstName } = useAuthState();
  const chat = useChatStatus();
  const devChat = useChatDevBypass();
  const askSignedIn = isSignedIn || devChat;
  const askRemaining = askSignedIn ? chat.remaining : null;
  const askRightText = !isLoaded ? null : !askSignedIn ? "Sign in to ask" : askRemaining !== null ? `${askRemaining} left` : null;
  const [showCard, setShowCard] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (isLoaded && !isSignedIn) {
      shouldShowHomeCard().then((show) => {
        if (!mounted) return;
        setShowCard(show);
        if (show) void markHomeCardShown();
      });
    }
    return () => { mounted = false; };
  }, [isLoaded, isSignedIn]);

  const baseGreeting = getGreeting(today);
  const displayName = isSignedIn && firstName && firstName.length < 10 ? firstName : null;
  const gregorianDate = formatWeekdayMonthDay(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowParam = encodeURIComponent(tomorrow.toISOString());

  return (
    <Screen safeArea={false}>
      <ScrollView
        ref={scrollViewRef}
        onLayout={onScrollViewLayout}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          { paddingHorizontal: screenMargin },
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 120 },
          keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
        onScroll={handleTabBarScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        {!!error && (
          <GlassSurface tier="row" radius={theme.radii.row} style={styles.bannerCard} accessibilityRole="alert">
            <View style={styles.bannerRow}>
              <AppIcon name="alert-circle" size={18} color={colors.accent} />
              <Footnote color={colors.white} style={styles.bannerText}>{error.message}</Footnote>
            </View>
            <View style={styles.bannerActions}>
              <Button
                label="Try again"
                variant="secondary"
                size="sm"
                icon="refresh"
                onPress={retry}
                accessibilityLabel="Retry loading prayer times"
              />
              {error.code === "LOCATION" ? (
                <Button
                  label="Open Settings"
                  variant="secondary"
                  size="sm"
                  onPress={openAppSettings}
                  accessibilityLabel="Open app settings"
                />
              ) : null}
            </View>
          </GlassSurface>
        )}

        {showCard && !isSignedIn && (
          <View style={styles.signInCardSlot}>
            <SignInCard
              onPress={() => router.push("/SignIn")}
              onDismiss={() => {
                setShowCard(false);
                void dismissHomeCard();
              }}
            />
          </View>
        )}

        {/* Header hero: the greeting and the Hijri date carry the top of the
            screen now that the next prayer lives in the dial's centre. */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Title1 numberOfLines={2}>
              {displayName ? `${baseGreeting}, ${displayName}` : baseGreeting}
            </Title1>
            <Title3 color={colors.accent} numberOfLines={1} style={styles.headerHijri}>
              {hijri}
            </Title3>
            <Footnote color={colors.textTertiary} style={styles.headerDate}>
              {locationLabel ? `${gregorianDate} · ${locationLabel}` : gregorianDate}
            </Footnote>
          </View>
          <IconButton
            icon="settings-outline"
            variant="glass"
            iconSize={20}
            onPress={() => router.push("/Settings")}
            accessibilityLabel="Open settings"
          />
        </View>

        {/* Prayer dial (owns its own glass card, and is now the screen's hero) */}
        <View style={styles.dialSlot}>
          <PrayerDial
            loading={loading}
            prayerDay={prayerDay}
            nextPrayer={nextPrayer}
            timeLeft={timeLeft}
            tomorrowFajr={nextDayFajr}
            coords={coords}
            logging
            statuses={statuses}
            onPressPrayer={openLogSheet}
            onPressCentre={
              !nextPrayer && nextDayFajr
                ? () =>
                    router.push({
                      pathname: "/Calendar",
                      params: {
                        date: tomorrowParam,
                        month: tomorrow.getMonth().toString(),
                        year: tomorrow.getFullYear().toString(),
                      },
                    })
                : undefined
            }
          />
        </View>

        <View style={styles.ramadanSlot}>
          <RamadanCard
            enabled={ramadanMode}
            prayerDay={prayerDay}
            tomorrowFajr={tomorrowFajr}
            onLogMissedFast={() =>
              router.push({
                pathname: "/Calendar",
                params: {
                  date: encodeURIComponent(today.toISOString()),
                  month: today.getMonth().toString(),
                  year: today.getFullYear().toString(),
                },
              })
            }
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Tracker" />
          <PressableScale
            variant="row"
            radius={theme.radii.row}
            onPress={() => router.push("/Tracker")}
            accessibilityRole="button"
            accessibilityLabel="View tracker and habits"
          >
            <GlassSurface tier="row" radius={theme.radii.row} style={styles.affordanceRow}>
              <Text style={styles.flame} maxFontSizeMultiplier={1.2}>🔥</Text>
              <Body style={styles.affordanceLabel}>{`${stats?.streak ?? 0} day streak`}</Body>
              <Subhead color={colors.textTertiary}>Tracker &amp; habits</Subhead>
            </GlassSurface>
          </PressableScale>
        </View>

        {chat.visible && (
          <View style={styles.section}>
            <SectionHeader title="Ask" />
            <PressableScale
              variant="row"
              radius={theme.radii.row}
              onPress={() => router.push(askSignedIn ? "/Chat" : { pathname: "/SignIn", params: { next: "Chat" } })}
              accessibilityRole="button"
              accessibilityLabel={askRemaining !== null ? `Ask a question, ${askRemaining} messages left` : "Ask a question"}
            >
              <GlassSurface tier="row" radius={theme.radii.row} style={styles.affordanceRow}>
                <AppIcon name="chatbubble-ellipses-outline" size={20} color={colors.accent} />
                <Body style={styles.affordanceLabel}>Ask a question</Body>
                {askRightText !== null && <Subhead color={colors.textTertiary}>{askRightText}</Subhead>}
              </GlassSurface>
            </PressableScale>
          </View>
        )}

        {/* Dua section (logic unchanged) */}
        <View style={styles.section} onLayout={onDuaSectionLayout}>
          <SectionHeader
            title="Dua"
            actionLabel="See all"
            onActionPress={() => router.push("/Duas")}
            actionAccessibilityLabel="Browse duas"
          />
          <Animated.View
            style={{
              opacity: duaSwapAnim,
              transform: [
                { translateY: duaSwapAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                { scale: duaSwapAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            }}
          >
            {selectedDua ? <DuaResultCard dua={selectedDua} onClose={closeDua} onAnother={anotherDua} notice={notice} onBrowse={() => router.push("/Duas")} onCopied={() => setCopyToastVisible(true)} onReport={request ? () => reportDuaMatch(request, selectedDua.id) : undefined} /> : <DuaCard onSubmit={handleSubmitDua} loading={duaLoading} />}
          </Animated.View>
        </View>
      </ScrollView>
      <PrayerLogSheet {...logSheet} />
      <CopyToast visible={copyToastVisible} onHide={hideCopyToast} placement="top" topOffset={insets.top} />
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    bannerCard: { padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm },
    bannerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    bannerText: { flex: 1 },
    bannerActions: { flexDirection: "row", gap: spacing.sm, alignSelf: "flex-start" },
    headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
    headerText: { flex: 1 },
    headerHijri: { marginTop: spacing.xs },
    headerDate: { marginTop: 2 },
    dialSlot: { marginTop: spacing.xl },
    ramadanSlot: { marginTop: spacing.lg },
    section: { marginTop: spacing.xxl },
    affordanceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
    },
    affordanceLabel: { flex: 1 },
    flame: { fontSize: 17 },
    signInCardSlot: { marginBottom: spacing.md },
  });
};
