import AsyncStorage from "@react-native-async-storage/async-storage";
import { matchByRegex } from "./duaMatcher";
import { topicForCategory, type DuaTopic } from "./duaTopics";

/**
 * Frontend Dua Service (fully offline)
 * - Regex matching runs locally
 * - No regex match returns the general dua
 */

export interface Dua {
  id: number;
  category: string;
  arabic: string;
  english: string;
  transliteration: string;
  reference: string;
  source: string;
}

const LOCAL_DUA_DATA = require("../assets/data/duas.json") as {
  duas: LocalDua[];
};
const LOCAL_DUAS = LOCAL_DUA_DATA.duas;

/**
 * Simulated delay to make UX feel more natural
 * Local matching is instant (<1ms), but feels abrupt
 * Add a small delay to make it feel like "thinking"
 */
const SIMULATED_DELAY_MS = 1200;

interface LocalDua extends Dua {
  tags: string[];
}

function toDua(localDua: LocalDua): Dua {
  return {
    id: localDua.id,
    category: localDua.category,
    arabic: localDua.arabic,
    english: localDua.english,
    transliteration: localDua.transliteration,
    reference: localDua.reference,
    source: localDua.source,
  };
}

function getRandomDuaByCategory(category: string): Dua | null {
  const matches = LOCAL_DUAS.filter((dua) => dua.category === category);
  if (matches.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * matches.length);
  return toDua(matches[randomIndex]);
}

export function getDuasForTopic(topicId: string): Dua[] {
  return LOCAL_DUAS.filter((dua) => topicForCategory(dua.category)?.id === topicId).map(toDua);
}

export function getDuaById(id: number): Dua | null {
  const found = LOCAL_DUAS.find((dua) => dua.id === id);
  return found ? toDua(found) : null;
}

// A different dua for the same need, never the one currently shown. Prefers the
// displayed topic; falls back to the wider pool when the topic has no other dua.
export function getAnotherDua(topic: DuaTopic | undefined, excludeId: number): Dua | null {
  const sameTopic = topic
    ? LOCAL_DUAS.filter(
        (dua) => dua.id !== excludeId && topicForCategory(dua.category)?.id === topic.id,
      )
    : [];
  const pool =
    sameTopic.length > 0 ? sameTopic : LOCAL_DUAS.filter((dua) => dua.id !== excludeId);
  if (pool.length === 0) {
    return null;
  }
  return toDua(pool[Math.floor(Math.random() * pool.length)]);
}

function getGeneralFallbackDua(): Dua {
  const general = LOCAL_DUAS.find(
    (dua) => dua.category.toLowerCase() === "general",
  );
  if (general) {
    return toDua(general);
  }
  return toDua(LOCAL_DUAS[0]);
}

async function applySimulatedLoading(startTime: number): Promise<void> {
  const elapsed = Date.now() - startTime;
  const delayNeeded = SIMULATED_DELAY_MS - elapsed;
  if (delayNeeded > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayNeeded));
  }
}

/**
 * Request flow:
 * 1) Try local regex + local duas
 * 2) No match: return the local general dua
 */
export async function requestDua(userRequest: string): Promise<Dua> {
  const startTime = Date.now();
  const trimmedRequest = userRequest.trim();
  if (!trimmedRequest) {
    throw new Error("Please enter what you need help with");
  }

  const regexCategory = matchByRegex(trimmedRequest);
  const dua =
    (regexCategory && getRandomDuaByCategory(regexCategory)) ||
    getGeneralFallbackDua();
  await applySimulatedLoading(startTime);
  return dua;
}

/**
 * Save dua to history in AsyncStorage
 * Frontend-only feature: tracks user's viewed duas
 *
 * Stored as: dua_history_v1 (versioned to avoid cache conflicts)
 * Keeps last 10 duas
 */
export async function saveDuaToHistory(dua: Dua): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem("dua_history_v1");
    const history: Dua[] = raw ? JSON.parse(raw) : [];

    // Newest first, one entry per dua, last 10
    const next = [dua, ...history.filter((d) => d.id !== dua.id)].slice(0, 10);

    await AsyncStorage.setItem("dua_history_v1", JSON.stringify(next));
  } catch (err) {
    console.error("❌ Error saving dua to history:", err);
    // Non-fatal: don't throw, just log
  }
}

/**
 * Retrieve dua history from AsyncStorage
 * Returns last 10 duas viewed by user
 */
export async function getDuaHistory(): Promise<Dua[]> {
  try {
    const raw = await AsyncStorage.getItem("dua_history_v1");
    const history = raw ? JSON.parse(raw) : [];
    return history;
  } catch (err) {
    console.error("❌ Error retrieving dua history:", err);
    return [];
  }
}

/** History newest first, one entry per dua (older builds could store repeats). */
export async function getRecentDuas(): Promise<Dua[]> {
  const seen = new Set<number>();
  return (await getDuaHistory()).filter((d) => !seen.has(d.id) && seen.add(d.id)).slice(0, 10);
}

/**
 * Clear all dua history
 */
export async function clearDuaHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem("dua_history_v1");
  } catch (err) {
    console.error("❌ Error clearing dua history:", err);
  }
}
