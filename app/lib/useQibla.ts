import * as Location from "expo-location";
import { Accelerometer, Magnetometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDegrees(rad: number) {
  return (rad * 180) / Math.PI;
}

// Compute bearing from (lat1, lon1) → (lat2, lon2) in degrees [0,360)
function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let θ = toDegrees(Math.atan2(y, x));
  if (θ < 0) θ += 360;
  return θ;
}



export default function useQibla() {
  const [heading, setHeading] = useState<number>(0);
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Get user location & compute Qibla bearing once */
  useEffect(() => {
    (async () => {
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
  }, []); // Added empty dependency array

  // Simulator for web or debug mode
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const id = setInterval(() => {
      setHeading((h) => (h + 1) % 360);
    }, 100);
    return () => clearInterval(id);
  }, []); // Added empty dependency array

  // Magnetometer (native only)
 useEffect(() => {
  if (Platform.OS === "web") return;

  const interval = setInterval(async () => {
    try {
      const headingData = await Location.getHeadingAsync();
      setHeading(headingData.trueHeading ?? headingData.magHeading);
    } catch (e) {
      setError("Failed to get heading: " + (e as Error).message);
    }
  }, 150); // Adjust refresh rate as needed

  return () => clearInterval(interval);
}, []);


  

  // Compute rotation for your UI
const rotation =
  qiblaAngle != null && heading != null
    ? (qiblaAngle - heading + 360) % 360
    : null;
  return { rotation, heading, qiblaAngle, error };
}
