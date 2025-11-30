import { colors, withOpacity } from "@/constants/theme";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getCachedMosques,
  getNearbyMosques,
  Mosque,
} from "../../services/getNearbyMosques";
import PressableScale from "../components/PressableScale";

type Perm = "undetermined" | "denied" | "granted";

export default function MosqueScreen() {
  const router = useRouter();

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
      const fresh = await getNearbyMosques(latitude, longitude);
      setMosques(fresh);
    } catch (err) {
      console.error("Mosque fetch error:", err);
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
        "Unable to open settings. Please open device settings and grant Location permission."
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
      }) as string
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

  if (loading && !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <Text style={styles.title}>Mosques</Text>
            <View style={{ flex: 1, marginTop: 20 }}>
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
                  message="Grant Sirat access to your location for accurate nearby mosque results."
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
                  message="Tap enable to find mosques near you. You can disable anytime in Settings."
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
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const renderItem = ({ item }: { item: Mosque }) => {
    const scale = new Animated.Value(1);
    const onPressIn = () =>
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
    const onPressOut = () =>
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <PressableScale
          onPress={() => openDirections(item.lat, item.lng)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <FontAwesome5 name="mosque" size={22} color={colors.accent} solid />
            <Text style={styles.name}>{item.name}</Text>
          </View>
          <Text style={styles.address}>{item.address}</Text>
        </PressableScale>
      </Animated.View>
    );
  };

  const emptyNearby =
    !fetchingFresh && (mosques == null || mosques.length === 0);

  return (
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Mosques</Text>

          <Text style={styles.header}>Nearby</Text>
          {emptyNearby ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyRow}>
                <Ionicons name="search" size={18} color={colors.accent} />
                <Text style={[styles.emptyText, { marginLeft: 10, flex: 1 }]}>
                  No mosques found near your current location.
                </Text>
              </View>
            </View>
          ) : (
            <FlatList
              data={mosques.slice(0, 3)}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          )}

          <Text style={styles.header}>Map</Text>
          <PressableScale
            style={styles.mapContainer}
            onPress={() => router.push("/components/map")}
            activeOpacity={0.9}
          >
            <MapView
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: location!.latitude,
                longitude: location!.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsUserLocation
              customMapStyle={customMapStyle}
            >
              {mosques.map((m) => (
                <Marker
                  key={m.id}
                  coordinate={{ latitude: m.lat, longitude: m.lng }}
                  tracksViewChanges={false}
                >
                  <View style={styles.pinContainer}>
                    <FontAwesome5
                      name="mosque"
                      size={18}
                      color={colors.primary}
                    />
                  </View>

                  <Callout tooltip>
                    <View style={styles.callout}>
                      <Text style={styles.calloutTitle}>{m.name}</Text>
                      <Text style={styles.calloutAddress}>{m.address}</Text>
                      <TouchableOpacity
                        style={styles.directionButton}
                        onPress={() => openDirections(m.lat, m.lng)}
                      >
                        <Ionicons
                          name="navigate"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.directionText}>Directions</Text>
                      </TouchableOpacity>
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>
            {fetchingFresh && (
              <View style={styles.mapSpinner}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            )}
          </PressableScale>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const customMapStyle = [
  { elementType: "geometry", stylers: [{ color: colors.primaryDark }] },
  { elementType: "labels.text.fill", stylers: [{ color: colors.accent }] },
  { featureType: "poi.place_of_worship", stylers: [{ color: colors.primary }] },
];

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "transparent" },
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    color: colors.white,
    fontFamily: "SFProDisplay-Bold",
    fontSize: 36,
    marginBottom: 8,
    textShadowColor: withOpacity(colors.black, 0.4),
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  header: {
    color: colors.accent,
    fontSize: 22,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: 16,
    marginTop: 4,
    textShadowColor: withOpacity(colors.black, 0.3),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
  },
  ctaPrimaryText: { color: colors.primary, fontWeight: "700" },
  ctaSecondary: {
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaSecondaryText: { color: colors.accent, fontWeight: "600" },
  card: {
    backgroundColor: colors.primarySurfaceAlt,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.25),
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  name: {
    color: colors.white,
    fontFamily: "SFProDisplay-Semibold",
    fontSize: 19,
    flexShrink: 1,
    textShadowColor: withOpacity(colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  address: {
    color: colors.white,
    fontFamily: "SFProDisplay-Regular",
    fontSize: 15,
    opacity: 0.85,
    marginBottom: 4,
    alignItems: "center",
  },
  mapContainer: {
    height: 230,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.25),
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    position: "relative",
  },
  mapSpinner: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: withOpacity(colors.black, 0.35),
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pinContainer: {
    backgroundColor: colors.accent,
    borderRadius: 30,
    padding: 5,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  callout: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 10,
    width: 200,
    borderColor: colors.accent,
    borderWidth: 1,
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutTitle: {
    color: colors.accent,
    fontFamily: "SFProDisplay-Bold",
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  calloutAddress: {
    color: colors.white,
    fontFamily: "SFProDisplay-Regular",
    fontSize: 13,
    opacity: 0.9,
    marginBottom: 8,
    textAlign: "center",
  },
  directionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  directionText: {
    color: colors.primary,
    fontWeight: "600",
    marginLeft: 5,
    fontSize: 13,
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: withOpacity(colors.white, 0.05),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.25),
    padding: 14,
    gap: 6,
    marginBottom: 24,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  emptyText: { color: colors.white, fontSize: 15 },
  emptySub: { color: colors.accent, fontSize: 13 },
  link: { color: colors.accent, textDecorationLine: "underline" },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
});
