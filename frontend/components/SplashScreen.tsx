import { darkTheme, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import SplashAtmosphere from "@/components/SplashAtmosphere";
import Aurora from "@/components/ui/Aurora";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import hadiths from "../assets/data/hadiths.json";

const LAST_SPLASH_KEY = "lastSplashDate";

/**
 * The wordmark sits at a fixed fraction of the screen height rather than in a
 * flex slot, so it lands in exactly the same place whether or not the hadith is
 * present. A repeat launch is then the same screen with the passage removed,
 * not a differently-composed one.
 */
const WORDMARK_TOP_RATIO = 0.3;

/** How long the splash holds before dissolving, once the app is ready. */
const DWELL_WITH_PASSAGE_MS = 1600;
const DWELL_PLAIN_MS = 600;

type Props = {
  // When true, start the fade out and call onFinished at the end
  ready: boolean;
  // Called once the React splash is laid out so we can hide the native screen safely
  onReadyToHideNative?: () => void;
  // Called after fade out completes so parent can render the app
  onFinished?: () => void;
};

export default function SplashScreen({
  ready,
  onReadyToHideNative,
  onFinished,
}: Props) {
  const { theme, isHydrated } = useTheme();
  const splashTheme = isHydrated ? theme : darkTheme;
  const themeColors = splashTheme.colors;
  const styles = useMemo(() => createStyles(splashTheme), [splashTheme]);
  const screenMargin = useScreenMargin();
  const { height } = useWindowDimensions();

  const [hadith, setHadith] = useState<{
    arabic: string;
    english: string;
    source: string;
  } | null>(null);
  const [isFirstLaunchToday, setIsFirstLaunchToday] = useState(false);

  // The screen has no entrance animation: it is composed when you see it. The
  // only animated value is the dissolve into the app, so the handoff isn't a
  // hard cut. Opaque at start so nothing beneath shows through.
  const opacity = useRef(new Animated.Value(1)).current;
  const startedAtMs = useRef(Date.now());

  // Check if this is the first launch today
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const today = new Date().toDateString();
        const lastSplash = await AsyncStorage.getItem(LAST_SPLASH_KEY);

        if (lastSplash !== today) {
          setIsFirstLaunchToday(true);
          await AsyncStorage.setItem(LAST_SPLASH_KEY, today);
        }
      } catch (error) {
        // If error, default to shorter splash
        console.log("Error checking first launch:", error);
      }
    };

    checkFirstLaunch();
  }, []);

  // Pick today's hadith deterministically
  useEffect(() => {
    I18nManager.allowRTL(true);
    const day = new Date().getDate();
    const today = (hadiths as any[]).find((h) => h.day === day) || null;
    setHadith(today);
  }, []);

  // The passage is the first launch of the day only. Every launch after that is
  // the masthead alone.
  const showPassage = isFirstLaunchToday && hadith !== null;

  // Dissolve out once the app is ready, after holding long enough to read
  useEffect(() => {
    if (!ready) return;
    const dwellMs = isFirstLaunchToday ? DWELL_WITH_PASSAGE_MS : DWELL_PLAIN_MS;
    const elapsed = Date.now() - startedAtMs.current;

    const timeout = setTimeout(
      () => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: isFirstLaunchToday ? 360 : 220,
          easing: Easing.bezier(0.4, 0, 1, 1), // iOS fade-out easing
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && onFinished) onFinished();
        });
      },
      Math.max(0, dwellMs - elapsed),
    );
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isFirstLaunchToday]);

  // Hide native splash once this component has a frame on screen
  const handleLayout = (_e: LayoutChangeEvent) => {
    onReadyToHideNative?.();
  };

  const hijriDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  return (
    <LinearGradient
      colors={[
        themeColors.primaryDeep,
        themeColors.primary,
        themeColors.primaryLift,
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
      onLayout={handleLayout}
      testID="splash-root"
    >
      {/* Ambient aurora background, then the splash-only atmosphere on top */}
      <Aurora />
      <SplashAtmosphere />

      <Animated.View
        testID="splash-anchor"
        style={[
          styles.container,
          { paddingHorizontal: screenMargin, paddingTop: height * WORDMARK_TOP_RATIO },
          { opacity },
        ]}
      >
        {/* The rule runs beside the wordmark on every launch, so when the
            passage arrives below it reads as one system rather than a gold bar
            appearing out of nowhere once a day. */}
        <View style={styles.masthead}>
          <View style={[styles.rule, styles.mastheadRule]} />
          <View style={styles.mastheadText}>
            <Text testID="splash-wordmark" style={styles.wordmark} allowFontScaling={false}>
              Sirat
            </Text>
            <Text style={styles.tagline} allowFontScaling={false}>
              The path to your deen
            </Text>
            <Text testID="splash-hijri" style={styles.hijri} allowFontScaling={false}>
              {hijriDate.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.spacer} />

        {/* Marked in the margin the way a read passage is. */}
        {showPassage && hadith ? (
          <View testID="splash-passage" style={styles.passage}>
            <View style={styles.rule} />
            <View style={styles.passageText}>
              <Text style={styles.arabic} allowFontScaling={false}>
                {hadith.arabic}
              </Text>
              <Text style={styles.english} allowFontScaling={false}>
                {hadith.english}
              </Text>
              {hadith.source ? (
                <Text style={styles.source} allowFontScaling={false}>
                  {hadith.source}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </Animated.View>
    </LinearGradient>
  );
}

const noAndroidPadding = Platform.OS === "android" ? { includeFontPadding: false } : null;

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;

  return StyleSheet.create({
    gradient: {
      flex: 1,
    },
    container: {
      flex: 1,
      paddingBottom: spacing.huge + spacing.xxxl,
    },
    masthead: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.lg,
    },
    // Quieter than the passage's rule: this one is structure, that one is a mark.
    mastheadRule: {
      opacity: 0.55,
    },
    mastheadText: {
      flex: 1,
    },
    // Above the type scale on purpose. The scale tops out at 34 for screens
    // that also carry UI; this screen carries none, so the type is set for a
    // page rather than for an interface. Dynamic Type is off throughout for the
    // same reason — nothing here is read at length, and reflow would break the
    // fixed anchor.
    wordmark: {
      fontSize: 56,
      lineHeight: 62,
      fontWeight: "700",
      letterSpacing: -1.2,
      color: colors.textPrimary,
      ...noAndroidPadding,
    },
    tagline: {
      marginTop: spacing.sm,
      fontSize: 19,
      lineHeight: 25,
      fontWeight: "400",
      color: colors.textTertiary,
      ...noAndroidPadding,
    },
    hijri: {
      marginTop: spacing.lg,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "700",
      letterSpacing: 1.6,
      color: colors.accent,
      ...noAndroidPadding,
    },
    spacer: {
      flex: 1,
    },
    passage: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.lg,
    },
    // The marked-passage rule. The one place accent earns a decorative role.
    rule: {
      width: 2,
      borderRadius: 2,
      backgroundColor: colors.accent,
      opacity: 0.85,
    },
    passageText: {
      flex: 1,
    },
    // Arabic needs more leading than the Latin scale allows or the diacritics
    // collide with the line above.
    arabic: {
      fontSize: 32,
      lineHeight: 54,
      color: colors.textPrimary,
      textAlign: "right",
      writingDirection: "rtl",
      ...noAndroidPadding,
    },
    english: {
      marginTop: spacing.md,
      fontSize: 18,
      lineHeight: 25,
      fontWeight: "400",
      color: colors.textSecondary,
      ...noAndroidPadding,
    },
    source: {
      marginTop: spacing.md,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "400",
      letterSpacing: 0.4,
      color: colors.accent,
      ...noAndroidPadding,
    },
  });
};
