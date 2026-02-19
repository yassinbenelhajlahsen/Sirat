// util/useQibla.ts
import * as Location from "expo-location";
import { AppState, AppStateStatus, Platform } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = toDeg(Math.atan2(y, x));
  if (θ < 0) θ += 360;
  return θ;
}
function norm360(a: number) { const r = a % 360; return r < 0 ? r + 360 : r; }
function shortestDelta(a: number, b: number) { return ((b - a + 540) % 360) - 180; }

export type UseQiblaResult = {
  rotation: number | null; 
  heading: number | null;   
  qiblaAngle: number | null;
  accuracy: number | null;  
  error: string | null;
  isAligned: boolean;        // within tolerance for haptics
};

export default function useQibla(): UseQiblaResult {
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const smoothRef = useRef<number | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  // Fetch position once
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied.");
          return;
        }
        const { coords } = await Location.getCurrentPositionAsync({});
        setQiblaAngle(computeBearing(coords.latitude, coords.longitude, KAABA_LAT, KAABA_LON));
      } catch {
        setError("Could not read your location.");
      }
    })();
  }, []);

  const stopHeading = useCallback(() => {
    if (subRef.current && typeof subRef.current.remove === "function") {
      try { subRef.current.remove(); } catch {}
    }
    subRef.current = null;
  }, []);

  const startHeading = useCallback(async () => {
    if (Platform.OS === "web") {
      stopHeading();
      const id = setInterval(() => {
        const prev = smoothRef.current ?? 0;
        const next = norm360(prev + 2);
        smoothRef.current = next;
        setHeading(next);
        setAccuracy(5);
      }, 80);
      subRef.current = { remove: () => clearInterval(id) };
      return;
    }

    try {
      stopHeading();
      subRef.current = await Location.watchHeadingAsync((hdg) => {
        const raw =
          typeof hdg.trueHeading === "number" && hdg.trueHeading >= 0
            ? hdg.trueHeading
            : typeof hdg.magHeading === "number" && hdg.magHeading >= 0
            ? hdg.magHeading
            : NaN;

        if (!Number.isFinite(raw)) {
          setError("Compass not available.");
          return;
        }

        const acc = typeof hdg.accuracy === "number" ? hdg.accuracy : -1;
        setAccuracy(acc);

        const prev = smoothRef.current;
        const nextRaw = norm360(raw);

        if (prev == null) {
          smoothRef.current = nextRaw;
        } else {
          // Adaptive smoothing:
          // - Follow quickly for large turns
          // - Heavier damping for micro jitter or poor accuracy
          const delta = shortestDelta(prev, nextRaw);
          const absDelta = Math.abs(delta);

          // Base alpha from accuracy
          let alpha =
            acc > 0 && acc <= 8 ? 0.45 :
            acc > 8 && acc <= 20 ? 0.32 :
            0.22; // poor/unknown accuracy

          // Boost alpha when the user is turning a lot
          if (absDelta > 25) alpha = Math.max(alpha, 0.65);
          else if (absDelta > 12) alpha = Math.max(alpha, 0.5);

          smoothRef.current = norm360(prev + alpha * delta);
        }

        setHeading(smoothRef.current!);
      });
    } catch {
      setError("Could not access the compass sensor.");
    }
  }, [stopHeading]);

  // Lifecycle
  useEffect(() => {
    let mounted = true;
    const onState = (s: AppStateStatus) => {
      if (!mounted) return;
      if (s === "active") startHeading();
      else stopHeading();
    };
    const sub = AppState.addEventListener("change", onState);
    startHeading();
    return () => { mounted = false; sub.remove(); stopHeading(); };
  }, [startHeading, stopHeading]);

  const rotation =
    qiblaAngle != null && heading != null ? norm360(qiblaAngle - heading) : null;

  const isAligned =
    typeof rotation === "number" ? Math.abs(shortestDelta(0, rotation)) <= 2 : false;

  return { rotation, heading, qiblaAngle, accuracy, error, isAligned };
}
