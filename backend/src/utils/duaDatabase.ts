import fs from "fs/promises";
import path from "path";

export interface Dua {
  id: number;
  category: string;
  tags: string[];
  arabic: string;
  english: string;
  transliteration: string;
  reference: string;
  source: string;
}

let duasCache: Dua[] | null = null;

/**
 * Load duas.json into memory on first call, then cache
 * This is the single source of truth for dua data
 */
export async function loadDuas(): Promise<Dua[]> {
  if (duasCache) return duasCache;

  try {
    const filePath = path.join(process.cwd(), "public", "duas.json");
    const data = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(data);
    duasCache = parsed.duas || [];
    return duasCache as Dua[];
  } catch (err) {
    console.error("❌ Failed to load duas.json:", err);
    return [];
  }
}

/**
 * Get a random dua (fallback when the "general" category is empty)
 */
export function getRandomDua(duas: Dua[]): Dua | null {
  if (duas.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * duas.length);
  return duas[randomIndex];
}

/**
 * Get all duas matching a specific category
 * Returns array of matching duas
 */
export function getDuasByCategory(duas: Dua[], category: string): Dua[] {
  return duas.filter(
    (dua) => dua.category.toLowerCase() === category.toLowerCase(),
  );
}

/**
 * Get a random dua from a specific category
 * Returns null if no duas found in that category
 */
export function getRandomDuaByCategory(
  duas: Dua[],
  category: string,
): Dua | null {
  const matchingDuas = getDuasByCategory(duas, category);
  if (matchingDuas.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * matchingDuas.length);
  return matchingDuas[randomIndex];
}
