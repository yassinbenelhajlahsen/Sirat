import { useCallback, useMemo, useState } from "react";

import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { DEFAULT_PRAYER_CITY, prayerSettingsSetting } from "@/services/syncedSettings";
import { clearPrayerCache } from "../services/prayerTimes";
import CITIES, { cityKey } from "../utils/cities";

/** The user's prayer settings for the Settings screen. Only real edits are saved. */
export function usePrayerSettingsState() {
  const { value } = useSyncedSetting(prayerSettingsSetting);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const city = value.city ?? DEFAULT_PRAYER_CITY;

  const cityItems = useMemo(
    () =>
      CITIES.map((c) => ({
        label: `${c.name}, ${c.country}`,
        value: cityKey(c),
      })),
    [],
  );

  const save = useCallback(async (change: Partial<typeof value>) => {
    try {
      await prayerSettingsSetting.set({ ...(await prayerSettingsSetting.get()), ...change });
    } catch (e) {
      console.warn("Failed to persist prayer settings:", e);
    }
    void clearPrayerCache();
  }, []);

  const setUseLocation = useCallback((useLocation: boolean) => void save({ useLocation }), [save]);
  const setMethod = useCallback((method: number) => void save({ method }), [save]);

  const selectCityByKey = useCallback(
    (key: string) => {
      const selected = CITIES.find((c) => cityKey(c) === key) || CITIES[0];
      void save({ city: selected });
      setCityModalVisible(false);
    },
    [save],
  );

  return {
    useLocation: value.useLocation,
    setUseLocation,
    method: value.method,
    setMethod,
    city,
    cityModalVisible,
    setCityModalVisible,
    cityItems,
    selectCityByKey,
  };
}
