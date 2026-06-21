import AsyncStorage from "@react-native-async-storage/async-storage";

export const SETTINGS_META_KEY = "sync:settings_meta_v1";

export async function getSettingsMeta(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

async function write(meta: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_META_KEY, JSON.stringify(meta));
}

export async function bumpStamp(key: string, at: number = Date.now()): Promise<void> {
  const meta = await getSettingsMeta();
  meta[key] = at;
  await write(meta);
}

export async function setStamp(key: string, at: number): Promise<void> {
  const meta = await getSettingsMeta();
  meta[key] = at;
  await write(meta);
}
