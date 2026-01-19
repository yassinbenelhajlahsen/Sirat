import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

/**
 * Frontend Dua Service
 *
 * STRICT PRINCIPLE: Frontend is a pure renderer only
 * - NO duas.json
 * - NO matching logic
 * - NO fallback selection
 * - NO OpenAI calls
 * - NO Islamic decisions
 *
 * Responsibilities:
 * 1. Call backend /api/dua/match with user input
 * 2. Cache dua history locally
 * 3. Render returned dua
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

const DUA_API_BASE =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Request a dua from backend based on user input
 *
 * Backend handles:
 * - Loading duas.json
 * - Calling OpenAI
 * - Selecting appropriate dua
 * - Fallback to random if OpenAI fails
 * - Validating dua ID
 *
 * Frontend only receives: { dua: Dua }
 */
export async function requestDua(userRequest: string): Promise<Dua> {
  try {
    if (!userRequest.trim()) {
      throw new Error("Please enter what you need help with");
    }

    console.log(`📤 Requesting dua for: "${userRequest}"`);

    const response = await axios.post(`${DUA_API_BASE}/api/dua/match`, {
      userRequest: userRequest.trim(),
    });

    // Backend returns: { dua: {...} }
    const dua = response.data.dua as Dua;

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

    console.log(`✅ Received dua: ${dua.id} (${dua.category})`);
    return dua;
  } catch (err: any) {
    console.error("❌ Dua request error:", err.message);

    if (err.response?.status === 400) {
      throw new Error(err.response.data.error || "Invalid request");
    }

    if (err.response?.status === 500) {
      throw new Error("Backend error. Please try again.");
    }

    if (err.code === "ECONNREFUSED") {
      throw new Error("Cannot connect to backend. Is it running?");
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
