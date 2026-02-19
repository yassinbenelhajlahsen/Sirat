// app/(tabs)/qibla.tsx
import { colors, withOpacity } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  ImageSourcePropType,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import useQibla from "../../hooks/useQibla";

type Perm = "undetermined" | "denied" | "granted";

function minimalTarget(from: number, to: number) {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta;
}

const arrowImg =
  require("../../assets/images/qibla-compass-svgrepo-com.png") as ImageSourcePropType;

export default function Qibla() {
  const { rotation, error, accuracy, isAligned } = useQibla();

  const [permissionStatus, setPermissionStatus] =
    useState<Perm>("undetermined");
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);

  // Reanimated shared value for unbounded rotation (no snapping)
  const rot = useSharedValue(0);
  const lastHapticAt = useRef(0);
  const prevAligned = useRef(false);

  // ----- Copied Mosques-style status checks -----
  const checkStatus = async () => {
    const sOn = await Location.hasServicesEnabledAsync();
    setServicesOn(sOn);
    const perm = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(perm.status as Perm);
  };

  const requestPermissionAndLoad = async () => {
    try {
      const sOn = await Location.hasServicesEnabledAsync();
      setServicesOn(sOn);

      // If services are off, stop here and show CTA
      if (!sOn) return;

      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      setPermissionStatus(perm.status as Perm);

      // If still not granted, stop
      if (perm.status !== "granted") return;

      // At this point, the hook can access location. Nothing else needed here.
    } catch {
      // Noop, UI gate will handle
    }
  };

  useEffect(() => {
    checkStatus()
      .then(requestPermissionAndLoad)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (rotation == null) return;
    const target = minimalTarget(rot.get(), rotation);
    rot.value = withSpring(target, { stiffness: 180, damping: 20, mass: 0.9 });
  }, [rotation, rot]);

  useEffect(() => {
    const now = Date.now();
    if (isAligned && !prevAligned.current && now - lastHapticAt.current > 900) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      lastHapticAt.current = now;
    }
    prevAligned.current = isAligned;
  }, [isAligned]);

  const animatedStyle = useAnimatedStyle(() => {
    const deg = rot.value % 360;
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const needLocationGate =
    servicesOn === false || permissionStatus !== "granted";

  const openDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Open Settings",
        "Unable to open settings. Please open device settings and grant Location permission.",
      );
    }
  };

  const openLocationServicesHelp = () => {
    Alert.alert(
      "Turn On Location Services",
      Platform.select({
        ios: "Go to Settings → Privacy & Security → Location Services and turn it on, then open Sirat and grant access.",
        android:
          "Turn on Location in Quick Settings or Settings → Location, then open Sirat and grant access.",
        default: "Please enable Location Services on your device.",
      }) as string,
    );
  };

  // ----- Same InfoBanner component used in Mosques -----
  const InfoBanner = ({
    icon,
    title,
    message,
    actions,
    iconColor = colors.primary,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    message: string;
    actions?: React.ReactNode;
    iconColor?: string;
  }) => (
    <View style={styles.banner}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerText}>{message}</Text>
        {actions}
      </View>
    </View>
  );

  // ----- Top-of-screen gate like Mosques -----
  if (needLocationGate) {
    const servicesOff = servicesOn === false;
    const denied = permissionStatus === "denied";
    const undetermined = permissionStatus === "undetermined";

    return (
      <LinearGradient
        colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <Text style={styles.title}>Qibla</Text>
            <View style={{ flex: 1, marginTop: 20 }}>
              {servicesOff ? (
                <InfoBanner
                  icon="location"
                  title="Location Services Off"
                  message="Location is required to calculate the Qibla direction."
                  actions={
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.ctaPrimary}
                        onPress={openLocationServicesHelp}
                      >
                        <Text style={styles.ctaPrimaryText}>
                          How to turn on
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ctaSecondary}
                        onPress={checkStatus}
                      >
                        <Text style={styles.ctaSecondaryText}>
                          I turned it on
                        </Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              ) : denied ? (
                <InfoBanner
                  icon="location-outline"
                  iconColor={colors.accent}
                  title="Allow Location Access"
                  message="Grant Sirat access to your location to calculate the Qibla direction."
                  actions={
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.ctaPrimary}
                        onPress={openDeviceSettings}
                      >
                        <Text style={styles.ctaPrimaryText}>Open Settings</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ctaSecondary}
                        onPress={requestPermissionAndLoad}
                      >
                        <Text style={styles.ctaSecondaryText}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              ) : undetermined ? (
                <InfoBanner
                  icon="navigate-outline"
                  title="We need your location"
                  message="Tap enable to calculate the direction to the Kaaba. You can disable anytime in Settings."
                  actions={
                    <TouchableOpacity
                      style={[styles.ctaPrimary, { alignSelf: "flex-start" }]}
                      onPress={requestPermissionAndLoad}
                    >
                      <Text style={styles.ctaPrimaryText}>Enable Location</Text>
                    </TouchableOpacity>
                  }
                />
              ) : null}

              <Text style={styles.helper}>
                Prayer Times still work without location. Pick a city in{" "}
                <Text style={styles.link}>Settings</Text>.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ----- Normal Qibla UI -----
  return (
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.05,
          resizeMode: "repeat",
          width: "100%",
          height: "100%",
        }}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Qibla</Text>
          {!needLocationGate && accuracy != null && accuracy >= 0 ? (
            <Text style={styles.subtle}>Accuracy ±{Math.round(accuracy)}°</Text>
          ) : null}
        </View>

        <View style={styles.center}>
          {error ? (
            <>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.helper}>
                Move your phone in a figure eight to improve compass accuracy.
              </Text>
            </>
          ) : rotation == null ? (
            <Text style={styles.loadingText}>Finding direction…</Text>
          ) : (
            <>
              {accuracy != null && accuracy > 20 ? (
                <Text style={styles.noteText}>
                  Move phone in a figure eight to improve accuracy.
                </Text>
              ) : null}

              <View style={[styles.ring, isAligned && styles.ringAligned]}>
                <Animated.Image
                  source={arrowImg}
                  style={[styles.arrow, animatedStyle]}
                  resizeMode="contain"
                />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },

  // Matches the Mosques layout so the banner sits at the top under the title
  container: { flex: 1, padding: 20 },

  titleContainer: { paddingTop: 10, paddingHorizontal: 20 },
  title: {
    color: colors.white,
    fontFamily: "SFProDisplay-Bold",
    fontSize: 44,
    letterSpacing: 0.2,
  },
  subtle: { marginTop: 2, color: colors.accentSoft, fontSize: 13 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  // Banner visuals kept identical to Mosques
  banner: {
    backgroundColor: withOpacity(colors.accent, 0.18),
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.35),
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bannerTitle: {
    color: colors.accent,
    fontSize: 16,
    fontFamily: "SFProDisplay-Semibold",
  },
  bannerText: {
    color: colors.white,
    opacity: 0.95,
    fontSize: 14,
    marginTop: 4,
  },

  row: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  ctaPrimary: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ctaPrimaryText: { color: colors.primary, fontWeight: "700" },
  ctaSecondary: {
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ctaSecondaryText: { color: colors.accent, fontWeight: "600" },

  ring: {
    width: 320,
    height: 320,
    borderRadius: 160,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(colors.white, 0.04),
    shadowColor: colors.accentGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  ringAligned: { shadowOpacity: 0.8, shadowRadius: 20 },
  arrow: { width: 280, height: 280 },

  loadingText: { color: colors.white, fontSize: 18, textAlign: "center" },
  errorText: { color: colors.danger, fontSize: 16, textAlign: "center" },
  noteText: {
    color: colors.accent,
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  helper: { color: colors.accentMuted, fontSize: 14, marginTop: 12 },
  link: { color: colors.accent, textDecorationLine: "underline" },
});
