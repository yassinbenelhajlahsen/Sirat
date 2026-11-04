import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import { getEffectivePrayerSettings, toEffectivePrayerSettings } from "@/services/prayerSettings";
import { DEFAULT_PRAYER_CITY, prayerSettingsSetting } from "@/services/syncedSettings";
import CITIES, { cityKey } from "@/utils/cities";

jest.mock("expo-location", () => ({
  hasServicesEnabledAsync: jest.fn(async () => true),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
}));

const mockLocation = Location as jest.Mocked<typeof Location>;
const chicago = { name: "Chicago", country: "US", lat: 41.88, lng: -87.63 };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("prayer settings (what the user chose)", () => {
  it("defaults to location on, Auto method and no city", async () => {
    expect(await prayerSettingsSetting.get()).toEqual({ useLocation: true, method: -1, city: null });
  });

  it("round-trips an edit and keeps cityKey for older builds", async () => {
    await prayerSettingsSetting.set({ useLocation: false, method: 5, city: CITIES[1] });
    const stored = JSON.parse((await AsyncStorage.getItem("prayerSettings"))!);
    expect(stored).toEqual({
      useLocation: false,
      method: 5,
      city: CITIES[1],
      cityKey: cityKey(CITIES[1]),
    });
    expect(await prayerSettingsSetting.get()).toEqual(stored);
  });

  it("resolves a city from a stored cityKey when the city object is missing", async () => {
    await AsyncStorage.setItem(
      "prayerSettings",
      JSON.stringify({ useLocation: false, method: 3, cityKey: cityKey(CITIES[2]) }),
    );
    expect((await prayerSettingsSetting.get()).city).toEqual(CITIES[2]);
  });

  it("falls back to the legacy selectedCity key only when prayerSettings is missing", async () => {
    await AsyncStorage.setItem("selectedCity", cityKey(CITIES[2]));
    expect((await prayerSettingsSetting.get()).city).toEqual(CITIES[2]);

    await AsyncStorage.setItem("prayerSettings", JSON.stringify({ useLocation: true, method: 2 }));
    expect((await prayerSettingsSetting.get()).city).toBeNull();
  });

  it("normalizes a stored city", async () => {
    await AsyncStorage.setItem(
      "prayerSettings",
      JSON.stringify({ useLocation: false, method: 4, city: { name: "  Chicago ", lat: "41.8", lng: "-87.6" } }),
    );
    expect((await prayerSettingsSetting.get()).city).toEqual({ name: "Chicago", country: "", lat: 41.8, lng: -87.6 });
  });

  it("ignores malformed remote values", async () => {
    expect(await prayerSettingsSetting.applyRemote("nope")).toBe(false);
    expect(await prayerSettingsSetting.applyRemote({ method: "x", useLocation: 1, city: { name: 3 } })).toBe(true);
    expect(await prayerSettingsSetting.get()).toEqual({ useLocation: true, method: -1, city: null });
  });
});

describe("effective prayer settings (what applies on this device)", () => {
  it("uses location only when the device grants it", () => {
    const chosen = { useLocation: true, method: 2, city: chicago };
    expect(toEffectivePrayerSettings(chosen, true).useLocation).toBe(true);
    expect(toEffectivePrayerSettings(chosen, false)).toEqual({ useLocation: false, method: 2, city: chicago });
  });

  it("never turns location on when the user chose off", () => {
    expect(toEffectivePrayerSettings({ useLocation: false, method: 2, city: chicago }, true).useLocation).toBe(false);
  });

  it("falls back to the default city when none was picked", () => {
    expect(toEffectivePrayerSettings({ useLocation: false, method: -1, city: null }, true).city).toEqual(
      DEFAULT_PRAYER_CITY,
    );
  });

  it("is never stored: a denied permission leaves the saved choice untouched and unstamped", async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" } as never);
    await AsyncStorage.setItem("prayerSettings", JSON.stringify({ useLocation: true, method: 2, city: chicago }));

    const effective = await getEffectivePrayerSettings();

    expect(effective).toEqual({ useLocation: false, method: 2, city: chicago });
    expect((await prayerSettingsSetting.get()).useLocation).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem("prayerSettings"))!).useLocation).toBe(true);
    expect(await AsyncStorage.getItem("sync:settings_meta_v1")).toBeNull();
  });
});
