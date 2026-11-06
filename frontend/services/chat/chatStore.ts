import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Citation } from "@/services/chat/chatApi";

// Device-local: never synced, and cleared on sign-out.
const HISTORY_KEY = "chat_history_v1";
const CONSENT_KEY = "chat_consent_v1";
const MAX_MESSAGES = 500;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  status?: "failed";
  citations?: Citation[];
  scholarLink?: string | null;
  notice?: "crisis" | "blocked" | "limit";
};

export type ChatState = { messages: ChatMessage[]; summary: string | null };

const EMPTY: ChatState = { messages: [], summary: null };

export async function loadChat(): Promise<ChatState> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return EMPTY;
    const stored = JSON.parse(raw) as Partial<ChatState>;
    return {
      messages: Array.isArray(stored.messages) ? stored.messages : [],
      summary: typeof stored.summary === "string" ? stored.summary : null,
    };
  } catch {
    return EMPTY;
  }
}

export async function saveChat(state: ChatState): Promise<void> {
  try {
    const messages = state.messages.slice(-MAX_MESSAGES);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify({ messages, summary: state.summary }));
  } catch {}
}

// Bumped by every clear, so a reply that lands after sign-out can tell its conversation is gone.
let clearGeneration = 0;

export function chatGeneration(): number {
  return clearGeneration;
}

export async function clearChat(): Promise<void> {
  clearGeneration += 1;
  try {
    await AsyncStorage.multiRemove([HISTORY_KEY, CONSENT_KEY]);
  } catch {}
}

export async function hasConsented(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setConsented(): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, "1");
  } catch {}
}
