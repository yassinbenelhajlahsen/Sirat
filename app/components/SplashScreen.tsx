import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  StyleSheet,
  Text,
  View,
} from "react-native";
import hadiths from "../../assets/data/hadiths.json";

export default function SplashScreen() {
  const [hadith, setHadith] = useState<{
    arabic: string;
    english: string;
  } | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    I18nManager.allowRTL(true);
    const today = new Date().getDate();
    const todayHadith = hadiths.find((h) => h.day === today);
    setHadith(todayHadith || null);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.appName}>Sirat</Text>
        <Text style={styles.tagline}>The Path to Your Deen</Text>
        {hadith ? (
          <>
            <Text style={styles.arabic} numberOfLines={3} adjustsFontSizeToFit>
              {hadith.arabic}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.english} numberOfLines={3} adjustsFontSizeToFit>
              “{hadith.english}”
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
    transform: [{ translateY: -40 }], // move name/subtext a bit higher
  },
  appName: {
    color: "#DABA69",
    fontSize: 60,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  tagline: {
    color: "#fff",
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
