import Aurora from "@/components/ui/Aurora";
import GlassSurface from "@/components/ui/GlassSurface";
import MosqueMarker from "@/components/mosques/MosqueMarker";
import MosqueSheet from "@/components/mosques/MosqueSheet";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Region } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCachedMosques,
  getNearbyMosques,
  Mosque,
} from "../../services/getNearbyMosques";

type Perm = "undetermined" | "denied" | "granted";

export default function MosqueScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();
  const customMapStyle = useMemo(() => {
    if (theme.name === "light") return undefined;
    return createCustomMapStyle(colors);
  }, [theme.name, colors]);

  const mapRef = useRef<MapView>(null);

  const [permissionStatus, setPermissionStatus] =
    useState<Perm>("undetermined");
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);
  const [location, setLocation] = useState<null | {
    latitude: number;
    longitude: number;
  }>(null);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingFresh, setFetchingFresh] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);

  // Rests above the floating glass tab bar.
  const tabBarClearance = Math.max(insets.bottom, 14) + 6 + 64 + 8;

  const checkStatus = async () => {
    const sOn = await Location.hasServicesEnabledAsync();
    setServicesOn(sOn);
    const perm = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(perm.status as Perm);
  };

  const requestPermissionAndLoad = async () => {
    try {
      setLoading(true);
      const sOn = await Location.hasServicesEnabledAsync();
      setServicesOn(sOn);

      // If services are off, don't request permission yet — show CTA
      if (!sOn) {
        setLoading(false);
        return;
      }

      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      setPermissionStatus(perm.status as Perm);

      if (perm.status !== "granted") {
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      setLocation({ latitude, longitude });

      // Fast cached fill
      const cached = await getCachedMosques(latitude, longitude);
      setMosques(cached);

      // Fresh network fetch
      setFetchingFresh(true);
      try {
        const fresh = await getNearbyMosques(latitude, longitude);
        setMosques(fresh);
      } catch (fetchErr) {
        console.error("Mosque fetch error:", fetchErr);
        if (cached.length === 0) {
          Alert.alert("Error", "Failed to load nearby mosques.");
        }
      }
    } catch (err) {
      console.error("Mosque load error:", err);
      Alert.alert("Error", "Failed to load nearby mosques.");
    } finally {
      setFetchingFresh(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus()
      .then(requestPermissionAndLoad)
      .catch(() => {
        setLoading(false);
      });
  }, []);

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

  const openDirections = async (lat: number, lng: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nativeApple = `maps://?daddr=${lat},${lng}&dirflg=d`;
    const webApple = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    try {
      if (await Linking.canOpenURL(nativeApple)) {
        await Linking.openURL(nativeApple);
        return;
      }
      await Linking.openURL(webApple);
    } catch (err) {
      console.warn("openDirections error:", err);
      Alert.alert("Error", "Unable to open Maps for directions");
    }
  };

  const onSelectMosque = (m: Mosque) => {
    haptic("light");
    setSelectedId(m.id);
    mapRef.current?.animateToRegion(
      {
        latitude: m.lat,
        longitude: m.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350,
    );
  };

  const handleSearchThisArea = async () => {
    if (!region) return;
    setShowSearchArea(false);
    setFetchingFresh(true);
    try {
      const fresh = await getNearbyMosques(region.latitude, region.longitude);
      setMosques(fresh);
    } catch (e) {
      console.error("Mosque fetch error:", e);
      Alert.alert("Error", "Failed to load nearby mosques.");
    } finally {
      setFetchingFresh(false);
    }
  };

  const recenter = () => {
    if (!location) return;
    haptic("light");
    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350,
    );
  };

  const needLocationGate = useMemo(() => {
    if (loading) return false;
    if (servicesOn === false) return true;
    if (permissionStatus !== "granted") return true;
    if (!location) return true;
    return false;
  }, [loading, servicesOn, permissionStatus, location]);

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

  if (needLocationGate && !loading) {
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
        <Aurora />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.gateContainer}>
            <GlassSurface tier="card" style={styles.gateCard}>
              <View style={styles.headerSection}>
                <Text style={styles.eyebrow}>Explore</Text>
                <Text style={styles.title}>Nearby Mosques</Text>
                <Text style={styles.subtitle}>
                  Enable location to discover masajid around you.
                </Text>
              </View>
              <View style={styles.gateContent}>
                {servicesOff ? (
                  <InfoBanner
                    icon="location"
                    title="Location Services Off"
                    message="Location is required to show nearby mosques and center the map."
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
                    message="Grant Sirat access to your location for accurate nearby mosque results."
                    actions={
                      <View style={styles.row}>
                        <TouchableOpacity
                          style={styles.ctaPrimary}
                          onPress={openDeviceSettings}
                          accessibilityRole="button"
                          accessibilityLabel="Open device settings"
                        >
                          <Text style={styles.ctaPrimaryText}>
                            Open Settings
                          </Text>
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
                    message="Tap enable to find mosques near you. You can disable anytime in Settings."
                    actions={
                      <TouchableOpacity
                        style={styles.ctaPrimary}
                        onPress={requestPermissionAndLoad}
                        accessibilityRole="button"
                        accessibilityLabel="Enable location"
                      >
                        <Text style={styles.ctaPrimaryText}>
                          Enable Location
                        </Text>
                      </TouchableOpacity>
                    }
                  />
                ) : null}
              </View>
            </GlassSurface>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const emptyNearby =
    !fetchingFresh && (mosques == null || mosques.length === 0);

  const initialRegion: Region | undefined = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : undefined;

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        customMapStyle={customMapStyle}
        userInterfaceStyle={theme.name === "light" ? "light" : "dark"}
        showsUserLocation
        initialRegion={initialRegion}
        onRegionChangeComplete={(r) => {
          setRegion(r);
          setShowSearchArea(true);
        }}
      >
        {mosques.slice(0, 10).map((m) => (
          <MosqueMarker
            key={m.id}
            mosque={m}
            selected={m.id === selectedId}
            onPress={() => onSelectMosque(m)}
            onDirections={() => openDirections(m.lat, m.lng)}
          />
        ))}
      </MapView>

      {showSearchArea && (
        <View
          style={[styles.searchAreaWrap, { top: insets.top + 12 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSearchThisArea}
            accessibilityRole="button"
            accessibilityLabel="Search this area"
          >
            <GlassSurface
              tier="chrome"
              radius={999}
              style={styles.searchAreaPill}
            >
              <Ionicons name="search" size={16} color={colors.white} />
              <Text style={styles.searchAreaText}>Search this area</Text>
            </GlassSurface>
          </TouchableOpacity>
        </View>
      )}

      {emptyNearby && (
        <View
          style={[styles.emptyOverlayWrap, { top: insets.top + 64 }]}
          pointerEvents="box-none"
        >
          <GlassSurface tier="card" style={styles.emptyCard}>
            <Ionicons name="search" size={18} color={colors.accent} />
            <Text style={styles.emptyText}>
              No mosques found near your current location.
            </Text>
          </GlassSurface>
        </View>
      )}

      {(loading || fetchingFresh) && (
        <View
          style={[styles.spinnerOverlay, { top: insets.top + 12 }]}
          pointerEvents="none"
        >
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={recenter}
        accessibilityRole="button"
        accessibilityLabel="Recenter map on your location"
        style={[styles.recenterWrap, { bottom: tabBarClearance + 220 }]}
      >
        <GlassSurface tier="chrome" radius={999} style={styles.recenterButton}>
          <Ionicons name="locate" size={20} color={colors.white} />
        </GlassSurface>
      </TouchableOpacity>

      <MosqueSheet
        mosques={mosques}
        userLoc={location}
        selectedId={selectedId}
        onSelect={onSelectMosque}
        onDirections={(m) => openDirections(m.lat, m.lng)}
        bottomInset={tabBarClearance}
      />
    </View>
  );
}

const createCustomMapStyle = (colors: AppTheme["colors"]) => [
  { elementType: "geometry", stylers: [{ color: colors.primaryDark }] },
  { elementType: "labels.text.fill", stylers: [{ color: colors.accent }] },
  { featureType: "poi.place_of_worship", stylers: [{ color: colors.primary }] },
];

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, typography } = theme;

  return StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: "transparent" },
    screen: { flex: 1, backgroundColor: colors.primary },
    gateContainer: {
      flex: 1,
      padding: spacing.xl,
      justifyContent: "center",
    },
    gateCard: {
      padding: spacing.xl,
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
      textShadowColor: withOpacity(colors.black, 0.4),
      textShadowOffset: { width: 0, height: 2 },
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
    gateContent: { marginTop: spacing.md },
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
    searchAreaWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
    },
    searchAreaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs + 2,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    searchAreaText: {
      color: colors.white,
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Semibold",
    },
    emptyOverlayWrap: {
      position: "absolute",
      left: spacing.xl,
      right: spacing.xl,
      alignItems: "center",
    },
    emptyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    emptyText: {
      color: colors.white,
      fontSize: 15,
      flexShrink: 1,
    },
    spinnerOverlay: {
      position: "absolute",
      right: spacing.lg,
      backgroundColor: withOpacity(colors.black, 0.35),
      borderRadius: 14,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
    },
    recenterWrap: {
      position: "absolute",
      right: spacing.lg,
    },
    recenterButton: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
  });
};
