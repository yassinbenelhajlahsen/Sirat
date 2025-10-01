// app/(tabs)/Settings.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  DeviceEventEmitter,
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import CitySearchModal from "../components/CitySearchModal";
import { clearPrayerCache } from "../services/yearlyPrayerTimes";
import CALCULATION_METHODS from "../util/calculationMethods";
import CITIES, { City, cityKey } from "../util/cities";

export default function Settings() {
  const colors = {
    bg: "#134b0a",
    card: "#134b0a",
    cardAlt: "#1e5c1a",
    text: "#ffffff",
    accent: "#DABA69",
    border: "#ffffff",
  };

  const [useLocation, setUseLocation] = useState(true);

  const [methodOpen, setMethodOpen] = useState(false);
  const [method, setMethod] = useState(2);
  const [methodItems, setMethodItems] = useState(
    CALCULATION_METHODS.map((m) => ({ label: m.name, value: m.id }))
  );

  const [city, setCity] = useState<City>(CITIES[0]);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const cityItems = useMemo(
    () =>
      CITIES.map((c) => ({
        label: `${c.name}, ${c.country}`,
        value: cityKey(c),
      })),
    []
  );

  // Load saved settings
  useEffect(() => {
    (async () => {
      const storedSettings = await AsyncStorage.getItem("prayerSettings");
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        setUseLocation(parsed.useLocation ?? true);
        setMethod(parsed.method ?? 2);
        if (parsed.cityKey) {
          const found = CITIES.find((c) => cityKey(c) === parsed.cityKey);
          if (found) setCity(found);
        } else if (parsed.city) {
          setCity(parsed.city);
        }
      }

      // legacy support
      const legacy = await AsyncStorage.getItem("selectedCity");
      if (legacy) {
        const byKey = CITIES.find((c) => cityKey(c) === legacy);
        if (byKey) setCity(byKey);
        else {
          const byName = CITIES.find((c) => c.name === legacy);
          if (byName) setCity(byName);
        }
      }
    })();
  }, []);

  // Persist + notify
  useEffect(() => {
    const save = async () => {
      const payload = {
        useLocation,
        method,
        cityKey: cityKey(city),
        city,
      };
      await AsyncStorage.setItem("prayerSettings", JSON.stringify(payload));
      if (!useLocation) {
        await AsyncStorage.setItem("selectedCity", cityKey(city));
      }
      clearPrayerCache();
      DeviceEventEmitter.emit("settingsChanged", payload);
    };
    save();
  }, [useLocation, method, city]);

  const selectCityByKey = (value: string) => {
    const selected = CITIES.find((c) => cityKey(c) === value) || CITIES[0];
    setCity(selected);
    setCityModalVisible(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Title */}
      <View style={{ paddingTop: 10, paddingHorizontal: 20 }}>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.text,
            fontFamily: "SFProDisplay-Bold",
            fontSize: 40,
          }}
        >
          Settings
        </Text>
      </View>

      {/* Calculation Method */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, zIndex: 2000 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 16,
            marginBottom: 8,
            fontFamily: "SFProDisplay-Semibold",
          }}
        >
          Calculation Method
        </Text>
        <DropDownPicker
          open={methodOpen}
          value={method}
          items={methodItems}
          setOpen={setMethodOpen}
          setValue={setMethod}
          setItems={setMethodItems}
          style={{
            backgroundColor: colors.cardAlt,
            borderColor: colors.accent,
            minHeight: 50,
            borderRadius: 12,
            marginBottom: methodOpen ? 12 : 0,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 4,
          }}
          dropDownContainerStyle={{
            backgroundColor: colors.cardAlt,
            borderColor: colors.accent,
            borderRadius: 12,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 4,
          }}
          textStyle={{
            color: colors.text,
            fontSize: 16,
            fontFamily: "SFProDisplay-Semibold",
          }}
          arrowIconStyle={{ tintColor: colors.accent }}
          labelStyle={{ color: colors.text, fontSize: 16 }}
          selectedItemLabelStyle={{
            color: colors.accent,
            fontFamily: "SFProDisplay-Bold",
          }}
          listItemLabelStyle={{
            color: colors.text,
            fontFamily: "SFProDisplay-Regular",
          }}
          listMode="SCROLLVIEW"
          animationDuration={250}
          animationType="fade"
          placeholder="Select calculation method"
          placeholderStyle={{
            color: "#aaa",
            fontFamily: "SFProDisplay-Regular",
          }}
          showTickIcon={true}
          tickIconStyle={{ tintColor: colors.accent }}
        />
      </View>

      {/* Location toggle */}
      <View
        style={{
          paddingHorizontal: 20,
          marginTop: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Use My Location
          </Text>
          <Text
            style={{
              color: colors.text,
              opacity: 0.8,
              fontSize: 13,
              marginTop: 2,
            }}
          >
            Turn off to select a city manually
          </Text>
        </View>

        <Switch
          accessibilityLabel="Use my location"
          value={useLocation}
          onValueChange={setUseLocation}
          trackColor={{ false: "#555", true: colors.accent }}
          thumbColor={useLocation ? "#fff" : "#888"}
        />
      </View>

      {/* Manual city selector */}
      {!useLocation && (
        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              marginBottom: 8,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Manual City
          </Text>

          <Pressable
            onPress={() => setCityModalVisible(true)}
            accessibilityRole="button"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 15 }}>
              {city
                ? `${city.name}${city.country ? ", " + city.country : ""}`
                : "Select City"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* City search modal */}
      <CitySearchModal
        visible={cityModalVisible}
        onClose={() => setCityModalVisible(false)}
        onSelectKey={selectCityByKey}
        items={cityItems}
      />
    </SafeAreaView>
  );
}
