import { colors as themeColors, withOpacity } from "@/app/constants/theme";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import MapView, {
  Callout,
  CalloutSubview,
  Marker,
  Region,
} from "react-native-maps";
import {
  getCachedMosques,
  getNearbyMosques,
  Mosque,
} from "../../services/getNearbyMosques";

type Perm = "undetermined" | "denied" | "granted";

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const [permissionStatus, setPermissionStatus] =
    useState<Perm>("undetermined");
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);

  const [location, setLocation] = useState<null | {
    latitude: number;
    longitude: number;
  }>(null);
  const [region, setRegion] = useState<Region | null>(null);

  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sOn = await Location.hasServicesEnabledAsync();
        setServicesOn(sOn);
        if (!sOn) {
          setLoading(false);
          return;
        }

        let perm = await Location.getForegroundPermissionsAsync();
        setPermissionStatus(perm.status as Perm);
        if (perm.status !== "granted") {
          perm = await Location.requestForegroundPermissionsAsync();
          setPermissionStatus(perm.status as Perm);
        }
        if (perm.status !== "granted") {
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;
        setLocation({ latitude, longitude });
        const initialRegion: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setRegion(initialRegion);

        const cached = await getCachedMosques(latitude, longitude);
        setMosques(cached);

        setFetching(true);
        const fresh = await getNearbyMosques(latitude, longitude);
        setMosques(fresh);
      } catch (error) {
        console.error("Error initializing map:", error);
      } finally {
        setFetching(false);
        setLoading(false);
      }
    })();
  }, []);

  const handleRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
    setShowSearchButton(true);
  };

  const handleSearchThisArea = async () => {
    if (!region) return;
    setFetching(true);
    setShowSearchButton(false);
    try {
      const fresh = await getNearbyMosques(region.latitude, region.longitude);
      setMosques(fresh);
    } catch (e) {
      console.warn("Error fetching mosques:", e);
      Alert.alert("Error", "Could not refresh this area right now.");
    } finally {
      setFetching(false);
    }
  };

  const openDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Open Settings",
        "Please open device settings and grant Location permission."
      );
    }
  };

  const openLocationServicesHelp = () => {
    Alert.alert(
      "Turn On Location Services",
      Platform.select({
        ios: "Settings → Privacy & Security → Location Services",
        android: "Enable Location in Quick Settings or Settings → Location",
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
      Alert.alert("Error", "Unable to open Apple Maps for directions");
    }
  };

  const needGate =
    !loading &&
    (servicesOn === false ||
      permissionStatus !== "granted" ||
      location == null ||
      region == null);

  if (loading && !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={themeColors.accent} />
      </View>
    );
  }

  if (needGate) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: themeColors.primary,
          paddingTop: 50,
          paddingHorizontal: 20,
        }}
      >
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/Mosques")}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={themeColors.accent} />
        </TouchableOpacity>

        <View style={[styles.banner, { marginTop: 20 }]}>
          <Ionicons
            name="location-outline"
            size={20}
            color={themeColors.primary}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.bannerTitle}>Location required</Text>
            <Text style={styles.bannerText}>
              Turn on Location Services and allow access to search this map.
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.ctaPrimary}
                onPress={openLocationServicesHelp}
              >
                <Text style={styles.ctaPrimaryText}>How to turn on</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaSecondary}
                onPress={openDeviceSettings}
              >
                <Text style={styles.ctaSecondaryText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const empty = mosques.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/Mosques")}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={22} color={themeColors.accent} />
      </TouchableOpacity>

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        customMapStyle={customMapStyle}
        initialRegion={region!}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation
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
                size={20}
                color={themeColors.primary}
              />
            </View>

            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{m.name}</Text>
                <Text style={styles.calloutAddress}>{m.address}</Text>
                <CalloutSubview onPress={() => openDirections(m.lat, m.lng)}>
                  <View style={styles.directionButton}>
                    <Ionicons
                      name="navigate"
                      size={14}
                      color={themeColors.primary}
                    />
                    <Text style={styles.directionText}>Directions</Text>
                  </View>
                </CalloutSubview>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {empty && (
        <View style={styles.emptyOverlay}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={themeColors.accent}
          />
          <Text style={styles.emptyText}>No mosques in this view.</Text>
          <Text style={styles.emptySub}>Move the map and search again.</Text>
        </View>
      )}

      {showSearchButton && (
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearchThisArea}
        >
          <Ionicons name="search" size={18} color={themeColors.primary} />
          <Text style={styles.searchButtonText}>Search this area</Text>
        </TouchableOpacity>
      )}

      {fetching && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={themeColors.accent} />
        </View>
      )}
    </View>
  );
}

const customMapStyle = [
  { elementType: "geometry", stylers: [{ color: themeColors.primaryDark }] },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: themeColors.accent }],
  },
  {
    featureType: "poi.place_of_worship",
    stylers: [{ color: themeColors.primary }],
  },
];

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: themeColors.primary,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: withOpacity(themeColors.primary, 0.85),
    borderRadius: 30,
    padding: 10,
    shadowColor: themeColors.black,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  banner: {
    backgroundColor: withOpacity(themeColors.accent, 0.18),
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.35),
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bannerTitle: {
    color: themeColors.accent,
    fontSize: 16,
    fontFamily: "SFProDisplay-Semibold",
  },
  bannerText: {
    color: themeColors.white,
    opacity: 0.95,
    fontSize: 14,
    marginTop: 4,
  },
  row: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  ctaPrimary: {
    backgroundColor: themeColors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaPrimaryText: { color: themeColors.primary, fontWeight: "700" },
  ctaSecondary: {
    borderColor: themeColors.accent,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaSecondaryText: { color: themeColors.accent, fontWeight: "600" },
  pinContainer: {
    backgroundColor: themeColors.accent,
    borderRadius: 30,
    padding: 6,
    borderWidth: 2,
    borderColor: themeColors.primary,
    shadowColor: themeColors.black,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  callout: {
    backgroundColor: themeColors.primary,
    borderRadius: 12,
    padding: 12,
    width: 210,
    borderColor: themeColors.accent,
    borderWidth: 1,
    shadowColor: themeColors.black,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutTitle: {
    color: themeColors.accent,
    fontFamily: "SFProDisplay-Bold",
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  calloutAddress: {
    color: themeColors.white,
    fontFamily: "SFProDisplay-Regular",
    fontSize: 13,
    opacity: 0.9,
    marginBottom: 8,
    textAlign: "center",
  },
  directionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: themeColors.accent,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  directionText: {
    color: themeColors.primary,
    fontWeight: "600",
    marginLeft: 5,
    fontSize: 13,
    textAlign: "center",
  },
  searchButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: withOpacity(themeColors.accent, 0.95),
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: themeColors.black,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  searchButtonText: {
    marginLeft: 6,
    fontWeight: "600",
    color: themeColors.primary,
    fontSize: 15,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity(themeColors.black, 0.25),
    justifyContent: "center",
    alignItems: "center",
  },
  emptyOverlay: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    backgroundColor: withOpacity(themeColors.black, 0.35),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  emptyText: { color: themeColors.white, fontSize: 14 },
  emptySub: { color: themeColors.accent, fontSize: 12 },
  helper: { color: themeColors.accentMuted, fontSize: 14, marginTop: 14 },
  link: { color: themeColors.accent, textDecorationLine: "underline" },
});
