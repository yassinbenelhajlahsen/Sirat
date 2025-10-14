// app/components/SplashScreen.tsx
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
} from "react-native";
import hadiths from "../../assets/data/hadiths.json";

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

  // Opaque at start so nothing beneath is visible
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(10)).current; // subtle lift-in

  // Pick today's hadith deterministically
  useEffect(() => {
    I18nManager.allowRTL(true);
    const day = new Date().getDate();
    const today = (hadiths as any[]).find((h) => h.day === day) || null;
    setHadith(today);
  }, []);

  // Gentle entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // When parent marks ready, fade out and notify completion
  useEffect(() => {
    if (!ready) return;
    const timeout = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 450,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && onFinished) onFinished();
      });
    }, 2000);
    return () => clearTimeout(timeout);
  }, [ready]);

  // Hide native splash once this component has a frame on screen
  const handleLayout = (_e: LayoutChangeEvent) => {
    onReadyToHideNative?.();
  };

  const englishQuoted = useMemo(() => {
    if (!hadith?.english) return "";
    return `“${hadith.english}”`;
  }, [hadith]);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Title */}
        <Text style={styles.appName} allowFontScaling={false}>
          {/* trailing space avoids right-edge clip on some iOS builds */}
          Sirat{" "}
        </Text>

        {/* Subtitle */}
        <Text style={styles.tagline} allowFontScaling={false}>
          The Path to Your Deen
        </Text>

        {/* Only render variable-length text when fonts are ready */}
        {fontsReady ? (
          hadith ? (
            <>
              {/* Arabic */}
              <Text
                style={styles.arabic}
                allowFontScaling={false}
              >
                {hadith.arabic}
              </Text>

              <View style={styles.divider} />

              {/* English */}
              <Text
                style={styles.english}
                numberOfLines={3}
                adjustsFontSizeToFit
                minimumFontScale={0.9}
              >
                {englishQuoted}
              </Text>
              {hadith?.source ? (
                <Text style={styles.source} allowFontScaling={false}>
                  {hadith.source}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.loadingText}>Loading hadith...</Text>
          )
        ) : (
          // keep layout stable but invisible while fonts load
          <View style={{ height: 140 }} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#134b0a",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    // Give Text a stable measuring box across devices
    width: "90%",
    maxWidth: 700,
    paddingHorizontal: 28,
  },
  appName: {
    color: "#DABA69",
    fontSize: 60,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: 6,
    letterSpacing: 0.6,
    // prevent right-edge clipping and add vertical room
    paddingHorizontal: 6,
    lineHeight: 68,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  tagline: {
    color: "#ffffff",
    opacity: 0.85,
    fontSize: 30,
    fontFamily: "SFProDisplay-Regular",
    marginBottom: 72,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  arabic: {
    color: "#ffffff",
    fontSize: 36,
    textAlign: "center",
    lineHeight: 54,
    marginTop: 8,
    marginBottom: 18,
    writingDirection: "rtl",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: "#DABA69",
    marginVertical: 20,
    borderRadius: 2,
  },
  english: {
    color: "#DABA69",
    fontSize: 18,
    textAlign: "center",
    fontFamily: "SFProDisplay-Semibold",
    lineHeight: 26,
  },
  source: {
    marginTop: 8,
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    textAlign: "center",
    fontFamily: "SFProDisplay-Semiboldr",
  },
  loadingText: {
    color: "#DABA69",
    fontSize: 16,
    fontFamily: "SFProDisplay-Regular",
  },
});
