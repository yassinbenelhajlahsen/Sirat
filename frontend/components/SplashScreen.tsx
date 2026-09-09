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
import { Caption, Footnote, LargeTitle } from "@/components/ui/Text";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import hadiths from "../assets/data/hadiths.json";

const LAST_SPLASH_KEY = "lastSplashDate";

/** Stands in for the daily hadith on every launch after the first of the day. */
const BISMILLAH = {
  arabic: "بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ",
  english: "In the name of God, the Most Gracious, the Most Merciful",
  source: "",
};

/**
 * The wordmark sits at a fixed fraction of the screen height rather than in a
 * flex slot, so it lands in exactly the same place whether or not the hadith is
 * present. A repeat launch is then the same screen with the passage removed,
 * not a differently-composed one.
 */
const WORDMARK_TOP_RATIO = 0.3;

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

  // Opaque at start so nothing beneath is visible
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(20)).current; // subtle lift-in
  const scale = useRef(new Animated.Value(0.95)).current; // iOS-style scale-in
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const introFinished = useRef(false);
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

  // The passage slot is never empty. On the first launch of the day it carries
  // the day's hadith; otherwise the Bismillah stands in, so the composition —
  // and the gold rule beside it — is complete on every launch.
  const passage = isFirstLaunchToday && hadith ? hadith : BISMILLAH;

  const hijriDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  // Entrance profile: richer on first launch, lighter on repeat launches
  useEffect(() => {
    const animation = isFirstLaunchToday
      ? Animated.sequence([
          Animated.parallel([
            Animated.timing(logoOpacity, {
              toValue: 1,
              duration: 400,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(contentOpacity, {
              toValue: 1,
              duration: 400,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: 450,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
          ]),
        ])
      : Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // The standing passage is part of the composition, not an extra, so
          // it comes in with the wordmark rather than after it.
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]);

    animation.start(() => {
      introFinished.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstLaunchToday]);

  // Fade out once app is ready and intro has had enough time to read cleanly
  useEffect(() => {
    if (!ready) return;
    const minVisibleMs = isFirstLaunchToday ? 1600 : 1600;
    const elapsed = Date.now() - startedAtMs.current;
    const waitForMinVisible = Math.max(0, minVisibleMs - elapsed);
    const waitForIntro = introFinished.current
      ? 0
      : isFirstLaunchToday
        ? 850
        : 220;
    const waitBeforeExit = Math.max(waitForMinVisible, waitForIntro);

    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: isFirstLaunchToday ? 360 : 220,
          easing: Easing.bezier(0.4, 0, 1, 1), // iOS fade-out easing
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: isFirstLaunchToday ? 1.02 : 1.01,
          duration: isFirstLaunchToday ? 360 : 220,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && onFinished) onFinished();
      });
    }, waitBeforeExit);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isFirstLaunchToday]);

  // Hide native splash once this component has a frame on screen
  const handleLayout = (_e: LayoutChangeEvent) => {
    onReadyToHideNative?.();
  };

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
          { opacity, transform: [{ scale }] },
        ]}
      >
        {/* The rule runs beside the wordmark on every launch, so when the
            passage arrives below it reads as one system rather than a gold bar
            appearing out of nowhere once a day. */}
        <Animated.View style={[styles.masthead, { opacity: logoOpacity }]}>
          <View style={[styles.rule, styles.mastheadRule]} />
          <View style={styles.mastheadText}>
            <LargeTitle testID="splash-wordmark" maxFontSizeMultiplier={1}>
              Sirat
            </LargeTitle>
            <Footnote color={themeColors.textTertiary} style={styles.tagline}>
              The path to your deen
            </Footnote>
            <Caption
              testID="splash-hijri"
              color={themeColors.accent}
              style={styles.hijri}
              maxFontSizeMultiplier={1.2}
            >
              {hijriDate.toUpperCase()}
            </Caption>
          </View>
        </Animated.View>

        <View style={styles.spacer} />

        {/* Marked in the margin the way a read passage is. */}
        <Animated.View
          testID="splash-passage"
          style={[
            styles.passage,
            { opacity: contentOpacity, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.rule} />
          <View style={styles.passageText}>
            <Text style={styles.arabic} allowFontScaling={false}>
              {passage.arabic}
            </Text>
            <Footnote color={themeColors.textSecondary} style={styles.english}>
              {passage.english}
            </Footnote>
            {passage.source ? (
              <Caption color={themeColors.accent} style={styles.source}>
                {passage.source}
              </Caption>
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );
}

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
    tagline: {
      marginTop: spacing.xs,
    },
    hijri: {
      marginTop: spacing.md,
      letterSpacing: 1.5,
      fontWeight: "700",
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
      fontSize: 24,
      lineHeight: 40,
      color: colors.textPrimary,
      textAlign: "right",
      writingDirection: "rtl",
      ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
    },
    english: {
      marginTop: spacing.md,
    },
    source: {
      marginTop: spacing.md,
      letterSpacing: 0.4,
    },
  });
};
