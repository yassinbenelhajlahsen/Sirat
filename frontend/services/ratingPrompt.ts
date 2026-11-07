import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

import { getAppVersion } from "@/utils/appLinks";

const KEY = "rating_prompt_v1";
export const VISITS_BEFORE_PROMPT = 25;

type PromptState = { version: string; visits: number; asked: boolean };

/** Counts a visit and shows Apple's rating prompt once, on the 25th visit of each app version. */
export async function recordVisit(): Promise<void> {
  try {
    const version = getAppVersion();
    const saved: PromptState | null = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "null");
    // A new version restarts the count, so each update can ask once.
    const state = saved?.version === version ? saved : { version, visits: 0, asked: false };
    if (state.asked) return;
    state.visits += 1;
    state.asked = state.visits >= VISITS_BEFORE_PROMPT && (await StoreReview.hasAction());
    // Saved before asking so a crash mid-prompt can't ask twice.
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    if (state.asked) await StoreReview.requestReview();
  } catch {
    // best-effort: a rating prompt is never worth surfacing an error
  }
}
