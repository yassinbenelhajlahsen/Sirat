import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Network from "expo-network";
import { matchByRegex } from "./duaMatcher";

/**
 * Frontend Dua Service (offline-first)
 * - Regex matching runs locally (works offline)
 * - AI matching runs on backend (requires internet)
 * - If offline + no regex match, return a general dua
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

interface DuaResponse {
  dua: Dua;
  matchSource?: "ai" | "fallback";
}

const DUA_API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";
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

async function hasInternetConnection(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Request flow:
 * 1) Try local regex + local duas
 * 2) If no local match and online, ask backend AI
 * 3) If no local match and offline, return local general dua
 */
export async function requestDua(userRequest: string): Promise<Dua> {
  const startTime = Date.now();
  try {
    const trimmedRequest = userRequest.trim();
    if (!trimmedRequest) {
      throw new Error("Please enter what you need help with");
    }

    const regexCategory = matchByRegex(trimmedRequest);
    if (regexCategory) {
      const matchedDua = getRandomDuaByCategory(regexCategory);
      if (matchedDua) {
        console.log(
          `✅ Local regex match: "${trimmedRequest}" → ${regexCategory} → ${matchedDua.id}`,
        );
        await applySimulatedLoading(startTime);
        return matchedDua;
      }
    }

    const isOnline = await hasInternetConnection();
    if (!isOnline) {
      const fallbackDua = getGeneralFallbackDua();
      console.log(
        `📴 Offline + no regex match: using general dua ${fallbackDua.id}`,
      );
      await applySimulatedLoading(startTime);
      return fallbackDua;
    }

    console.log(`📤 No local regex match. Requesting AI backup for "${trimmedRequest}"`);
    const response = await axios.post<DuaResponse>(`${DUA_API_BASE}/api/dua`, {
      userRequest: trimmedRequest,
    });

    const { dua, matchSource } = response.data;
    console.log(`✅ AI backup dua: ${dua.id} (${dua.category}) via ${matchSource || "unknown"}`);

    // Validate structure
    if (
      !dua.id ||
      !dua.category ||
      !dua.arabic ||
      !dua.english ||
      !dua.transliteration
    ) {
      throw new Error("Invalid dua structure received from backend");
    }

    return dua;
  } catch (err: any) {
    console.error("❌ Dua request error:", err.message);

    const isNetworkError =
      err.code === "ECONNREFUSED" ||
      err.code === "ERR_NETWORK" ||
      err.message === "Network Error";
    if (isNetworkError) {
      const fallbackDua = getGeneralFallbackDua();
      console.log(
        `📴 Network error while using AI backup. Using general dua ${fallbackDua.id}`,
      );
      await applySimulatedLoading(startTime);
      return fallbackDua;
    }

    if (err.response?.status === 400) {
      throw new Error(err.response.data.error || "Invalid request");
    }

    if (err.response?.status === 500) {
      throw new Error("Backend error. Please try again.");
    }

    throw new Error(err.message || "Failed to find a dua. Please try again.");
  }
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

    // Add to front
    history.unshift(dua);

    // Keep only last 10
    if (history.length > 10) {
      history.pop();
    }

    await AsyncStorage.setItem("dua_history_v1", JSON.stringify(history));
    console.log(`📝 Saved dua to history (total: ${history.length})`);
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
    console.log(`📖 Retrieved ${history.length} duas from history`);
    return history;
  } catch (err) {
    console.error("❌ Error retrieving dua history:", err);
    return [];
  }
}

/**
 * Clear all dua history
 */
export async function clearDuaHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem("dua_history_v1");
    console.log("🗑️  Cleared dua history");
  } catch (err) {
    console.error("❌ Error clearing dua history:", err);
  }
}
