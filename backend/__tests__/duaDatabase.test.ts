import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import {
  formatDuaMetadataForContext,
  getRandomDua,
  type Dua,
} from '../src/utils/duaDatabase.js';

describe('duaDatabase', () => {
  const mockDuas: Dua[] = [
    {
      id: 1,
      category: 'healing',
      tags: ['health', 'illness', 'recovery'],
      arabic: 'اللَّهُمَّ رَبَّ النَّاسِ',
      english: 'O Allah, Lord of mankind',
      transliteration: "Allahumma Rabban-naas",
      reference: 'Sahih Bukhari 5743',
      source: 'hadith',
    },
    {
      id: 2,
      category: 'anxiety',
      tags: ['worry', 'fear', 'stress'],
      arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ',
      english: 'O Allah, I seek refuge in You',
      transliteration: "Allahumma inni a'udhu bika",
      reference: 'Sahih Bukhari 6369',
      source: 'hadith',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Note: loadDuas tests are skipped because mocking fs/promises in ESM is complex
  // In practice, loadDuas is tested indirectly through integration tests

  describe('formatDuaMetadataForContext', () => {
    it('should format dua metadata correctly', () => {
      const dua = mockDuas[0];
      const result = formatDuaMetadataForContext(dua);

      expect(result).toBe('[1] healing | health, illness, recovery');
    });

    it('should handle empty tags array', () => {
      const dua: Dua = {
        ...mockDuas[0],
        tags: [],
      };
      const result = formatDuaMetadataForContext(dua);

      expect(result).toBe('[1] healing | ');
    });

    it('should handle single tag', () => {
      const dua: Dua = {
        ...mockDuas[0],
        tags: ['health'],
      };
      const result = formatDuaMetadataForContext(dua);

      expect(result).toBe('[1] healing | health');
    });
  });

  describe('getRandomDua', () => {
    it('should return a random dua from the array', () => {
      const result = getRandomDua(mockDuas);

      expect(result).toBeDefined();
      expect(mockDuas).toContainEqual(result);
    });

    it('should return null for empty array', () => {
      const result = getRandomDua([]);

      expect(result).toBeNull();
    });

    it('should return the only dua if array has one element', () => {
      const singleDua = [mockDuas[0]];
      const result = getRandomDua(singleDua);

      expect(result).toEqual(mockDuas[0]);
    });

    it('should return different duas over multiple calls', () => {
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
});
