import AppIcon from "@/components/ui/AppIcon";
import Aurora from "@/components/ui/Aurora";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import ScreenHeader from "@/components/ui/ScreenHeader";
import { Subhead } from "@/components/ui/Text";
import MosqueMarker from "@/components/mosques/MosqueMarker";
import MosqueSheet from "@/components/mosques/MosqueSheet";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { distanceKm } from "@/utils/geo";
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
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Region } from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCachedMosques,
  getNearbyMosques,
  Mosque,
} from "../../services/getNearbyMosques";

type Perm = "undetermined" | "denied" | "granted";
type LatLng = { latitude: number; longitude: number };

const RECENTER_SIZE = 48;
const RECENTER_GAP = 12;
const LOAD_ERROR = "Couldn't load nearby mosques.";

// "Search this area" only appears after the user has panned far enough from
// the last searched centre for a new query to return different results.
export function shouldOfferAreaSearch(
  region: Region,
  searchedCenter: LatLng | null,
  isGesture: boolean | undefined,
): boolean {
  if (!isGesture || !searchedCenter) return false;
  const moved = distanceKm(
    searchedCenter.latitude,
    searchedCenter.longitude,
    region.latitude,
    region.longitude,
  );
  // ~111 km per degree of latitude; 30% of the visible height, never under 500 m.
  const threshold = Math.max(0.5, region.latitudeDelta * 111 * 0.3);
  return moved > threshold;
}

