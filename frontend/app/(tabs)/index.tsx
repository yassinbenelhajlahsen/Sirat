// app/(tabs)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline, LargeTitle, Title2 } from "@/components/ui/Text";
import Screen from "@/components/ui/Screen";
import { BREATH_HALF_CYCLE } from "@/constants/motion";
import { getGreeting } from "@/utils/greeting";
import DuaCard from "../../components/DuaCard";
import DuaResultCard from "../../components/DuaResultCard";
import PrayerTimesList from "../../components/PrayerTimesList";
import PressableScale from "../../components/PressableScale";
import { useDuaInteraction } from "../../hooks/useDuaInteraction";
import { useHomePrayerTimes } from "../../hooks/useHomePrayerTimes";
import { useKeyboardAutoScroll } from "../../hooks/useKeyboardAutoScroll";
import useModalTransition from "../../hooks/useModalTransition";

export default function Home() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const router = useRouter();
  const {
    prayerTimes, nextPrayer, nextDayFajr, timeLeft,
    loading, refreshing, banner, locationLabel, refresh,
  } = useHomePrayerTimes();
  const { selectedDua, duaLoading, duaSwapAnim, submitDua, closeDua } = useDuaInteraction();
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
    <Screen>
      <ScrollView
        ref={scrollViewRef}
        onLayout={onScrollViewLayout}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}
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
              <Animated.View style={prayerSummaryAnimatedStyle}>
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
                        pathname: "../[date]",
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

        {/* Prayer list (glass container) */}
        <GlassSurface tier="card" radius={theme.radii.cardLg} style={styles.listCard}>
          <PrayerTimesList loading={loading} prayerTimes={prayerTimes} />
        </GlassSurface>

        {/* Dua section (logic unchanged) */}
        <View style={styles.duaSection} onLayout={onDuaSectionLayout}>
          <Animated.View style={duaCardAnimatedStyle}>
            {selectedDua ? <DuaResultCard dua={selectedDua} onClose={closeDua} /> : <DuaCard onSubmit={handleSubmitDua} loading={duaLoading} />}
          </Animated.View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    scrollContent: { padding: spacing.xl, paddingBottom: 120 },
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
    heroBadgeText: { fontFamily: "SFProDisplay-Bold" },
    listCard: { marginTop: spacing.lg, padding: spacing.lg, minHeight: 320, justifyContent: "center" },
    duaSection: { position: "relative", marginTop: spacing.lg },
  });
};
