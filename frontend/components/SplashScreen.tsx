import { darkTheme, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Easing,
  I18nManager,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import SplashEmblem, { SPLASH_ARABIC_FONT } from "@/components/splash/SplashEmblem";
import SplashSky from "@/components/splash/SplashSky";
import { useSplashChoreography } from "@/components/splash/useSplashChoreography";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { getEffectivePrayerSettings } from "@/services/prayerSettings";
import { getAlwaysFirstSplash } from "@/utils/devSplash";
import { formatHijriDate } from "@/utils/hijriDate";
import { sunDay } from "@/utils/sky";
import hadiths from "../assets/data/hadiths.json";

const LAST_SPLASH_KEY = "lastSplashDate";

/**
 * Star and wordmark sit at fixed fractions of the screen height rather than in
 * a flex slot, so they land in exactly the same place whether or not the hadith
 * is present. A repeat launch is the same screen with the passage removed.
 */
const EMBLEM_CENTER_RATIO = 0.296;
const WORDMARK_TOP_RATIO = 0.4185;
const EMBLEM_MAX_SIZE = 156;
const EMBLEM_HEIGHT_RATIO = 0.18;
const PASSAGE_BOTTOM = 72;
const RISE_PX = 9;
// How far each layer travels on the way out. The sky only drifts; the star
// swells past the screen edges, so the exit reads as moving through it.
const EXIT_SKY_SCALE = 1.12;
const EXIT_STAR_SCALE = 1.6;
const EXIT_TEXT_LIFT_PX = -10;

/** The longest hadiths ran into the wordmark at the full size. */
const LONG_ARABIC_CHARS = 60;

/** How long the splash holds before dissolving, once the app is ready. */
const DWELL_FIRST_MS = 2750;
const DWELL_REPEAT_MS = 1250;

type Launch = "unknown" | "first" | "repeat";

const SUNSET_LOOKUP_CAP_MS = 300;

/**
 * Tonight's sunset (Maghrib), worked out on the device from where it already is: the
 * OS's cached fix, else the manual city. Never prompts and never waits on GPS or the
 * network, so the splash needs no prayer times to turn the Hijri date at sunset.
 */
async function sunsetToday(now: Date): Promise<Date | null> {
  try {
    const settings = await getEffectivePrayerSettings();
    let coords: { latitude: number; longitude: number } | null = null;
    if (settings.useLocation) {
      coords = (await Location.getLastKnownPositionAsync())?.coords ?? null;
    }
    if (!coords && settings.city) coords = { latitude: settings.city.lat, longitude: settings.city.lng };
    if (!coords) return null;
    const { sunset } = sunDay(now, coords.latitude, coords.longitude);
    return sunset === null ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, sunset);
  } catch {
    return null;
  }
}

type Props = {
  // When true, start the fade out and call onFinished at the end
  ready: boolean;
  // Called once the React splash is laid out so we can hide the native screen safely
  onReadyToHideNative?: () => void;
  // Called after fade out completes so parent can render the app
  onFinished?: () => void;
};

