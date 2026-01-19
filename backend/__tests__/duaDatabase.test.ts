import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  formatDuaMetadataForContext,
  getDuasByCategory,
  getRandomDua,
  getRandomDuaByCategory,
  type Dua,
} from "../src/utils/duaDatabase.js";

describe("duaDatabase", () => {
  const mockDuas: Dua[] = [
    {
      id: 1,
      category: "healing",
      tags: ["health", "illness", "recovery"],
      arabic: "اللَّهُمَّ رَبَّ النَّاسِ",
      english: "O Allah, Lord of mankind",
      transliteration: "Allahumma Rabban-naas",
      reference: "Sahih Bukhari 5743",
      source: "hadith",
    },
    {
      id: 2,
      category: "anxiety",
      tags: ["worry", "fear", "stress"],
      arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ",
      english: "O Allah, I seek refuge in You",
      transliteration: "Allahumma inni a'udhu bika",
      reference: "Sahih Bukhari 6369",
      source: "hadith",
    },
    {
      id: 3,
      category: "anxiety",
      tags: ["panic", "overwhelm"],
      arabic: "حَسْبِيَ اللَّهُ",
      english: "Allah is sufficient for me",
      transliteration: "Hasbi Allah",
      reference: "Quran 9:129",
      source: "quran",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Note: loadDuas tests are skipped because mocking fs/promises in ESM is complex
  // In practice, loadDuas is tested indirectly through integration tests

  describe("formatDuaMetadataForContext", () => {
    it("should format dua metadata correctly", () => {
      const dua = mockDuas[0];
      const result = formatDuaMetadataForContext(dua);

      expect(result).toBe("[1] healing | health, illness, recovery");
    });

    it("should handle empty tags array", () => {
      const dua: Dua = {
        ...mockDuas[0],
        tags: [],
      };
      const result = formatDuaMetadataForContext(dua);

      expect(result).toBe("[1] healing | ");
    });

    it("should handle single tag", () => {
      const dua: Dua = {
        ...mockDuas[0],
        tags: ["health"],
      };
      const result = formatDuaMetadataForContext(dua);

      expect(result).toBe("[1] healing | health");
    });
  });

  describe("getRandomDua", () => {
    it("should return a random dua from the array", () => {
      const result = getRandomDua(mockDuas);

      expect(result).toBeDefined();
      expect(mockDuas).toContainEqual(result);
    });

    it("should return null for empty array", () => {
      const result = getRandomDua([]);

      expect(result).toBeNull();
    });

    it("should return the only dua if array has one element", () => {
      const singleDua = [mockDuas[0]];
      const result = getRandomDua(singleDua);

      expect(result).toEqual(mockDuas[0]);
    });

    it("should return different duas over multiple calls", () => {
      const results = new Set();
      const largeDuaArray = Array.from({ length: 10 }, (_, i) => ({
        ...mockDuas[0],
        id: i + 1,
      }));

      // Run multiple times to check randomness
      for (let i = 0; i < 50; i++) {
        const dua = getRandomDua(largeDuaArray);
        if (dua) results.add(dua.id);
      }

      // Should get more than one unique result
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe("getDuasByCategory", () => {
    it("should return all duas matching a category", () => {
      const result = getDuasByCategory(mockDuas, "anxiety");

      expect(result.length).toBe(2);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(3);
    });

    it("should return empty array for non-existent category", () => {
      const result = getDuasByCategory(mockDuas, "nonexistent");

      expect(result).toEqual([]);
    });

    it("should return single dua for unique category", () => {
      const result = getDuasByCategory(mockDuas, "healing");

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it("should be case-insensitive", () => {
      const result1 = getDuasByCategory(mockDuas, "ANXIETY");
      const result2 = getDuasByCategory(mockDuas, "Anxiety");
      const result3 = getDuasByCategory(mockDuas, "anxiety");

      expect(result1.length).toBe(2);
      expect(result2.length).toBe(2);
      expect(result3.length).toBe(2);
    });

    it("should return empty array for empty duas array", () => {
      const result = getDuasByCategory([], "anxiety");

      expect(result).toEqual([]);
    });
  });

  describe("getRandomDuaByCategory", () => {
    it("should return a random dua from the specified category", () => {
      const result = getRandomDuaByCategory(mockDuas, "anxiety");

      expect(result).toBeDefined();
      expect(result?.category).toBe("anxiety");
      expect([2, 3]).toContain(result?.id);
    });

    it("should return null for non-existent category", () => {
      const result = getRandomDuaByCategory(mockDuas, "nonexistent");

      expect(result).toBeNull();
    });

    it("should return the only dua if category has one dua", () => {
      const result = getRandomDuaByCategory(mockDuas, "healing");

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.category).toBe("healing");
    });

    it("should be case-insensitive", () => {
      const result1 = getRandomDuaByCategory(mockDuas, "HEALING");
      const result2 = getRandomDuaByCategory(mockDuas, "Healing");
      const result3 = getRandomDuaByCategory(mockDuas, "healing");

      expect(result1?.category.toLowerCase()).toBe("healing");
      expect(result2?.category.toLowerCase()).toBe("healing");
      expect(result3?.category.toLowerCase()).toBe("healing");
    });

    it("should return null for empty duas array", () => {
      const result = getRandomDuaByCategory([], "anxiety");

      expect(result).toBeNull();
    });

    it("should return different duas over multiple calls", () => {
      const results = new Set();

      // Run multiple times to check randomness
      for (let i = 0; i < 50; i++) {
        const dua = getRandomDuaByCategory(mockDuas, "anxiety");
        if (dua) results.add(dua.id);
      }

      // Should get both anxiety duas (id 2 and 3)
      expect(results.size).toBe(2);
      expect(results.has(2)).toBe(true);
      expect(results.has(3)).toBe(true);
    });
  });
});
