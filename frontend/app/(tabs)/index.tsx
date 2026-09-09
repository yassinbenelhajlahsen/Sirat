// app/(tabs)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthState } from "@/hooks/useAuthState";
import SignInCard from "@/components/home/SignInCard";
import { shouldShowHomeCard, markHomeCardShown, dismissHomeCard } from "@/services/auth/authPrompts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import SkeletonBar from "@/components/ui/SkeletonBar";
import { Caption, Footnote, Headline, LargeTitle, Title2 } from "@/components/ui/Text";
import Screen from "@/components/ui/Screen";
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

export default function Home() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

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

  return (
    <Screen safeArea={false}>
      <ScrollView
        ref={scrollViewRef}
        onLayout={onScrollViewLayout}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 120 },
          keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
        onScroll={handleTabBarScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} title="Refreshing…" titleColor={colors.accent} />
        }
      >
        {!!banner && (
          <GlassSurface tier="row" radius={theme.radii.row} style={styles.bannerCard} accessibilityRole="alert">
            <View style={styles.bannerRow}>
              <Ionicons name="alert-circle" size={18} color={colors.accent} />
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

        {/* Header: greeting + location + settings gear */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Caption color={colors.accent} style={styles.eyebrow}>{islamicDate}</Caption>
            <LargeTitle>{displayName ? `${baseGreeting},` : baseGreeting}</LargeTitle>
            {displayName && <LargeTitle>{displayName}.</LargeTitle>}
            {locationLabel ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Headline color={colors.textSecondary}>{locationLabel}</Headline>
              </View>
            ) : null}
          </View>
          <IconButton
            icon="settings-outline"
            variant="glass"
            iconSize={20}
            onPress={() => router.push("/Settings")}
            accessibilityLabel="Open settings"
          />
        </View>

        {/* Hero next-prayer card */}
        {(loading || shouldRenderPrayerSummary || hasPrayerSummary) && (
          <View style={styles.heroSlot}>
            {shouldRenderPrayerSummary ? (
              <Animated.View style={[prayerSummaryAnimatedStyle, { opacity: 1 }]}>
                {nextPrayer ? (
                  <GlassSurface tier="card" radius={theme.radii.heroLg} style={styles.heroCard}>
                    <View style={styles.heroTextCol}>
                      <Caption color={colors.textTertiary} style={styles.heroLabel}>UP NEXT</Caption>
                      <Title2>{nextPrayer.label}</Title2>
                      <Headline color={colors.accent}>{nextPrayer.time}</Headline>
                    </View>
                    <View style={styles.heroBadge}>
                      <Caption color={colors.onAccent} style={styles.heroBadgeText}>in {timeLeft}</Caption>
                    </View>
                  </GlassSurface>
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
                  >
                    <GlassSurface tier="card" radius={theme.radii.heroLg} style={styles.heroCard}>
                      <View style={styles.heroTextCol}>
                        <Title2 color={colors.accent}>All prayer times have passed</Title2>
                        <Headline color={colors.textSecondary}>Tap to see tomorrow&apos;s prayer times</Headline>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} />
                    </GlassSurface>
                  </PressableScale>
                ) : null}
              </Animated.View>
            ) : loading ? (
              <GlassSurface
                tier="card"
                radius={theme.radii.heroLg}
                style={styles.heroCard}
                accessible
                accessibilityLabel="Loading prayer times"
              >
                <View style={styles.heroTextCol}>
                  <SkeletonBar height={12} width={64} />
                  <SkeletonBar height={22} width={120} />
                  <SkeletonBar height={16} width={88} />
                </View>
                <SkeletonBar height={32} width={84} />
              </GlassSurface>
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
          <PressableScale
            onPress={() => router.push("/Tracker")}
            accessibilityRole="button"
            accessibilityLabel="View tracker and habits"
            style={styles.trackerRow}
          >
            <View style={styles.streakChip}>
              <Text style={styles.flame} maxFontSizeMultiplier={1.2}>🔥</Text>
              <Caption color={colors.accent} style={styles.streakChipText}>
                {stats?.streak ?? 0} day streak
              </Caption>
            </View>
            <View style={styles.trackerLink}>
              <Caption color={colors.textSecondary}>View tracker &amp; habits</Caption>
              <Ionicons name="chevron-forward" size={14} color={colors.iconMuted} />
            </View>
          </PressableScale>
        </View>

        {/* Dua section (logic unchanged) */}
        <View style={styles.duaSection} onLayout={onDuaSectionLayout}>
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
  const { colors, spacing } = theme;
  return StyleSheet.create({
    scrollContent: { paddingHorizontal: spacing.xl },
    bannerCard: { padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm },
    bannerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    bannerText: { flex: 1 },
    bannerAction: { alignSelf: "flex-start" },
    headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: spacing.sm },
    headerText: { flex: 1, paddingRight: spacing.md },
    eyebrow: { letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.xs },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.sm },
    heroSlot: { marginTop: spacing.xl },
    heroCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: spacing.xl,
      shadowColor: colors.black, shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 12 },
    },
    heroTextCol: { gap: 4, flexShrink: 1 },
    heroLabel: { letterSpacing: 0.5 },
    heroBadge: {
      backgroundColor: colors.accent, borderRadius: theme.radii.pill,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center",
    },
    heroBadgeText: { fontWeight: "700" },
    arcSlot: { marginTop: spacing.lg },
    trackerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.xs,
    },
    streakChip: { flexDirection: "row", alignItems: "center", gap: 4 },
    streakChipText: { fontWeight: "700" },
    flame: { fontSize: 13 },
    trackerLink: { flexDirection: "row", alignItems: "center", gap: 2 },
    duaSection: { position: "relative", marginTop: spacing.lg },
    signInCardSlot: { marginTop: spacing.md },
  });
};
