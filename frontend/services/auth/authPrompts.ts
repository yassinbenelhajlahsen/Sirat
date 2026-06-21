import AsyncStorage from "@react-native-async-storage/async-storage";

const HOME_CARD_DISMISSED_KEY = "auth:home_card_dismissed_v1";
const HOME_CARD_LAST_SHOWN_KEY = "auth:home_card_last_shown_v1";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

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

export async function shouldShowHomeCard(): Promise<boolean> {
  try {
    if (await isHomeCardDismissed()) return false;
    const raw = await AsyncStorage.getItem(HOME_CARD_LAST_SHOWN_KEY);
    if (raw === null) return true;
    return Date.now() - Number(raw) >= THREE_DAYS_MS;
  } catch {
    return false;
  }
}

export async function markHomeCardShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_CARD_LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    // swallow
  }
}
