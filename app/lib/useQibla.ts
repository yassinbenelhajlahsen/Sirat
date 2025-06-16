import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";

const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDegrees(rad: number) {
  return (rad * 180) / Math.PI;
}

// Compute bearing from (lat1, lon1) → (lat2, lon2) in degrees [0,360)
function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2)
    - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let θ = toDegrees(Math.atan2(y, x));
  if (θ < 0) θ += 360;
  return θ;
}

export default function useQibla({ simulate = false }: { simulate?: boolean } = {}) {
  const [heading, setHeading] = useState<number>(0);
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Get user location & compute Qibla bearing once */
  useEffect(() => {
    (async () => {
      if (simulate) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied.");
          return;
        }
        const { coords } = await Location.getCurrentPositionAsync({});
        const bearing = computeBearing(
          coords.latitude,
          coords.longitude,
          KAABA_LAT,
          KAABA_LON
        );
        setQiblaAngle(bearing);
      } catch (e: any) {
        setError("Failed to get location: " + e.message);
      }
    })();
  }, [simulate]);

  //  Simulator for web or debug mode
  useEffect(() => {
    if (!simulate) return;
    const id = setInterval(() => {
      setHeading((h) => (h + 1) % 360);
    }, 100);
    return () => clearInterval(id);
  }, [simulate]);

  // Magnetometer (native only)
  useEffect(() => {
    if (simulate || Platform.OS === "web") return;
    let sub: { remove: () => void };
    try {
      Magnetometer.setUpdateInterval(100);
      sub = Magnetometer.addListener((data) => {
        let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        setHeading(angle);
      });
    } catch (e) {
      setError("Compass not available on this device.");
    }
    return () => sub && sub.remove();
  }, [simulate]);

  // Compute rotation for your UI
  const rotation =
    qiblaAngle !== null ? (qiblaAngle - heading + 360) % 360 : null;

  return { rotation, heading, qiblaAngle, error };
}