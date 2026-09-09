// app/(tabs)/qibla.tsx
import type { AppTheme } from "@/constants/theme";
import Screen from "@/components/ui/Screen";
import AppIcon from "@/components/ui/AppIcon";
import EmptyState from "@/components/ui/EmptyState";
import ScreenHeader from "@/components/ui/ScreenHeader";
import { Caption, Headline, Body } from "@/components/ui/Text";
import CompassDial from "@/components/qibla/CompassDial";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import useQibla from "../../hooks/useQibla";

type Perm = "undetermined" | "denied" | "granted";

export default function Qibla() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screenMargin = useScreenMargin();

  const { rotation, heading, qiblaAngle, distanceKm, accuracy, error, isAligned } = useQibla();
  const haptics = useHaptics();

  const [permissionStatus, setPermissionStatus] =
    useState<Perm>("undetermined");
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);

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
    const now = Date.now();
    if (isAligned && !prevAligned.current && now - lastHapticAt.current > 900) {
      haptics("success");
      lastHapticAt.current = now;
    }
    prevAligned.current = isAligned;
  }, [isAligned, haptics]);

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

  // ----- Top-of-screen gate -----
  if (needLocationGate) {
    const servicesOff = servicesOn === false;
    const denied = permissionStatus === "denied";

    return (
      <Screen>
        <View style={[styles.container, { padding: screenMargin }]}>
          <ScreenHeader title="Qibla" />
          <View style={styles.gateContent}>
            {servicesOff ? (
              <EmptyState
                icon="location"
                title="Location Services Off"
                message="Location is required to calculate the Qibla direction."
                actionLabel="How to turn on"
                onAction={openLocationServicesHelp}
                actionAccessibilityLabel="How to turn on location services"
                secondaryLabel="I turned it on"
                onSecondary={requestPermissionAndLoad}
                secondaryAccessibilityLabel="Retry location setup"
                note="Prayer times still work without location. You can use a manual city from Settings."
              />
            ) : denied ? (
              <EmptyState
                icon="location-outline"
                title="Allow Location Access"
                message="Grant Sirat access to your location to calculate the Qibla direction."
                actionLabel="Open Settings"
                onAction={openDeviceSettings}
                actionAccessibilityLabel="Open device settings"
                secondaryLabel="Try again"
                onSecondary={requestPermissionAndLoad}
                secondaryAccessibilityLabel="Retry location permission"
                note="Prayer times still work without location. You can use a manual city from Settings."
              />
            ) : (
              <EmptyState
                icon="navigate"
                title="We need your location"
                message="Enable location to calculate the direction to the Kaaba. You can turn it off again in Settings."
                actionLabel="Enable Location"
                onAction={requestPermissionAndLoad}
                actionAccessibilityLabel="Enable location"
                note="Prayer times still work without location. You can use a manual city from Settings."
              />
            )}
          </View>
        </View>
      </Screen>
    );
  }

  // ----- Normal Qibla UI -----
  return (
    <Screen>
      <View style={[styles.container, { padding: screenMargin }]}>
        <ScreenHeader
          title="Qibla"
          subtitle={
            accuracy != null && accuracy >= 0
              ? `Keep your phone flat · Accuracy ±${Math.round(accuracy)}°`
              : "Calibrating compass"
          }
        />

        <View style={styles.compassArea}>
          {error ? (
            <View style={styles.stateBlock}>
              <View style={styles.errorIcon}>
                <AppIcon name="warning-outline" size={28} color={colors.danger} />
              </View>
              <Body color={colors.danger} style={styles.errorText}>{error}</Body>
              <Caption color={colors.textTertiary} style={styles.helperText}>
                Move your phone in a figure eight to improve compass accuracy.
              </Caption>
            </View>
          ) : rotation == null || qiblaAngle == null || heading == null ? (
            <View style={styles.stateBlock} accessible accessibilityLabel="Finding direction">
              <ActivityIndicator size="small" color={colors.accent} style={styles.errorIcon} />
              <Headline color={colors.white}>Finding direction...</Headline>
            </View>
          ) : (
            <CompassDial
              heading={heading}
              qiblaAngle={qiblaAngle}
              rotation={rotation}
              distanceKm={distanceKm}
              isAligned={isAligned}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;

  return StyleSheet.create({
    container: { flex: 1 },
    gateContent: { flex: 1, alignItems: "center", justifyContent: "center" },
    compassArea: { flex: 1, alignItems: "center", justifyContent: "center" },
    stateBlock: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
    errorIcon: { marginBottom: spacing.sm },
    errorText: { textAlign: "center" },
    helperText: { marginTop: spacing.md, textAlign: "center" },
  });
};
