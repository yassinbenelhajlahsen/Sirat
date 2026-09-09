// app/(tabs)/index.tsx
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthState } from "@/hooks/useAuthState";
import SignInCard from "@/components/home/SignInCard";
import { shouldShowHomeCard, markHomeCardShown, dismissHomeCard } from "@/services/auth/authPrompts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "@/components/ui/AppIcon";
import Button from "@/components/ui/Button";
import DisplayNumber from "@/components/ui/DisplayNumber";
import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import SectionHeader from "@/components/ui/SectionHeader";
import SkeletonBar from "@/components/ui/SkeletonBar";
import { AppText, Body, Footnote, Headline, Subhead, Title3 } from "@/components/ui/Text";
import Screen from "@/components/ui/Screen";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { getGreeting } from "@/utils/greeting";
import { handleTabBarScroll } from "@/utils/tabBarChrome";
import DuaCard from "../../components/DuaCard";
import DuaResultCard from "../../components/DuaResultCard";
import PrayerArc from "@/components/PrayerArc";
import PrayerLogSheet from "@/components/tracking/PrayerLogSheet";
import PressableScale from "../../components/PressableScale";
import { useDuaInteraction } from "../../hooks/useDuaInteraction";
import { useHomePrayerTimes } from "../../hooks/useHomePrayerTimes";
import { useKeyboardAutoScroll } from "../../hooks/useKeyboardAutoScroll";
import useModalTransition from "../../hooks/useModalTransition";
import { usePrayerLog } from "@/hooks/usePrayerLog";
import { useTrackingStats } from "@/hooks/useTrackingStats";
import { dateKeyFromDate } from "@/services/holidayService";
import type { PrayerName } from "@/services/prayerTracker";

// "5:42 PM" → "5:42": the period is implied by the greeting and the arc.
function bareTime(time: string): string {
  return time.split(" ")[0] ?? time;
}

