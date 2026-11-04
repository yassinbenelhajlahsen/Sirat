import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  normalizeCity,
  readMasterEnabled,
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

  it("persists and reads scheduled ids / seen keys", async () => {
    await writeScheduledIds(["id-1", "id-2"]);
    await writeSeenKeys(["Fajr_2026-01-01T05:00"]);

    await expect(readScheduledIds()).resolves.toEqual(["id-1", "id-2"]);
    await expect(readSeenKeys()).resolves.toEqual(["Fajr_2026-01-01T05:00"]);

    expect(await AsyncStorage.getItem(SCHEDULE_KEY)).toBeTruthy();
    expect(await AsyncStorage.getItem(SEEN_KEY)).toBeTruthy();
  });
});