export default function SplashScreen({ ready, onReadyToHideNative, onFinished }: Props) {
  const { theme, isHydrated } = useTheme();
  const splashTheme = isHydrated ? theme : darkTheme;
  const themeColors = splashTheme.colors;
  const screenMargin = useScreenMargin();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const emblemSize = Math.min(EMBLEM_MAX_SIZE, height * EMBLEM_HEIGHT_RATIO);
  const wordmarkSize = Math.min(50, height * 0.06);
  // Gold is under 2:1 on the cream Light sky: text drops to the dark ink and the
  // emblem line to the deeper gold.
  const isLight = splashTheme.name === "light";
  const goldText = isLight ? themeColors.textSecondary : themeColors.accent;
  const goldLine = isLight ? themeColors.primaryOutline : themeColors.accent;
  const styles = useMemo(
    () => createStyles(splashTheme, wordmarkSize, goldText),
    [splashTheme, wordmarkSize, goldText],
  );

  const [hadith, setHadith] = useState<{
    arabic: string;
    english: string;
    source: string;
  } | null>(null);
  const [launch, setLaunch] = useState<Launch>("unknown");
  const [hijriDate, setHijriDate] = useState(() => formatHijriDate(new Date()));

  // Hold the opening until the Arabic face is in (or has failed), so the Arabic
  // never visibly swaps faces and a failed load never blocks the splash.
  const [fontLoaded, fontError] = useFonts({
    [SPLASH_ARABIC_FONT]: require("../assets/fonts/Amiri-Regular.ttf"),
  });
  const fontSettled = fontLoaded || fontError !== null;

  // 0 = splash showing, 1 = gone. The text lifts away first, the star swells and
  // clears, and the sky drifts and fades last, so the exit moves into the app
  // rather than just dimming.
  const exit = useRef(new RNAnimated.Value(0)).current;
  const startedAtMs = useRef(Date.now());

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const now = new Date();
        const today = now.toDateString();
        // Resolved alongside the launch check, which already holds the masthead back,
        // so the date appears already turned rather than flipping mid-splash.
        const [lastSplash, alwaysFirst, sunset] = await Promise.all([
          AsyncStorage.getItem(LAST_SPLASH_KEY),
          getAlwaysFirstSplash(),
          // Capped: this check also gates leaving the splash, so a slow location answer
          // falls back to the daytime date (off by one only between sunset and midnight).
          Promise.race([
            sunsetToday(now),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), SUNSET_LOOKUP_CAP_MS)),
          ]),
        ]);
        setHijriDate(formatHijriDate(now, sunset));

        if (alwaysFirst || lastSplash !== today) {
          setLaunch("first");
          await AsyncStorage.setItem(LAST_SPLASH_KEY, today);
        } else {
          setLaunch("repeat");
        }
      } catch (error) {
        // If error, default to the shorter splash
        console.log("Error checking first launch:", error);
        setLaunch("repeat");
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

  const isFirst = launch === "first";
  const showPassage = isFirst && hadith !== null;
  const { star, ring, lettering, masthead, passage } = useSplashChoreography(
    launch !== "unknown" && fontSettled,
    launch === "repeat",
    reduceMotion,
  );

  const mastheadStyle = useAnimatedStyle(() => ({
    opacity: masthead.value,
    transform: [{ translateY: (1 - masthead.value) * RISE_PX }],
  }));
  const passageStyle = useAnimatedStyle(() => ({
    opacity: passage.value,
    transform: [{ translateY: (1 - passage.value) * RISE_PX }],
  }));

  // Dissolve out once the app is ready, after holding long enough for the opening
  useEffect(() => {
    if (!ready || launch === "unknown") return;
    const elapsed = Date.now() - startedAtMs.current;

    const timeout = setTimeout(
      () => {
        RNAnimated.timing(exit, {
          toValue: 1,
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && onFinished) onFinished();
        });
      },
      Math.max(0, (isFirst ? DWELL_FIRST_MS : DWELL_REPEAT_MS) - elapsed),
    );
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, launch]);


  const longArabic = (hadith?.arabic.length ?? 0) > LONG_ARABIC_CHARS;

  return (
    <RNAnimated.View
      style={[
        styles.root,
        {
          opacity: exit.interpolate({
            inputRange: [0.35, 1],
            outputRange: [1, 0],
            extrapolate: "clamp",
          }),
        },
      ]}
      onLayout={() => onReadyToHideNative?.()}
      testID="splash-root"
    >
      <RNAnimated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, EXIT_SKY_SCALE] }) },
            ],
          },
        ]}
      >
        <SplashSky
          theme={splashTheme}
          reduceMotion={reduceMotion}
          glow={
            launch === "unknown"
              ? undefined
              : showPassage
                ? { progress: passage, variant: "focused" }
                : { progress: masthead, variant: "soft" }
          }
        />
        <RNAnimated.View
          style={[
            styles.emblem,
            { top: height * EMBLEM_CENTER_RATIO - emblemSize / 2 },
            {
              opacity: exit.interpolate({
                inputRange: [0, 0.7],
                outputRange: [1, 0],
                extrapolate: "clamp",
              }),
              transform: [
                {
                  scale: exit.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, EXIT_STAR_SCALE],
                  }),
                },
              ],
            },
          ]}
        >
          <SplashEmblem
            size={emblemSize}
            color={goldLine}
            star={star}
            ring={ring}
            lettering={lettering}
          />
        </RNAnimated.View>
      </RNAnimated.View>

      <RNAnimated.View
        testID="splash-anchor"
        style={[
          styles.anchor,
          { paddingHorizontal: screenMargin, paddingTop: height * WORDMARK_TOP_RATIO },
          {
            opacity: exit.interpolate({
              inputRange: [0, 0.4],
              outputRange: [1, 0],
              extrapolate: "clamp",
            }),
            transform: [
              {
                translateY: exit.interpolate({
                  inputRange: [0, 0.4],
                  outputRange: [0, EXIT_TEXT_LIFT_PX],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.masthead, mastheadStyle]}>
          <Text testID="splash-wordmark" style={styles.wordmark} allowFontScaling={false}>
            Sirat
          </Text>
          <Text testID="splash-hijri" style={styles.hijri} allowFontScaling={false}>
            {hijriDate.toUpperCase()}
          </Text>
        </Animated.View>

        {showPassage && hadith ? (
          <Animated.View
            testID="splash-passage"
            style={[styles.passage, { paddingHorizontal: screenMargin }, passageStyle]}
          >
            <Text
              style={[styles.arabic, longArabic && styles.arabicLong]}
              allowFontScaling={false}
            >
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
          </Animated.View>
        ) : null}
      </RNAnimated.View>
    </RNAnimated.View>
  );
}

const noAndroidPadding = Platform.OS === "android" ? { includeFontPadding: false } : null;

const createStyles = (theme: AppTheme, wordmarkSize: number, goldText: string) => {
  const { colors, spacing } = theme;

  return StyleSheet.create({
    root: { flex: 1 },
    anchor: { flex: 1, alignItems: "center" },
    emblem: { position: "absolute", left: 0, right: 0, alignItems: "center" },
    masthead: { alignItems: "center" },
    // Above the type scale on purpose: this screen carries no UI, so the type is
    // set for a page. Dynamic Type is off throughout because reflow would break
    // the fixed anchor.
    wordmark: {
      fontSize: wordmarkSize,
      lineHeight: wordmarkSize * 1.12,
      fontWeight: "700",
      letterSpacing: -wordmarkSize * 0.02,
      color: colors.textPrimary,
      ...noAndroidPadding,
    },
    hijri: {
      marginTop: spacing.md,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: 2.2,
      color: goldText,
      ...noAndroidPadding,
    },
    passage: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: PASSAGE_BOTTOM,
      alignItems: "center",
    },
    arabic: {
      fontFamily: SPLASH_ARABIC_FONT,
      fontSize: 32,
      lineHeight: 56,
      color: colors.textPrimary,
      textAlign: "center",
      writingDirection: "rtl",
      ...noAndroidPadding,
    },
    arabicLong: { fontSize: 28, lineHeight: 49 },
    english: {
      marginTop: spacing.md,
      fontSize: 18,
      lineHeight: 25,
      color: colors.textSecondary,
      textAlign: "center",
      ...noAndroidPadding,
    },
    source: {
      marginTop: spacing.md,
      fontSize: 14,
      lineHeight: 19,
      letterSpacing: 0.4,
      color: goldText,
      textAlign: "center",
      ...noAndroidPadding,
    },
  });
};