export default function Home() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const screenMargin = useScreenMargin();

  const router = useRouter();
  const {
    prayerTimes, nextPrayer, nextDayFajr, timeLeft,
    loading, refreshing, banner, locationLabel, refresh,
  } = useHomePrayerTimes();
  const { selectedDua, duaLoading, duaSwapAnim, submitDua, closeDua, anotherDua } = useDuaInteraction();
  const { scrollViewRef, keyboardHeight, onDuaSectionLayout, onScrollViewLayout } = useKeyboardAutoScroll();

  const handleSubmitDua = useCallback(async (userRequest: string) => {
    await submitDua(userRequest);
    setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 400);
  }, [submitDua, scrollViewRef]);

  const hasPrayerSummary = !!(nextPrayer || nextDayFajr);
  const { shouldRender: shouldRenderPrayerSummary, cardAnimatedStyle: prayerSummaryAnimatedStyle } =
    useModalTransition(hasPrayerSummary);

  const onRefresh = async () => { await refresh(); };

  const today = new Date();
  const todayKey = dateKeyFromDate(today);
  const { statuses, setStatus, clearStatus } = usePrayerLog(todayKey);
  const stats = useTrackingStats();
  const [sheet, setSheet] = useState<{ name: PrayerName; label: string } | null>(null);

  const { isLoaded, isSignedIn, firstName } = useAuthState();
  const [showCard, setShowCard] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (isLoaded && !isSignedIn) {
      shouldShowHomeCard().then((show) => {
        if (!mounted) return;
        if (show) {
          setShowCard(true);
          void markHomeCardShown();
        }
      });
    }
    return () => { mounted = false; };
  }, [isLoaded, isSignedIn]);

  const baseGreeting = getGreeting(today);
  const displayName = isSignedIn && firstName && firstName.length < 10 ? firstName : null;
  const islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric", month: "long", year: "numeric",
  }).format(today);
  const gregorianDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
  }).format(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowParam = encodeURIComponent(tomorrow.toISOString());

  const duaCardAnimatedStyle = {
    opacity: duaSwapAnim,
    transform: [
      { translateY: duaSwapAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: duaSwapAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  };

  const heroLocation = locationLabel ? (
    <View style={styles.heroLocation}>
      <Subhead color={colors.textTertiary}>{locationLabel}</Subhead>
    </View>
  ) : null;

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {!!banner && (
          <GlassSurface tier="row" radius={theme.radii.row} style={styles.bannerCard} accessibilityRole="alert">
            <View style={styles.bannerRow}>
              <AppIcon name="alert-circle" size={18} color={colors.accent} />
              <Footnote color={colors.white} style={styles.bannerText}>{banner}</Footnote>
            </View>
            <Button
              label="Try again"
              variant="secondary"
              size="sm"
              icon="refresh"
              onPress={onRefresh}
              accessibilityLabel="Retry loading prayer times"
              style={styles.bannerAction}
            />
          </GlassSurface>
        )}

        {showCard && (
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

        {/* Header: greeting, one dated supporting line, settings gear */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Headline numberOfLines={1}>
              {displayName ? `${baseGreeting}, ${displayName}` : baseGreeting}
            </Headline>
            <Footnote color={colors.textTertiary} style={styles.headerDate}>
              {`${gregorianDate} · ${islamicDate} AH`}
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

        {/* Next prayer, bare on the canvas */}
        {(loading || shouldRenderPrayerSummary || hasPrayerSummary) && (
          <View style={styles.heroSlot}>
            {shouldRenderPrayerSummary ? (
              <Animated.View style={[prayerSummaryAnimatedStyle, { opacity: 1 }]}>
                {nextPrayer ? (
                  <View style={styles.hero}>
                    <View style={styles.heroTitleRow}>
                      <Title3 color={colors.accent}>{nextPrayer.label}</Title3>
                      {timeLeft ? (
                        <AppText variant="title3" color={colors.textSecondary} style={styles.heroCountdown}>
                          {`in ${timeLeft}`}
                        </AppText>
                      ) : null}
                    </View>
                    <DisplayNumber value={bareTime(nextPrayer.time)} size={72} flush />
                    {heroLocation}
                  </View>
                ) : nextDayFajr ? (
                  <PressableScale
                    onPress={() =>
                      router.push({
                        pathname: "/Calendar",
                        params: { date: tomorrowParam, month: tomorrow.getMonth().toString(), year: tomorrow.getFullYear().toString() },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel="View tomorrow prayer times"
                    style={styles.hero}
                  >
                    <Title3 color={colors.accent}>Prayers done for today</Title3>
                    <Headline color={colors.textSecondary}>
                      {`Fajr tomorrow at ${bareTime(nextDayFajr)}`}
                    </Headline>
                    {heroLocation}
                  </PressableScale>
                ) : null}
              </Animated.View>
            ) : loading ? (
              <View style={styles.hero} accessible accessibilityLabel="Loading prayer times">
                <SkeletonBar height={20} width={160} />
                <SkeletonBar height={56} width={200} />
                <SkeletonBar height={16} width={120} />
              </View>
            ) : null}
          </View>
        )}

        {/* Prayer arc (owns its own glass card) */}
        <View style={styles.arcSlot}>
          <PrayerArc
            loading={loading}
            prayerTimes={prayerTimes}
            nextPrayer={nextPrayer}
            logging
            statuses={statuses}
            onPressPrayer={(name, label) => setSheet({ name, label })}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Tracker" />
          <PressableScale
            variant="row"
            onPress={() => router.push("/Tracker")}
            accessibilityRole="button"
            accessibilityLabel="View tracker and habits"
          >
            <GlassSurface tier="row" radius={theme.radii.row} style={styles.trackerRow}>
              <Text style={styles.flame} maxFontSizeMultiplier={1.2}>🔥</Text>
              <Body style={styles.trackerLabel}>{`${stats?.streak ?? 0} day streak`}</Body>
              <Subhead color={colors.textTertiary}>Tracker &amp; habits</Subhead>
              <AppIcon name="chevron-forward" size={14} color={colors.iconMuted} />
            </GlassSurface>
          </PressableScale>
        </View>

        {/* Dua section (logic unchanged) */}
        <View style={styles.section} onLayout={onDuaSectionLayout}>
          <SectionHeader title="Dua" />
          <Animated.View style={duaCardAnimatedStyle}>
            {selectedDua ? <DuaResultCard dua={selectedDua} onClose={closeDua} onAnother={anotherDua} /> : <DuaCard onSubmit={handleSubmitDua} loading={duaLoading} />}
          </Animated.View>
        </View>
      </ScrollView>
      <PrayerLogSheet
        visible={sheet !== null}
        prayerName={sheet?.name ?? null}
        prayerLabel={sheet?.label ?? ""}
        currentStatus={sheet ? statuses[sheet.name] : undefined}
        onSelect={(s) => { if (sheet) setStatus(sheet.name, s); setSheet(null); }}
        onClear={() => { if (sheet) clearStatus(sheet.name); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    bannerCard: { padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm },
    bannerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    bannerText: { flex: 1 },
    bannerAction: { alignSelf: "flex-start" },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    headerText: { flex: 1 },
    headerDate: { marginTop: 2 },
    heroSlot: { marginTop: spacing.xxl },
    hero: { gap: spacing.xs },
    heroTitleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexWrap: "wrap" },
    heroCountdown: { fontWeight: "400" },
    heroLocation: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    arcSlot: { marginTop: spacing.xxl },
    section: { marginTop: spacing.xxl },
    trackerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
    },
    trackerLabel: { flex: 1 },
    flame: { fontSize: 17 },
    signInCardSlot: { marginBottom: spacing.md },
  });
};
