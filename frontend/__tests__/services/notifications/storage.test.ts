import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  buildEffectiveSettings,
  normalizeCity,
  readMasterEnabled,
  readPrayerSettings,
  readScheduledIds,
  readSeenKeys,
  writeScheduledIds,
  writeSeenKeys,
} from "@/services/notifications/storage";
import {
  STORAGE_ENABLED,
} from "@/utils/notifications/constants";

const SCHEDULE_KEY = "notif_schedule_ids_v1";
const SEEN_KEY = "notif_seen_keys_v1";

describe("notifications/storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("normalizes a valid city payload", () => {
    expect(
      normalizeCity({
        name: "  New York ",
        lat: "40.7128",
        lng: "-74.0060",
        country: "US",
        id: "nyc",
      }),
    ).toEqual({
      name: "New York",
      lat: 40.7128,
      lng: -74.006,
      country: "US",
      id: "nyc",
    });
  });

  it("returns null for invalid city payload", () => {
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity({ name: "City", lat: "x", lng: 10 })).toBeNull();
  });

  it("reads the master toggle", async () => {
    await AsyncStorage.setItem(STORAGE_ENABLED, "1");
    await expect(readMasterEnabled()).resolves.toBe(true);

    await AsyncStorage.setItem(STORAGE_ENABLED, "0");
    await expect(readMasterEnabled()).resolves.toBe(false);
  });

  it("reads prayer settings with defaults when storage is empty", async () => {
    await expect(readPrayerSettings()).resolves.toEqual({
      useLocation: true,
      method: -1,
      city: null,
    });
  });

  it("reads prayer settings and normalizes city", async () => {
    await AsyncStorage.setItem(
      "prayerSettings",
      JSON.stringify({
        useLocation: false,
        method: 4,
        city: { name: "  Chicago ", lat: "41.8", lng: "-87.6" },
      }),
    );

    await expect(readPrayerSettings()).resolves.toEqual({
      useLocation: false,
      method: 4,
      city: { name: "Chicago", lat: 41.8, lng: -87.6, country: undefined, id: undefined },
    });
  });

  it("persists and reads scheduled ids / seen keys", async () => {
    await writeScheduledIds(["id-1", "id-2"]);
    await writeSeenKeys(["Fajr_2026-01-01T05:00"]);

    await expect(readScheduledIds()).resolves.toEqual(["id-1", "id-2"]);
    await expect(readSeenKeys()).resolves.toEqual(["Fajr_2026-01-01T05:00"]);

    expect(await AsyncStorage.getItem(SCHEDULE_KEY)).toBeTruthy();
    expect(await AsyncStorage.getItem(SEEN_KEY)).toBeTruthy();
  });

  it("builds effective settings based on OS location availability", () => {
    const withLocation = { useLocation: true, method: 2, city: { name: "X", lat: 1, lng: 2 } };

    expect(buildEffectiveSettings(withLocation, true).useLocation).toBe(true);
    expect(buildEffectiveSettings(withLocation, false).useLocation).toBe(false);

    const manual = { useLocation: false, method: 2, city: { name: "X", lat: 1, lng: 2 } };
    expect(buildEffectiveSettings(manual, true).useLocation).toBe(false);
  });
});
