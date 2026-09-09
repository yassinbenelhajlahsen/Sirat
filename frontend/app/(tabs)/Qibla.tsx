// app/(tabs)/qibla.tsx
import { withOpacity, type AppTheme } from "@/constants/theme";
import Screen from "@/components/ui/Screen";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline, LargeTitle, Body } from "@/components/ui/Text";
import CompassDial from "@/components/qibla/CompassDial";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.banner}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <View style={styles.bannerBody}>
        <Headline color={colors.accent}>{title}</Headline>
        <Body color={colors.white} style={styles.bannerText}>{message}</Body>
        {actions}
      </View>
    </GlassSurface>
  );

  // ----- Top-of-screen gate like Mosques -----
  if (needLocationGate) {
    const servicesOff = servicesOn === false;
    const denied = permissionStatus === "denied";
    const undetermined = permissionStatus === "undetermined";

    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.headerSection}>
            <Caption color={withOpacity(colors.accent, 0.9)} style={styles.eyebrow}>
              Direction
            </Caption>
            <LargeTitle style={styles.title}>Qibla Compass</LargeTitle>
            <Body color={colors.textSecondary} style={styles.subtitle}>
              Enable location to calculate the direction to the Kaaba.
            </Body>
          </View>
          <View style={styles.gateContent}>
            {servicesOff ? (
              <InfoBanner
                icon="location"
                title="Location Services Off"
                message="Location is required to calculate the Qibla direction."
                actions={
                  <View style={styles.row}>
                    <Button
                      label="How to turn on"
                      onPress={openLocationServicesHelp}
                      accessibilityLabel="How to turn on location services"
                    />
                    <Button
                      label="I turned it on"
                      variant="secondary"
                      onPress={requestPermissionAndLoad}
                      accessibilityLabel="Retry location setup"
                    />
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
                    <Button
                      label="Open Settings"
                      onPress={openDeviceSettings}
                      accessibilityLabel="Open device settings"
                    />
                    <Button
                      label="Try again"
                      variant="secondary"
                      onPress={requestPermissionAndLoad}
                      accessibilityLabel="Retry location permission"
                    />
                  </View>
                }
              />
            ) : undetermined ? (
              <InfoBanner
                icon="navigate-outline"
                title="We need your location"
                message="Tap enable to calculate the direction to the Kaaba. You can disable anytime in Settings."
                actions={
                  <View style={styles.row}>
                    <Button
                      label="Enable Location"
                      onPress={requestPermissionAndLoad}
                      accessibilityLabel="Enable location"
                    />
                  </View>
                }
              />
            ) : null}

            <GlassSurface tier="row" radius={theme.radii.row} style={styles.infoCard}>
              <Body color={colors.textSecondary} style={styles.infoText}>
                Prayer Times still work without location. You can use a manual
                city from the Settings tab.
              </Body>
            </GlassSurface>
          </View>
        </View>
      </Screen>
    );
  }

  // ----- Normal Qibla UI -----
  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Caption color={withOpacity(colors.accent, 0.9)} style={styles.eyebrow}>
            Direction
          </Caption>
          <LargeTitle style={styles.title}>Qibla Compass</LargeTitle>
          <Body color={colors.textSecondary} style={styles.subtitle}>
            Keep your phone flat and turn until the Kaaba reaches the top.
          </Body>
        </View>

        <View style={styles.statusRow}>
          <GlassSurface tier="row" radius={theme.radii.pill} style={styles.statusPill}>
            <Ionicons name="compass-outline" size={15} color={withOpacity(colors.accent, 0.95)} />
            <Caption color={colors.white}>
              {accuracy != null && accuracy >= 0
                ? `Accuracy ±${Math.round(accuracy)}°`
                : "Calibrating compass..."}
            </Caption>
          </GlassSurface>
          <GlassSurface
            tier="row"
            radius={theme.radii.pill}
            style={[styles.statusPill, isAligned ? styles.statusPillAligned : null]}
          >
            <Ionicons
              name={isAligned ? "checkmark-circle" : "navigate-outline"}
              size={15}
              color={isAligned ? colors.accentSecondary : withOpacity(colors.accent, 0.95)}
            />
            <Caption color={colors.white}>
              {isAligned ? "Aligned" : "Adjusting"}
            </Caption>
          </GlassSurface>
        </View>

        <View style={styles.compassArea}>
          {error ? (
            <View style={styles.stateBlock}>
              <Ionicons name="warning-outline" size={28} color={colors.danger} style={styles.errorIcon} />
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
  const { colors, spacing } = theme;

  return StyleSheet.create({
    container: { flex: 1, padding: spacing.xl },
    gateContent: { flex: 1, marginTop: spacing.md },
    headerSection: {
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    eyebrow: {
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    title: {
      marginTop: spacing.xs,
      textShadowColor: withOpacity(colors.black, 0.35),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    subtitle: { marginTop: spacing.xs },
    banner: {
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "flex-start",
    },
    bannerBody: { flex: 1, marginLeft: spacing.sm + 2 },
    bannerText: {
      marginTop: spacing.xs,
    },
    row: {
      flexDirection: "row",
      gap: spacing.sm + 2,
      marginTop: spacing.md,
      flexWrap: "wrap",
    },
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
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 2,
    },
    statusPillAligned: { borderColor: withOpacity(colors.accent, 0.6) },
    compassArea: { flex: 1, alignItems: "center", justifyContent: "center" },
    stateBlock: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
    errorIcon: { marginBottom: spacing.sm },
    errorText: { textAlign: "center" },
    helperText: { marginTop: spacing.md, textAlign: "center" },
    infoCard: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    infoText: {
      textAlign: "center",
    },
  });
};
