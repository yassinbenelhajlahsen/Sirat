import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { writePrayerSettings } from "@/services/notifications/storage";

beforeEach(async () => { await AsyncStorage.clear(); });

it("writes prayerSettings verbatim and emits settingsChanged", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const value = { useLocation: false, method: 2, city: { name: "Cairo", lat: 30, lng: 31 } };
  await writePrayerSettings(value);
  expect(JSON.parse((await AsyncStorage.getItem("prayerSettings"))!)).toEqual(value);
  expect(emit).toHaveBeenCalledWith("settingsChanged", expect.anything());
});
