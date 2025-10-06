import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Callout, Marker, Region } from "react-native-maps";
import {
  getCachedMosques,
  getNearbyMosques,
  Mosque,
} from "../services/getNearbyMosques";

export default function MapScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<null | {
    latitude: number;
    longitude: number;
  }>(null);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        setLocation({ latitude, longitude });
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });

        // Load cached data instantly
        const cached = await getCachedMosques(latitude, longitude);
        setMosques(cached);

        // Fetch new data in background
        const fresh = await getNearbyMosques(latitude, longitude);
        setMosques(fresh);
      } catch (error) {
        console.error("Error initializing map:", error);
      } finally {
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
    setLoading(true);
    setShowSearchButton(false);
    try {
      const data = await getCachedMosques(region.latitude, region.longitude);
      setMosques(data);
    } catch (e) {
      console.warn("Error fetching mosques:", e);
    } finally {
      setLoading(false);
    }
  };

  const openDirections = async (lat: number, lng: number) => {
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  if (loading && !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#DABA69" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/Mosques")}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={22} color="#DABA69" />
      </TouchableOpacity>

      {location && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          customMapStyle={customMapStyle}
          initialRegion={region!}
          onRegionChangeComplete={handleRegionChange}
          showsUserLocation
        >
          {mosques.map((mosque) => (
            <Marker
              key={mosque.id}
              coordinate={{ latitude: mosque.lat, longitude: mosque.lng }}
              tracksViewChanges={false}
            >
              <View style={styles.pinContainer}>
                <FontAwesome5 name="mosque" size={20} color="#134b0a" />
              </View>

              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{mosque.name}</Text>
                  <Text style={styles.calloutAddress}>{mosque.address}</Text>
                  <TouchableOpacity
                    style={styles.directionButton}
                    onPress={() => openDirections(mosque.lat, mosque.lng)}
                  >
                    <Ionicons name="navigate" size={14} color="#134b0a" />
                    <Text style={styles.directionText}>Directions</Text>
                  </TouchableOpacity>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {showSearchButton && (
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearchThisArea}
        >
          <Ionicons name="search" size={18} color="#134b0a" />
          <Text style={styles.searchButtonText}>Search this area</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#DABA69" />
        </View>
      )}
    </View>
  );
}

const customMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0c3605" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#DABA69" }] },
  { featureType: "poi.place_of_worship", stylers: [{ color: "#134b0a" }] },
];

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(19,75,10,0.85)",
    borderRadius: 30,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  pinContainer: {
    backgroundColor: "#DABA69",
    borderRadius: 30,
    padding: 6,
    borderWidth: 2,
    borderColor: "#134b0a",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  callout: {
    backgroundColor: "#134b0a",
    borderRadius: 12,
    padding: 12,
    width: 210,
    borderColor: "#DABA69",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutTitle: {
    color: "#DABA69",
    fontFamily: "SFProDisplay-Bold",
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  calloutAddress: {
    color: "white",
    fontFamily: "SFProDisplay-Regular",
    fontSize: 13,
    opacity: 0.9,
    marginBottom: 8,
    textAlign: "center",
  },
  directionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DABA69",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  directionText: {
    color: "#134b0a",
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
    backgroundColor: "rgba(218,186,105,0.95)",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  searchButtonText: {
    marginLeft: 6,
    fontWeight: "600",
    color: "#134b0a",
    fontSize: 15,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
});
