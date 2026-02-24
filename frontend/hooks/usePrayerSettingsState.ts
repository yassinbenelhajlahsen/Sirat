import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { clearPrayerCache } from "../services/prayerTimes";
import CITIES, { City, cityKey } from "../utils/cities";

export function usePrayerSettingsState() {
  const [useLocation, setUseLocation] = useState(true);
  const [method, setMethod] = useState(-1);
  const [city, setCity] = useState<City>(CITIES[0]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const cityItems = useMemo(
    () =>
      CITIES.map((c) => ({
        label: `${c.name}, ${c.country}`,
        value: cityKey(c),
      })),
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("prayerSettings");
        if (raw) {
          const parsed = JSON.parse(raw);
          setUseLocation(parsed.useLocation ?? true);
          setMethod(parsed.method ?? -1);
          if (parsed.cityKey) {
            const found = CITIES.find((c) => cityKey(c) === parsed.cityKey);
            if (found) setCity(found);
          } else if (parsed.city) {
            setCity(parsed.city);
          }
        } else {
          const legacy = await AsyncStorage.getItem("selectedCity");
          if (legacy) {
            const found = CITIES.find((c) => cityKey(c) === legacy);
            if (found) setCity(found);
          }
        }
      } catch (e) {
        console.warn("Failed to load prayer settings:", e);
      } finally {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    (async () => {
      const payload = {
        useLocation,
        method,
        cityKey: cityKey(city),
        city,
      };

      try {
        await AsyncStorage.setItem("prayerSettings", JSON.stringify(payload));
        if (!useLocation) {
          await AsyncStorage.setItem("selectedCity", cityKey(city));
        }
      } catch (e) {
        console.warn("Failed to persist prayer settings:", e);
      }

      void clearPrayerCache();
      try {
        DeviceEventEmitter?.emit?.("settingsChanged", payload);
      } catch {
        // ignore emit errors
      }
    })();
  }, [city, method, settingsLoaded, useLocation]);

  const selectCityByKey = useCallback((value: string) => {
    const selected = CITIES.find((c) => cityKey(c) === value) || CITIES[0];
    setCity(selected);
    setCityModalVisible(false);
  }, []);

  return {
    useLocation,
    setUseLocation,
    method,
    setMethod,
    city,
    cityModalVisible,
    setCityModalVisible,
    cityItems,
    selectCityByKey,
  };
}
