// app/(tabs)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthState } from "@/hooks/useAuthState";
import SignInCard from "@/components/home/SignInCard";
import { shouldShowHomeCard, markHomeCardShown, dismissHomeCard } from "@/services/auth/authPrompts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline, LargeTitle, Title2 } from "@/components/ui/Text";
import Screen from "@/components/ui/Screen";
import { BREATH_HALF_CYCLE } from "@/constants/motion";
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

  const { isLoaded, isSignedIn } = useAuthState();
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

  const greeting = getGreeting(today);
  const islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric", month: "long", year: "numeric",
  }).format(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowParam = encodeURIComponent(tomorrow.toISOString());

  // Breathing pulse on the hero badge (scale only — never animate opacity of glass).
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: BREATH_HALF_CYCLE, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: BREATH_HALF_CYCLE, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

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
          <GlassSurface tier="row" radius={theme.radii.row} style={styles.bannerCard}>
            <Headline color={colors.accent}>{banner}</Headline>
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
            <LargeTitle>{greeting}</LargeTitle>
            {locationLabel ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={withOpacity(colors.white, 0.6)} />
                <Headline color={withOpacity(colors.white, 0.7)} style={styles.locationText}>{locationLabel}</Headline>
              </View>
            ) : null}
          </View>
          <PressableScale
            onPress={() => router.push("/Settings")}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <GlassSurface tier="chrome" radius={22} style={styles.gear}>
              <Ionicons name="settings-outline" size={20} color={withOpacity(colors.white, 0.85)} />
            </GlassSurface>
          </PressableScale>
        </View>

        {/* Hero next-prayer card */}
        {(loading || shouldRenderPrayerSummary || hasPrayerSummary) && (
          <View style={styles.heroSlot}>
            {shouldRenderPrayerSummary ? (
              <Animated.View style={[prayerSummaryAnimatedStyle, { opacity: 1 }]}>
                {nextPrayer ? (
                  <GlassSurface tier="card" radius={theme.radii.heroLg} style={styles.heroCard}>
                    <View style={styles.heroTextCol}>
                      <Caption color={withOpacity(colors.white, 0.55)} style={styles.heroLabel}>UP NEXT</Caption>
                      <Title2>{nextPrayer.label}</Title2>
                      <Headline color={colors.accent}>{nextPrayer.time}</Headline>
                    </View>
                    <Animated.View style={[styles.heroBadge, { transform: [{ scale: breathScale }] }]}>
                      <Caption color={colors.onAccent} style={styles.heroBadgeText}>in {timeLeft}</Caption>
                    </Animated.View>
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
                        <Title2 color={colors.accent}>Finished all prayers!</Title2>
                        <Headline color={withOpacity(colors.white, 0.85)}>Tap to see tomorrow&apos;s prayer times</Headline>
                      </View>
                    </GlassSurface>
                  </PressableScale>
                ) : null}
              </Animated.View>
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
              <Text style={styles.flame}>🔥</Text>
              <Caption color={colors.accent} style={styles.streakChipText}>
                {stats?.streak ?? 0} day streak
              </Caption>
            </View>
            <Caption color={withOpacity(colors.white, 0.7)}>View tracker &amp; habits →</Caption>
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
    bannerCard: { padding: spacing.md, marginBottom: spacing.lg },
    headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: spacing.sm },
    headerText: { flex: 1, paddingRight: spacing.md },
    eyebrow: { letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.xs },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.sm },
    locationText: {},
    gear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    heroSlot: { marginTop: spacing.xl },
    heroCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: spacing.xl,
      shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 12 },
    },
    heroTextCol: { gap: 4 },
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
      marginTop: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    streakChip: { flexDirection: "row", alignItems: "center", gap: 4 },
    streakChipText: { fontWeight: "700" },
    flame: { fontSize: 13 },
    duaSection: { position: "relative", marginTop: spacing.lg },
    signInCardSlot: { marginTop: spacing.md },
  });
};
