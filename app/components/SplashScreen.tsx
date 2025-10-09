// app/components/SplashScreen.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  LayoutChangeEvent,
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
};

export default function SplashScreen({
  ready,
  onReadyToHideNative,
  onFinished,
}: Props) {
  const [hadith, setHadith] = useState<{ arabic: string; english: string } | null>(null);

  // Opaque at start so nothing beneath is visible
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(10)).current; // subtle lift-in

  // Pick today's hadith deterministically
  useEffect(() => {
    I18nManager.allowRTL(true);
    const day = new Date().getDate();
    const today = hadiths.find((h: any) => h.day === day) || null;
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
    Animated.timing(opacity, {
      toValue: 0,
      duration: 450,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && onFinished) onFinished();
    });
  }, [ready]);

  // Hide native splash once this component has a frame on screen
  const handleLayout = (e: LayoutChangeEvent) => {
    onReadyToHideNative?.();
  };

  const englishQuoted = useMemo(() => {
    if (!hadith?.english) return "";
    // Ensure consistent quotes
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
        <Text style={styles.appName}>Sirat</Text>
        <Text style={styles.tagline}>The Path to Your Deen</Text>
        {hadith ? (
          <>
            <Text style={styles.arabic} numberOfLines={3} adjustsFontSizeToFit>
              {hadith.arabic}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.english} numberOfLines={3} adjustsFontSizeToFit>
              {englishQuoted}
            </Text>
          </>
        ) : (
          <Text style={styles.loadingText}>Loading hadith...</Text>
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
    paddingHorizontal: 28,
    transform: [{ translateY: -40 }],
  },
  appName: {
    color: "#DABA69",
    fontSize: 60,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  tagline: {
    color: "#ffffff",
    opacity: 0.85,
    fontSize: 30,
    fontFamily: "SFProDisplay-Regular",
    marginBottom: 85,
  },
  arabic: {
    color: "#ffffff",
    fontSize: 36,
    textAlign: "center",
    fontFamily: "GeezaPro",
    lineHeight: 54,
    marginTop: 8,
    marginBottom: 18,
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
  loadingText: {
    color: "#DABA69",
    fontSize: 16,
    fontFamily: "SFProDisplay-Regular",
  },
});
