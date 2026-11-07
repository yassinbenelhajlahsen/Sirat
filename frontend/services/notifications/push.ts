import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { apiPost } from "@/services/apiClient";
import { recordError } from "@/services/diagnostics";

import { STORAGE_ANNOUNCEMENTS, STORAGE_PUSH_TOKEN } from "./constants";

export const REGISTER_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const TOKEN_TIMEOUT_MS = 15_000;

type SavedToken = { token: string; registeredAt: number };

let queue: Promise<void> = Promise.resolve();
let initDone = false;
let failureLogged = false;

export async function readAnnouncementsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_ANNOUNCEMENTS)) !== "0";
}

async function readSaved(): Promise<SavedToken | null> {
  const raw = await AsyncStorage.getItem(STORAGE_PUSH_TOKEN);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export async function readSavedPushToken(): Promise<string | null> {
  return (await readSaved())?.token ?? null;
}

async function isPermissionGranted(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

// getExpoPushTokenAsync can hang on iOS when APNs is unreachable, which would stall the queue.
async function fetchPushToken(projectId: string): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), TOKEN_TIMEOUT_MS);
  });
  try {
    const { data } = await Promise.race([Notifications.getExpoPushTokenAsync({ projectId }), timeout]);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function run(): Promise<void> {
  try {
    if (Platform.OS !== "ios" || !Device.isDevice) return;

    const wanted = (await readAnnouncementsEnabled()) && (await isPermissionGranted());
    const saved = await readSaved();

    if (!wanted) {
      if (!saved) return;
      await apiPost("/api/push/unregister", { token: saved.token });
      await AsyncStorage.removeItem(STORAGE_PUSH_TOKEN);
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    if (saved) {
      const age = Date.now() - saved.registeredAt;
      if (age >= 0 && age < REGISTER_INTERVAL_MS) return;
    }

    const token = await fetchPushToken(projectId);
    // Saved as stale before the POST: a lost response still leaves the server row reachable by a later unregister.
    await AsyncStorage.setItem(
      STORAGE_PUSH_TOKEN,
      JSON.stringify({ token, registeredAt: 0 } satisfies SavedToken),
    );
    await apiPost("/api/push/register", { token });
    await AsyncStorage.setItem(
      STORAGE_PUSH_TOKEN,
      JSON.stringify({ token, registeredAt: Date.now() } satisfies SavedToken),
    );
  } catch {
    // Fixed message: the token must never reach the bug log, and loggedFetch already records the failed request. Once per session so retries on every foreground cannot flood the 50-entry log.
    if (failureLogged) return;
    failureLogged = true;
    recordError("error", new Error("Push registration failed"));
  }
}

export function syncPushRegistration(): Promise<void> {
  queue = queue.then(run, run);
  return queue;
}

export async function setAnnouncementsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_ANNOUNCEMENTS, enabled ? "1" : "0");
  await syncPushRegistration();
}

export function initPushRegistration(): void {
  if (initDone) return;
  initDone = true;
  void syncPushRegistration();
  AppState.addEventListener("change", (state) => {
    if (state === "active") void syncPushRegistration();
  });
}
