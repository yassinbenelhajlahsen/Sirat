// app/components/SplashScreen.tsx
import { colors as themeColors, withOpacity } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import hadiths from "../../assets/data/hadiths.json";

const LAST_SPLASH_KEY = "lastSplashDate";

type Props = {
  // When true, start the fade out and call onFinished at the end
  ready: boolean;
  // Called once the React splash is laid out so we can hide the native screen safely
  onReadyToHideNative?: () => void;
  // Called after fade out completes so parent can render the app
  onFinished?: () => void;
  // New: only render text after fonts are loaded to avoid wrong measurements
  fontsReady?: boolean;
};

export default function SplashScreen({
  ready,
  onReadyToHideNative,
  onFinished,
  fontsReady = true,
}: Props) {
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

  // Gentle entrance with iOS-style animations
  useEffect(() => {
    // Staggered animation sequence for modern iOS feel
    Animated.sequence([
      // First: Fade in logo with scale (faster)
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // iOS easing
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      // Then: Lift content in (faster and with less delay)
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
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When parent marks ready, fade out with iOS-style animation
  useEffect(() => {
    if (!ready) return;
    // First launch of the day: longer display (1500ms), subsequent launches: shorter (200ms)
    const displayDuration = isFirstLaunchToday ? 2000 : 200;

    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.4, 0, 1, 1), // iOS fade-out easing
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 400,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && onFinished) onFinished();
      });
    }, displayDuration); // Dynamic duration based on first launch
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isFirstLaunchToday]);

  // Hide native splash once this component has a frame on screen
  const handleLayout = (_e: LayoutChangeEvent) => {
    onReadyToHideNative?.();
  };

  const englishQuoted = useMemo(() => {
    if (!hadith?.english) return "";
    return `“${hadith.english}”`;
  }, [hadith]);

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
    >
      {/* Subtle pattern overlay */}
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={styles.patternOverlay}
      />

      <Animated.View
        style={[
          styles.container,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Logo/Title Section with glow effect */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale }],
            },
          ]}
        >
          {/* Subtle glow behind text */}
          <View style={styles.glowContainer}>
            <Text
              style={[styles.appName, styles.glowText]}
              allowFontScaling={false}
            >
              Sirat{" "}
            </Text>
          </View>
          <Text style={styles.appName} allowFontScaling={false}>
            Sirat{" "}
          </Text>
          <Text style={styles.tagline} allowFontScaling={false}>
            The Path to Your Deen
          </Text>
        </Animated.View>

        {/* Hadith Content Section */}
        <Animated.View
          style={[
            styles.hadithContainer,
            {
              opacity: contentOpacity,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Only render variable-length text when fonts are ready */}
          {fontsReady ? (
            hadith ? (
              <View style={styles.hadithContent}>
                {/* Decorative top ornament */}
                <View style={styles.ornament} />

                {/* Arabic */}
                <Text style={styles.arabic} allowFontScaling={false}>
                  {hadith.arabic}
                </Text>

                <View style={styles.divider} />

                {/* English with subtle background card */}
                <View style={styles.englishCard}>
                  <Text
                    style={styles.english}
                    numberOfLines={3}
                    adjustsFontSizeToFit
                    minimumFontScale={0.9}
                  >
                    {englishQuoted}
                  </Text>
                </View>

                {hadith?.source ? (
                  <Text style={styles.source} allowFontScaling={false}>
                    {hadith.source}
                  </Text>
                ) : null}

                {/* Decorative bottom ornament */}
                <View style={styles.ornament} />
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading hadith...</Text>
              </View>
            )
          ) : (
            // keep layout stable but invisible while fonts load
            <View style={{ height: 140 }} />
          )}
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  patternOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03, // More subtle
    resizeMode: "repeat",
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 80,
  },
  glowContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  glowText: {
    opacity: 0.3,
    textShadowColor: themeColors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  appName: {
    color: themeColors.accent,
    fontSize: 64,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: 8,
    letterSpacing: 1,
    paddingHorizontal: 8,
    lineHeight: 72,
    textShadowColor: withOpacity(themeColors.black, 0.2),
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  tagline: {
    color: themeColors.white,
    opacity: 0.9,
    fontSize: 17, // iOS standard body size
    fontFamily: "SFProDisplay-Regular",
    letterSpacing: 0.3,
    textShadowColor: withOpacity(themeColors.black, 0.15),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  hadithContainer: {
    width: "88%",
    maxWidth: 420,
    alignItems: "center",
  },
  hadithContent: {
    width: "100%",
    alignItems: "center",
    // Removed glass effect background
    paddingVertical: 32,
  },
  ornament: {
    width: 40,
    height: 3,
    backgroundColor: themeColors.accent,
    borderRadius: 2,
    opacity: 0.6,
    marginVertical: 12,
  },
  arabic: {
    color: themeColors.white,
    fontSize: 28,
    textAlign: "center",
    lineHeight: 42,
    marginVertical: 12,
    writingDirection: "rtl",
    letterSpacing: 0.5,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  divider: {
    width: 50,
    height: 2,
    backgroundColor: themeColors.accent,
    marginVertical: 20,
    borderRadius: 2,
    opacity: 0.5,
  },
  englishCard: {
    width: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  english: {
    color: themeColors.accent,
    fontSize: 16,
    textAlign: "center",
    fontFamily: "SFProDisplay-Semibold",
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  source: {
    marginTop: 16,
    color: withOpacity(themeColors.white, 0.7),
    fontSize: 12,
    textAlign: "center",
    fontFamily: "SFProDisplay-Regular",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    color: withOpacity(themeColors.accent, 0.8),
    fontSize: 15,
    fontFamily: "SFProDisplay-Regular",
    letterSpacing: 0.3,
  },
});
