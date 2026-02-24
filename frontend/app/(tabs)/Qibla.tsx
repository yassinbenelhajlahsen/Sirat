// app/(tabs)/qibla.tsx
import {
  withOpacity,
  type AppTheme,
} from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

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
    iconColor = colors.white,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    message: string;
    actions?: React.ReactNode;
    iconColor?: string;
  }) => (
    <View style={styles.banner}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <View style={styles.bannerBody}>
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
        style={styles.gradient}
      >
        <Image
          source={require("@/assets/patterns/islamic-gold2.png")}
          style={styles.patternOverlay}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.headerSection}>
              <Text style={styles.eyebrow}>Direction</Text>
              <Text style={styles.title}>Qibla Compass</Text>
              <Text style={styles.subtitle}>
                Enable location to calculate the direction to the Kaaba.
              </Text>
            </View>
            <View style={styles.gateContent}>
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
                        accessibilityRole="button"
                        accessibilityLabel="How to turn on location services"
                      >
                        <Text style={styles.ctaPrimaryText}>
                          How to turn on
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ctaSecondary}
                        onPress={requestPermissionAndLoad}
                        accessibilityRole="button"
                        accessibilityLabel="Retry location setup"
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
                        accessibilityRole="button"
                        accessibilityLabel="Open device settings"
                      >
                        <Text style={styles.ctaPrimaryText}>Open Settings</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ctaSecondary}
                        onPress={requestPermissionAndLoad}
                        accessibilityRole="button"
                        accessibilityLabel="Retry location permission"
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
                      style={styles.ctaPrimary}
                      onPress={requestPermissionAndLoad}
                      accessibilityRole="button"
                      accessibilityLabel="Enable location"
                    >
                      <Text style={styles.ctaPrimaryText}>Enable Location</Text>
                    </TouchableOpacity>
                  }
                />
              ) : null}

              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  Prayer Times still work without location. You can use a manual
                  city from the Settings tab.
                </Text>
              </View>
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
        style={styles.gradient}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={styles.patternOverlay}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerSection}>
            <Text style={styles.eyebrow}>Direction</Text>
            <Text style={styles.title}>Qibla Compass</Text>
            <Text style={styles.subtitle}>
              Keep your phone flat and rotate until it aligns with Qibla.
            </Text>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Ionicons
                name="compass-outline"
                size={15}
                color={withOpacity(colors.accent, 0.95)}
              />
              <Text style={styles.statusPillText}>
                {accuracy != null && accuracy >= 0
                  ? `Accuracy ±${Math.round(accuracy)}°`
                  : "Calibrating compass..."}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                isAligned ? styles.statusPillAligned : null,
              ]}
            >
              <Ionicons
                name={isAligned ? "checkmark-circle" : "navigate-outline"}
                size={15}
                color={isAligned ? colors.white : withOpacity(colors.accent, 0.95)}
              />
              <Text
                style={[
                  styles.statusPillText,
                  isAligned ? styles.statusPillTextAligned : null,
                ]}
              >
                {isAligned ? "Aligned" : "Adjusting"}
              </Text>
            </View>
          </View>

          <View style={styles.compassCard}>
            {error ? (
              <>
                <Ionicons
                  name="warning-outline"
                  size={28}
                  color={colors.danger}
                  style={styles.errorIcon}
                />
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.helperText}>
                  Move your phone in a figure eight to improve compass accuracy.
                </Text>
              </>
            ) : rotation == null ? (
              <Text style={styles.loadingText}>Finding direction...</Text>
            ) : (
              <>
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
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, typography } = theme;

  return StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "transparent" },

  container: { flex: 1, padding: spacing.xl },
  gateContent: { flex: 1, marginTop: spacing.md },
  patternOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
    resizeMode: "repeat",
    width: "100%",
    height: "100%",
  },
  headerSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: withOpacity(colors.accent, 0.9),
    fontSize: typography.caption,
    fontFamily: "SFProDisplay-Semibold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: colors.white,
    fontFamily: "SFProDisplay-Bold",
    fontSize: 34,
    marginTop: spacing.xs,
    letterSpacing: 0.2,
    textShadowColor: withOpacity(colors.black, 0.35),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: withOpacity(colors.white, 0.9),
    fontSize: typography.body,
    lineHeight: 20,
    fontFamily: "SFProDisplay-Regular",
  },
  banner: {
    backgroundColor: withOpacity(colors.accent, 0.18),
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.35),
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bannerBody: { flex: 1, marginLeft: spacing.sm + 2 },
  bannerTitle: {
    color: colors.accent,
    fontSize: typography.bodyLg,
    fontFamily: "SFProDisplay-Semibold",
  },
  bannerText: {
    color: colors.white,
    opacity: 0.95,
    fontSize: typography.body,
    marginTop: spacing.xs,
  },

  row: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginTop: spacing.sm + 2,
    flexWrap: "wrap",
  },
  ctaPrimary: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ctaPrimaryText: { color: colors.onAccent, fontWeight: "700" },
  ctaSecondary: {
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ctaSecondaryText: { color: colors.accent, fontWeight: "600" },
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.25),
    backgroundColor: withOpacity(colors.white, 0.06),
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  statusPillAligned: {
    backgroundColor: withOpacity(colors.white, 0.06),
    borderColor: withOpacity(colors.accent, 0.6),
  },
  statusPillText: {
    color: withOpacity(colors.white, 0.92),
    fontSize: typography.caption,
    fontFamily: "SFProDisplay-Semibold",
  },
  statusPillTextAligned: {
    color: colors.white,
  },
  compassCard: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
  },
  ring: {
    width: 292,
    height: 292,
    borderRadius: 146,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(colors.white, 0.04),
    shadowColor: theme.name === "dark" ? "#DABA69" : colors.accentGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  ringAligned: { shadowOpacity: 0.8, shadowRadius: 20 },
  arrow: { width: 250, height: 250 },

  loadingText: {
    color: colors.white,
    fontSize: typography.subtitle,
    textAlign: "center",
    fontFamily: "SFProDisplay-Semibold",
  },
  errorIcon: {
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.bodyLg,
    textAlign: "center",
    fontFamily: "SFProDisplay-Semibold",
  },
  noteText: {
    color: colors.accent,
    fontSize: typography.body,
    marginBottom: spacing.sm + 2,
    textAlign: "center",
    fontFamily: "SFProDisplay-Semibold",
  },
  noteTextGood: {
    color: withOpacity(colors.white, 0.82),
    fontSize: typography.body,
    marginBottom: spacing.sm + 2,
    textAlign: "center",
    fontFamily: "SFProDisplay-Regular",
  },
  helperText: {
    color: colors.accentMuted,
    fontSize: typography.body,
    marginTop: spacing.md,
    textAlign: "center",
  },
  infoCard: {
    marginTop: spacing.md,
    borderRadius: 14,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.2),
    backgroundColor: withOpacity(colors.white, 0.05),
  },
  infoText: {
    color: withOpacity(colors.white, 0.9),
    fontSize: typography.body,
    fontFamily: "SFProDisplay-Regular",
    textAlign: "center",
  },
  });
};
