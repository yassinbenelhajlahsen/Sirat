// Qibla requires location + compass. Show a clear gate if location is off.
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { ImageSourcePropType, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import useQibla from "../../util/useQibla";

type Perm = "undetermined" | "denied" | "granted";

function minimalTarget(from: number, to: number) {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta;
}

const arrowImg = require("../../assets/images/qibla-compass-svgrepo-com.png") as ImageSourcePropType;

export default function Qibla() {
  const { rotation, error, accuracy, isAligned } = useQibla();

  const [permissionStatus, setPermissionStatus] = useState<Perm>("undetermined");
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);

  // Reanimated shared value for unbounded rotation (no snapping)
  const rot = useSharedValue(0);
  const lastHapticAt = useRef(0);
  const prevAligned = useRef(false);

  useEffect(() => {
    (async () => {
      const sOn = await Location.hasServicesEnabledAsync();
      setServicesOn(sOn);
      const perm = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(perm.status as Perm);
      if (perm.status !== "granted" && sOn) {
        const req = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(req.status as Perm);
      }
    })();
  }, []);

  useEffect(() => {
    if (rotation == null) return;
    const target = minimalTarget(rot.get(), rotation);
    rot.value = withSpring(target, { stiffness: 180, damping: 20, mass: 0.9 });
  }, [rotation]);

  useEffect(() => {
    const now = Date.now();
    if (isAligned && !prevAligned.current && now - lastHapticAt.current > 900) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastHapticAt.current = now;
    }
    prevAligned.current = isAligned;
  }, [isAligned]);

  const animatedStyle = useAnimatedStyle(() => {
    const deg = rot.value % 360;
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const needGate =
    servicesOn === false || permissionStatus !== "granted";

  const openDeviceSettings = async () => {
    try {
      // Expo recommends Linking.openSettings
      // @ts-ignore
      await import("react-native").then(({ Linking }) => Linking.openSettings());
    } catch {
      // noop
    }
  };

  const openLocationServicesHelp = () => {
    alert(
      Platform.select({
        ios: "Qibla needs Location. Turn on: Settings → Privacy & Security → Location Services, then allow Sirat.",
        android: "Qibla needs Location. Enable Location in Quick Settings or Settings → Location, then allow Sirat.",
        default: "Please enable Location Services on your device.",
      }) as string
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Qibla</Text>
        {!needGate && accuracy != null && accuracy >= 0 ? (
          <Text style={styles.subtle}>Accuracy ±{Math.round(accuracy)}°</Text>
        ) : null}
      </View>

      <View style={styles.center}>
        {needGate ? (
          <View style={styles.banner}>
            <Ionicons name="location-outline" size={20} color="#134b0a" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.bannerTitle}>Location required</Text>
              <Text style={styles.bannerText}>
                Turn on Location Services and allow access to calculate the direction to the Kaaba.
              </Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.ctaPrimary} onPress={openLocationServicesHelp}>
                  <Text style={styles.ctaPrimaryText}>How to turn on</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctaSecondary} onPress={openDeviceSettings}>
                  <Text style={styles.ctaSecondaryText}>Open Settings</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helper}>
                Prayer Times still work without location. Pick a city in{" "}
                <Text style={styles.link}>Settings</Text>.
              </Text>
            </View>
          </View>
        ) : error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.helper}>Move your phone in a figure-eight to improve compass accuracy.</Text>
          </>
        ) : rotation == null ? (
          <Text style={styles.loadingText}>Finding direction…</Text>
        ) : (
          <>
            {accuracy != null && accuracy > 20 ? (
              <Text style={styles.noteText}>Move phone in a figure eight to improve accuracy.</Text>
            ) : null}

            <View style={[styles.ring, isAligned && styles.ringAligned]}>
              <Animated.Image source={arrowImg} style={[styles.arrow, animatedStyle]} resizeMode="contain" />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#134b0a" },
  titleContainer: { paddingTop: 10, paddingHorizontal: 20 },
  title: { color: "white", fontFamily: "SFProDisplay-Bold", fontSize: 44, letterSpacing: 0.2 },
  subtle: { marginTop: 2, color: "#d4e7d2", fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },

  banner: {
    backgroundColor: "rgba(218,186,105,0.18)",
    borderWidth: 1,
    borderColor: "rgba(218,186,105,0.35)",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bannerTitle: { color: "#DABA69", fontSize: 16, fontFamily: "SFProDisplay-Semibold" },
  bannerText: { color: "white", opacity: 0.95, fontSize: 14, marginTop: 4 },
  row: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  ctaPrimary: {
    backgroundColor: "#DABA69",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ctaPrimaryText: { color: "#134b0a", fontWeight: "700" },
  ctaSecondary: {
    borderColor: "#DABA69",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ctaSecondaryText: { color: "#DABA69", fontWeight: "600" },

  ring: {
    width: 320,
    height: 320,
    borderRadius: 160,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    shadowColor: "#00ffcc",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  ringAligned: { shadowOpacity: 0.8, shadowRadius: 20 },
  arrow: { width: 280, height: 280 },

  loadingText: { color: "white", fontSize: 18, textAlign: "center" },
  errorText: { color: "#ff7070", fontSize: 16, textAlign: "center" },
  noteText: { color: "#DABA69", fontSize: 14, marginBottom: 10, textAlign: "center" },
  helper: { color: "#dfeee0", fontSize: 14, marginTop: 12 },
  link: { color: "#DABA69", textDecorationLine: "underline" },
});
