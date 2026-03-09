// app/(tabs)/index.tsx
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Animated,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    prayerTimes,
    nextPrayer,
    nextDayFajr,
    timeLeft,
    loading,
    refreshing,
    banner,
    locationLabel,
    refresh,
  } = useHomePrayerTimes();
  const { selectedDua, duaLoading, duaSwapAnim, submitDua, closeDua } =
    useDuaInteraction();
  const { scrollViewRef, keyboardHeight, onDuaSectionLayout, onScrollViewLayout } = useKeyboardAutoScroll();
  const hasPrayerSummary = !!(nextPrayer || nextDayFajr);
  const {
    shouldRender: shouldRenderPrayerSummary,
    cardAnimatedStyle: prayerSummaryAnimatedStyle,
  } = useModalTransition(hasPrayerSummary);

  const onRefresh = async () => {
    await refresh();
  };

  const today = new Date();
  const gregorianDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);
  const islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowParam = encodeURIComponent(tomorrow.toISOString());
  const duaCardAnimatedStyle = {
    opacity: duaSwapAnim,
    transform: [
      {
        translateY: duaSwapAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
      {
        scale: duaSwapAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  return (
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={styles.patternOverlay}
      />

      <View style={styles.screen}>
        <SafeAreaView style={styles.screen}>
          <ScrollView
            ref={scrollViewRef}
            onLayout={onScrollViewLayout}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scrollContent, keyboardHeight > 0 && { paddingBottom: keyboardHeight}]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                title="Refreshing…"
                titleColor={colors.accent}
              />
            }
          >
            {!!banner && (
              <View style={styles.bannerCard}>
                <Text style={styles.bannerText}>{banner}</Text>
              </View>
            )}

            <View style={styles.headerSection}>
              <Text style={styles.sectionTitle}>Prayer Times</Text>

              {locationLabel ? (
                <Text style={styles.locationLabel}>{locationLabel}</Text>
              ) : null}

              <View style={styles.dateSection}>
                <Text style={styles.gregorianDate}>{gregorianDate}</Text>
                <Text style={styles.hijriDate}>{islamicDate}</Text>
              </View>
            </View>

            {(loading || shouldRenderPrayerSummary || hasPrayerSummary) && (
              <View style={styles.nextPrayerContainer}>
                <View style={styles.nextPrayerSlot}>
                  {shouldRenderPrayerSummary ? (
                    <Animated.View
                      style={[
                        styles.nextPrayerAnimatedWrap,
                        prayerSummaryAnimatedStyle,
                      ]}
                    >
                      {nextPrayer ? (
                        <View style={styles.nextPrayerCard}>
                          <Text style={styles.nextPrayerLabel}>
                            Next Prayer
                          </Text>
                          <View style={styles.nextPrayerRow}>
                            <Text style={styles.nextPrayerName}>
                              {nextPrayer.label}
                            </Text>
                            <Text style={styles.nextPrayerTime}>
                              {nextPrayer.time}
                            </Text>
                          </View>
                          <Text style={styles.nextPrayerCountdown}>
                            Starts in {timeLeft}
                          </Text>
                        </View>
                      ) : nextDayFajr ? (
                        <PressableScale
                          onPress={() =>
                            router.push({
                              pathname: "../[date]",
                              params: {
                                date: tomorrowParam,
                                month: tomorrow.getMonth().toString(),
                                year: tomorrow.getFullYear().toString(),
                              },
                            })
                          }
                          style={styles.tomorrowCardButton}
                          accessibilityRole="button"
                          accessibilityLabel="View tomorrow prayer times"
                        >
                          <Text style={styles.finishedTitle}>
                            Finished all prayers!
                          </Text>
                          <Text style={styles.finishedSubtitle}>
                            Tap to see tomorrow&apos;s prayer times
                          </Text>
                        </PressableScale>
                      ) : null}
                    </Animated.View>
                  ) : null}
                </View>
              </View>
            )}

            <View style={styles.prayerListCard}>
              <PrayerTimesList loading={loading} prayerTimes={prayerTimes} />
            </View>
            {/* Dua Section */}
            <View style={styles.duaSection} onLayout={onDuaSectionLayout}>
              <Animated.View style={duaCardAnimatedStyle}>
                {selectedDua ? (
                  <DuaResultCard dua={selectedDua} onClose={closeDua} />
                ) : (
                  <DuaCard onSubmit={submitDua} loading={duaLoading} />
                )}
              </Animated.View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </LinearGradient>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, typography } = theme;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    screen: { flex: 1 },
    patternOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.05,
      resizeMode: "repeat",
      width: "100%",
      height: "100%",
    },
    scrollContent: {
      padding: spacing.xl,
      paddingBottom: 80,
    },
    bannerCard: {
      backgroundColor: colors.primaryLift,
      borderColor: colors.accent,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg - 2,
      marginBottom: spacing.lg,
    },
    bannerText: {
      color: colors.accent,
      fontFamily: "SFProDisplay-Semibold",
      fontSize: typography.body,
    },
    headerSection: {
      marginTop: spacing.sm,
      alignItems: "center",
    },
    eyebrow: {
      color: withOpacity(colors.accent, 0.9),
      fontSize: typography.caption,
      fontFamily: "SFProDisplay-Semibold",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    sectionTitle: {
      color: colors.white,
      fontSize: 32,
      fontFamily: "SFProDisplay-Bold",
      marginTop: spacing.xs,
    },
    locationLabel: {
      color: colors.accent,
      fontSize: typography.bodyLg,
      fontFamily: "SFProDisplay-Semibold",
      marginTop: spacing.xs,
      textAlign: "center",
    },
    dateSection: {
      marginTop: spacing.md,
      alignItems: "center",
    },
    gregorianDate: {
      color: colors.white,
      fontSize: typography.bodyLg,
      fontFamily: "SFProDisplay-Bold",
      textAlign: "center",
    },
    hijriDate: {
      color: colors.accent,
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Semibold",
      marginTop: spacing.xs,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    prayerListCard: {
      marginTop: spacing.md,
      backgroundColor: isLight
        ? withOpacity(colors.primarySurfaceAlt, 0.3)
        : withOpacity(colors.black, 0.2),
      borderRadius: 18,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(colors.accent, 0.35)
        : withOpacity(colors.white, 0.08),
      shadowColor: colors.primaryDark,
      shadowOpacity: isLight ? 0.22 : 0.25,
      shadowRadius: isLight ? 20 : 24,
      shadowOffset: { width: 0, height: isLight ? 10 : 16 },
      elevation: isLight ? 4 : 6,
      minHeight: 320,
      justifyContent: "center",
    },
    nextPrayerContainer: {
      alignItems: "center",
      marginBottom: -2,
    },
    nextPrayerSlot: {
      width: "100%",
    },
    nextPrayerAnimatedWrap: {
      width: "100%",
    },
    nextPrayerCard: {
      width: "100%",
      backgroundColor: withOpacity(colors.primarySurfaceAlt, 0.3),
      borderRadius: 16,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.35),
      shadowColor: colors.primaryDark,
      shadowOpacity: 0.22,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
      justifyContent: "center",
    },
    tomorrowCardButton: {
      backgroundColor: withOpacity(colors.primarySurfaceAlt, 0.25),
      borderRadius: 12,
      paddingVertical: 18,
      paddingHorizontal: 24,
      borderWidth: 2,
      borderColor: withOpacity(colors.accent, 0.75),
      shadowColor: colors.accent,
      shadowOpacity: 0.6,
      shadowRadius: 4,
      elevation: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    nextPrayerLabel: {
      color: withOpacity(colors.accent, 0.95),
      fontSize: typography.caption,
      fontFamily: "SFProDisplay-Semibold",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    nextPrayerRow: {
      marginTop: spacing.xs,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    nextPrayerName: {
      color: colors.white,
      fontSize: typography.title,
      fontFamily: "SFProDisplay-Bold",
    },
    nextPrayerTime: {
      color: colors.accent,
      fontSize: typography.bodyLg,
      fontFamily: "SFProDisplay-Bold",
    },
    nextPrayerCountdown: {
      marginTop: spacing.xs,
      color: withOpacity(colors.white, 0.9),
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Semibold",
    },
    finishedTitle: {
      color: colors.accent,
      fontSize: typography.subtitle,
      fontFamily: "SFProDisplay-Bold",
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    finishedSubtitle: {
      color: colors.white,
      fontSize: typography.bodyLg,
      fontFamily: "SFProDisplay-Semibold",
      textAlign: "center",
    },
    duaSection: {
      position: "relative",
      marginTop: spacing.xs,
    },
  });
};
