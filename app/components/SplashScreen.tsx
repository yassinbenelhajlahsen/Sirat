import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  I18nManager,
} from "react-native";
import hadiths from "../../assets/data/hadiths.json"; 

export default function SplashScreen() {
  const [hadith, setHadith] = useState<{ arabic: string; english: string } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
        <Text style={styles.title}>سُنَّة اليوم</Text>

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
  },
  title: {
    color: "#DABA69",
    fontSize: 24,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: 20,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  arabic: {
    color: "#ffffff",
    fontSize: 26,
    textAlign: "center",
    fontFamily: "GeezaPro", // iOS built-in Arabic font
    lineHeight: 40,
    marginBottom: 10,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: "#DABA69",
    marginVertical: 12,
    borderRadius: 2,
  },
  english: {
    color: "#DABA69",
    fontSize: 17,
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
