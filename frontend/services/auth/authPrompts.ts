import AsyncStorage from "@react-native-async-storage/async-storage";

const HOME_CARD_DISMISSED_KEY = "auth:home_card_dismissed_v1";

export async function isHomeCardDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(HOME_CARD_DISMISSED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function dismissHomeCard(): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_CARD_DISMISSED_KEY, "1");
  } catch {
    // best effort
  }
}
