// app/mosque/map.tsx

import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

const MOCK_MOSQUES = [
  {
    id: "1",
    name: "Ar-Rahman",
    address: "333 86th St, Brooklyn, NY 11209",
    lat: 40.6234,
    lng: -74.0306,
  },
  {
    id: "2",
    name: "Islamic Society of Bay Ridge",
    address: "6807 5th Ave, Brooklyn, NY 11220",
    lat: 40.6358,
    lng: -74.0243,
  },
  {
    id: "3",
    name: "Maryam Mosque",
    address: "7307 5th Ave, Brooklyn, NY 11209",
    lat: 40.635,
    lng: -74.0271,
  },
];

export default function MapScreen() {
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

  return (
    <View style={{ flex: 1 }}>
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
