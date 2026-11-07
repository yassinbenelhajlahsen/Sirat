import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// Dev-only, device-local. Pairs with CHAT_DEV_BYPASS=1 on a local server, which then skips sign-in and the
// monthly limit for requests that carry the dev header. Read synchronously so chat requests can send it.
export const DEV_CHAT_BYPASS_KEY = "dev_chat_bypass_v1";

let on = false;
const listeners = new Set<() => void>();

function applyChatDevBypass(next: boolean): void {
  if (next === on) return;
  on = next;
  for (const listener of [...listeners]) listener();
}

export function isChatDevBypass(): boolean {
  return on;
}

export function subscribeChatDevBypass(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChatDevBypass(): boolean {
  return useSyncExternalStore(subscribeChatDevBypass, isChatDevBypass);
}

export async function getChatDevBypass(): Promise<boolean> {
  if (!__DEV__) return false;
  return (await AsyncStorage.getItem(DEV_CHAT_BYPASS_KEY)) === "1";
}

export async function loadChatDevBypass(): Promise<void> {
  applyChatDevBypass(await getChatDevBypass());
}

export async function setChatDevBypass(next: boolean): Promise<void> {
  if (!__DEV__) return;
  applyChatDevBypass(next);
  await AsyncStorage.setItem(DEV_CHAT_BYPASS_KEY, next ? "1" : "0");
}
