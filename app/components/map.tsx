// app/mosque/map.tsx

import { useEffect, useState } from "react";
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import MOCK_MOSQUES from "../util/mock_mosques";
import { useRouter } from "expo-router";

export default function MapScreen() {
      const router = useRouter();

  const [location, setLocation] = useState<null | {
    latitude: number;
    longitude: number;
  }>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  const region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
    : {
        latitude: 40.634,
        longitude: -74.026,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
      if (!location) {
  return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <ActivityIndicator size="large" color="#DABA69" />
  </View>
}

  return (
    <View style={{ flex: 1 }}>

      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.push("/Mosques")}
        style={{
          position: "absolute",
          top: 50,
          left: 20,
          zIndex: 10,
          backgroundColor: "#134b0a",
          borderRadius: 30,
          padding: 8,
          elevation: 5,
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#DABA69" />
      </TouchableOpacity>

      <MapView style={StyleSheet.absoluteFillObject} region={region} showsUserLocation>
        {MOCK_MOSQUES.map((mosque) => (
          <Marker
            key={mosque.id}
            coordinate={{ latitude: mosque.lat, longitude: mosque.lng }}
            title={mosque.name}
            description={mosque.address}
          />
        ))}
      </MapView>
    </View>
  );
}