export default function MosqueScreen() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
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
  const [location, setLocation] = useState<LatLng | null>(null);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingFresh, setFetchingFresh] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [searchedCenter, setSearchedCenter] = useState<LatLng | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);

  // Rests above the floating glass tab bar.
  const tabBarClearance = useTabBarClearance();

  // The sheet's live top edge — drives the recenter button so it sticks just
  // above the mosque list as the sheet is dragged.
  const sheetPosition = useSharedValue(0);
  const recenterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: Math.max(
          insets.top + 8,
          sheetPosition.value - RECENTER_SIZE - RECENTER_GAP,
        ),
      },
    ],
  }));

  const checkStatus = async () => {
    const sOn = await Location.hasServicesEnabledAsync();
    setServicesOn(sOn);
    const perm = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(perm.status as Perm);
  };

  const requestPermissionAndLoad = async () => {
    try {
      setLoading(true);
      setLoadError(null);
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
      setSearchedCenter({ latitude, longitude });

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
          setLoadError(LOAD_ERROR);
        }
      }
    } catch (err) {
      console.error("Mosque load error:", err);
      setLoadError(LOAD_ERROR);
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

  const fetchAround = async (center: LatLng) => {
    setLoadError(null);
    setFetchingFresh(true);
    try {
      const fresh = await getNearbyMosques(center.latitude, center.longitude);
      setMosques(fresh);
      setSearchedCenter(center);
    } catch (e) {
      console.error("Mosque fetch error:", e);
      setLoadError(LOAD_ERROR);
    } finally {
      setFetchingFresh(false);
    }
  };

  const handleSearchThisArea = async () => {
    if (!region) return;
    setShowSearchArea(false);
    await fetchAround({ latitude: region.latitude, longitude: region.longitude });
  };

  const retryLoad = () => {
    haptic("light");
    if (searchedCenter) {
      void fetchAround(searchedCenter);
    } else {
      void requestPermissionAndLoad();
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

  if (needLocationGate && !loading) {
    const servicesOff = servicesOn === false;
    const denied = permissionStatus === "denied";

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
            <ScreenHeader title="Mosques" />
            <View style={styles.gateContent}>
              {servicesOff ? (
                <EmptyState
                  icon="location"
                  title="Location Services Off"
                  message="Location is required to show nearby mosques and center the map."
                  actionLabel="How to turn on"
                  onAction={openLocationServicesHelp}
                  actionAccessibilityLabel="How to turn on location services"
                  secondaryLabel="I turned it on"
                  onSecondary={requestPermissionAndLoad}
                  secondaryAccessibilityLabel="Retry location setup"
                />
              ) : denied ? (
                <EmptyState
                  icon="location-outline"
                  title="Allow Location Access"
                  message="Grant Sirat access to your location for accurate nearby mosque results."
                  actionLabel="Open Settings"
                  onAction={openDeviceSettings}
                  actionAccessibilityLabel="Open device settings"
                  secondaryLabel="Try again"
                  onSecondary={requestPermissionAndLoad}
                  secondaryAccessibilityLabel="Retry location permission"
                />
              ) : (
                <EmptyState
                  icon="navigate"
                  title="We need your location"
                  message="Enable location to find mosques near you. You can turn it off again in Settings."
                  actionLabel="Enable Location"
                  onAction={requestPermissionAndLoad}
                  actionAccessibilityLabel="Enable location"
                />
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const emptyNearby =
    !fetchingFresh && !loadError && (mosques == null || mosques.length === 0);

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
        onRegionChangeComplete={(r, details) => {
          setRegion(r);
          setShowSearchArea(shouldOfferAreaSearch(r, searchedCenter, details?.isGesture));
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
              <AppIcon name="search" size={16} color={colors.white} />
              <Subhead color={colors.white} style={styles.searchAreaText}>Search this area</Subhead>
            </GlassSurface>
          </TouchableOpacity>
        </View>
      )}

      {loadError ? (
        <View
          style={[styles.emptyOverlayWrap, { top: insets.top + 64 }]}
          pointerEvents="box-none"
        >
          <GlassSurface tier="card" style={styles.errorCard} accessibilityRole="alert">
            <View style={styles.errorRow}>
              <AppIcon name="alert-circle" size={18} color={colors.accent} />
              <Subhead color={colors.white} style={styles.emptyText}>{loadError}</Subhead>
            </View>
            <Button
              label="Try again"
              variant="secondary"
              size="sm"
              icon="refresh"
              onPress={retryLoad}
              accessibilityLabel="Retry loading mosques"
              style={styles.errorAction}
            />
          </GlassSurface>
        </View>
      ) : emptyNearby ? (
        <View
          style={[styles.emptyOverlayWrap, { top: insets.top + 64 }]}
          pointerEvents="box-none"
        >
          <GlassSurface tier="card" style={styles.emptyCard}>
            <AppIcon name="search" size={18} color={colors.accent} />
            <Subhead color={colors.white} style={styles.emptyText}>
              No mosques found near your current location.
            </Subhead>
          </GlassSurface>
        </View>
      ) : null}

      {(loading || fetchingFresh) && (
        <View
          style={[styles.spinnerWrap, { top: insets.top + spacing.md }]}
          pointerEvents="none"
        >
          <GlassSurface tier="chrome" radius={theme.radii.pill} curve="circular" style={styles.spinner}>
            <ActivityIndicator size="small" color={colors.accent} />
          </GlassSurface>
        </View>
      )}

      <Animated.View
        style={[styles.recenterWrap, recenterAnimatedStyle]}
        pointerEvents="box-none"
      >
        <IconButton
          icon="locate"
          variant="glass"
          size={RECENTER_SIZE}
          iconSize={20}
          color={colors.white}
          onPress={recenter}
          accessibilityLabel="Recenter map on your location"
        />
      </Animated.View>

      <MosqueSheet
        mosques={mosques}
        userLoc={location}
        selectedId={selectedId}
        onSelect={onSelectMosque}
        onDirections={(m) => openDirections(m.lat, m.lng)}
        bottomInset={tabBarClearance}
        animatedPosition={sheetPosition}
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
  const { colors, spacing } = theme;

  return StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: "transparent" },
    screen: { flex: 1, backgroundColor: colors.primary },
    gateContainer: {
      flex: 1,
      padding: spacing.xl,
    },
    gateContent: { flex: 1, alignItems: "center", justifyContent: "center" },
    searchAreaWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
    },
    searchAreaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    searchAreaText: {
      fontWeight: "600",
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
    errorCard: {
      alignSelf: "stretch",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    errorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    errorAction: { alignSelf: "flex-start" },
    emptyText: {
      flexShrink: 1,
    },
    spinnerWrap: { position: "absolute", right: spacing.lg },
    spinner: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    recenterWrap: {
      position: "absolute",
      top: 0,
      right: spacing.lg,
    },
  });
};
