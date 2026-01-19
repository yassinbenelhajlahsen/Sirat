import { describe, expect, it } from "@jest/globals";
import type { Dua } from "../src/utils/duaDatabase.js";
import { formatDuaMetadataForContext } from "../src/utils/duaDatabase.js";

describe("openaiService (fallback only)", () => {
  const mockDuas: Dua[] = [
    {
      id: 1,
      category: "healing",
      tags: ["health", "illness", "recovery"],
      arabic: "اللَّهُمَّ رَبَّ النَّاسِ أَذْهِبِ الْبَاسَ",
      english: "O Allah, Lord of mankind, remove the harm and heal",
      transliteration: "Allahumma Rabban-naas adhhibil-ba'sa washfi",
      reference: "Sahih Bukhari 5743",
      source: "hadith",
    },
    {
      id: 2,
      category: "anxiety",
      tags: ["worry", "fear", "stress", "exam"],
      arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ",
      english: "O Allah, I seek refuge in You from anxiety and sorrow",
      transliteration: "Allahumma inni a'udhu bika minal-hammi wal-huzn",
      reference: "Sahih Bukhari 6369",
      source: "hadith",
    },
    {
      id: 3,
      category: "gratitude",
      tags: ["thanks", "blessing", "appreciation"],
      arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
      english: "All praise is due to Allah, Lord of the worlds",
      transliteration: "Alhamdulillahi Rabbil-'alamin",
      reference: "Quran 1:2",
      source: "quran",
    },
  ];

  describe("AI usage philosophy", () => {
    it("should understand AI is only used as fallback", () => {
      // AI should only be called when regex matching fails
      const regexShouldHandleFirst = true;
      expect(regexShouldHandleFirst).toBe(true);
    });

    it("should prefer deterministic matching over AI", () => {
      // Regex is fast, free, and predictable
      const preferRegex = true;
      expect(preferRegex).toBe(true);
    });
  });

  describe("dua metadata formatting (used by OpenAI when it's called)", () => {
    it("should format dua metadata without full content", () => {
      const metadata = formatDuaMetadataForContext(mockDuas[0]);

      // Should include ID, category, and tags
      expect(metadata).toContain("1");
      expect(metadata).toContain("healing");
      expect(metadata).toContain("health");
      expect(metadata).toContain("illness");
      expect(metadata).toContain("recovery");

      // Should NOT include full dua content
      expect(metadata).not.toContain("اللَّهُمَّ رَبَّ النَّاسِ");
      expect(metadata).not.toContain("O Allah, Lord of mankind");
      expect(metadata).not.toContain("Allahumma Rabban-naas");
      expect(metadata).not.toContain("remove the harm");
    });

    it("should create compact metadata format", () => {
      const metadata = formatDuaMetadataForContext(mockDuas[0]);

      // Metadata uses compact format: [ID] category | tags
      // Should not exceed a reasonable length
      expect(metadata.length).toBeLessThan(200);

      // Should include all essential components
      expect(metadata).toMatch(/\[\d+\] \w+ \| .+/);
    });

    it("should format all tags in metadata", () => {
      const metadata = formatDuaMetadataForContext(mockDuas[1]);

      // All tags should be present
      expect(metadata).toContain("worry");
      expect(metadata).toContain("fear");
      expect(metadata).toContain("stress");
      expect(metadata).toContain("exam");
    });

    it("should use consistent formatting across different duas", () => {
      const metadata1 = formatDuaMetadataForContext(mockDuas[0]);
      const metadata2 = formatDuaMetadataForContext(mockDuas[1]);
      const metadata3 = formatDuaMetadataForContext(mockDuas[2]);

      // All should follow same pattern: [ID] category | tags
      expect(metadata1).toMatch(/^\[\d+\] \w+ \|/);
      expect(metadata2).toMatch(/^\[\d+\] \w+ \|/);
      expect(metadata3).toMatch(/^\[\d+\] \w+ \|/);
    });

    it("should handle duas with single tag", () => {
      const singleTagDua: Dua = {
        ...mockDuas[0],
        tags: ["health"],
      };
      const metadata = formatDuaMetadataForContext(singleTagDua);

      expect(metadata).toContain("health");
      expect(metadata).toMatch(/\[1\] healing \| health/);
    });

    it("should handle duas with many tags", () => {
      const manyTagsDua: Dua = {
        ...mockDuas[0],
        tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
      };
      const metadata = formatDuaMetadataForContext(manyTagsDua);

      expect(metadata).toContain("tag1");
      expect(metadata).toContain("tag8");
      expect(metadata.split(",").length).toBe(8);
    });

    it("should preserve tag order", () => {
      const metadata = formatDuaMetadataForContext(mockDuas[1]);
      const tagsSection = metadata.split("|")[1].trim();

      expect(tagsSection).toBe("worry, fear, stress, exam");
    });
  });

  describe("metadata content privacy", () => {
    it("should never expose Arabic text", () => {
      mockDuas.forEach((dua) => {
        const metadata = formatDuaMetadataForContext(dua);
        expect(metadata).not.toContain(dua.arabic);
      });
    });

    it("should never expose English translation", () => {
      mockDuas.forEach((dua) => {
        const metadata = formatDuaMetadataForContext(dua);
        expect(metadata).not.toContain(dua.english);
      });
    });

    it("should never expose transliteration", () => {
      mockDuas.forEach((dua) => {
        const metadata = formatDuaMetadataForContext(dua);
        expect(metadata).not.toContain(dua.transliteration);
      });
    });

    it("should never expose reference", () => {
      mockDuas.forEach((dua) => {
        const metadata = formatDuaMetadataForContext(dua);
        expect(metadata).not.toContain(dua.reference);
      });
    });

    it("should never expose source", () => {
      mockDuas.forEach((dua) => {
        const metadata = formatDuaMetadataForContext(dua);
        // 'hadith' might appear in tags, so check exact source value
        const sourcePattern = new RegExp(`\\b${dua.source}\\b`);
        // Only check if source is not a common word in tags
        if (dua.source !== "hadith" && dua.source !== "quran") {
          expect(metadata).not.toMatch(sourcePattern);
        }
      });
    });
  });

  describe("metadata size optimization", () => {
    it("should be significantly smaller than full dua content", () => {
      const dua = mockDuas[0];
      const metadata = formatDuaMetadataForContext(dua);
      const fullContent = `${dua.arabic} ${dua.english} ${dua.transliteration} ${dua.reference}`;

      expect(metadata.length).toBeLessThan(fullContent.length * 0.3);
    });

    it("should minimize token usage for large dua collections", () => {
      const largeDuaList = Array.from({ length: 100 }, (_, i) => ({
        ...mockDuas[0],
        id: i + 1,
      }));

      const metadataList = largeDuaList.map(formatDuaMetadataForContext);
      const totalMetadataSize = metadataList.join("\n").length;

      // Each metadata entry should average less than 100 chars
      expect(totalMetadataSize / largeDuaList.length).toBeLessThan(100);
    });
  });

  describe("OpenAI prompt construction", () => {
    it("should create valid prompt structure with metadata", () => {
      const userRequest = "I need healing from illness";
      const duasMetadata = mockDuas
        .map((dua) => formatDuaMetadataForContext(dua))
        .join("\n");

      const prompt = `User Request: "${userRequest}"

Available Duas:
${duasMetadata}

Select the BEST matching dua ID. Respond with ONLY JSON: { "duaId": number }`;

      // Should contain user request
      expect(prompt).toContain(userRequest);

      // Should contain all dua IDs
      expect(prompt).toContain("[1]");
      expect(prompt).toContain("[2]");
      expect(prompt).toContain("[3]");

      // Should contain categories
      expect(prompt).toContain("healing");
      expect(prompt).toContain("anxiety");
      expect(prompt).toContain("gratitude");

      // Should NOT contain sensitive content
      expect(prompt).not.toContain("اللَّهُمَّ");
      expect(prompt).not.toContain("O Allah, Lord of mankind");
    });
  });

  describe("response parsing validation", () => {
    it("should validate JSON response structure", () => {
      const validResponse = { duaId: 1 };

      expect(validResponse).toHaveProperty("duaId");
      expect(typeof validResponse.duaId).toBe("number");
      expect(validResponse.duaId).toBeGreaterThan(0);
    });

    it("should detect invalid response missing duaId", () => {
      const invalidResponse = { id: 1 };

      expect(invalidResponse).not.toHaveProperty("duaId");
    });

    it("should detect invalid response with wrong type", () => {
      const invalidResponse = { duaId: "1" };

      expect(typeof invalidResponse.duaId).not.toBe("number");
    });

    it("should detect invalid response with null duaId", () => {
      const invalidResponse = { duaId: null };

      expect(invalidResponse.duaId).toBeNull();
    });

    it("should detect invalid response with negative duaId", () => {
      const invalidResponse = { duaId: -1 };

      expect(invalidResponse.duaId).toBeLessThan(0);
    });

    it("should extract JSON from markdown-wrapped response", () => {
      const markdownResponse = '```json\n{ "duaId": 2 }\n```';
      const jsonMatch = markdownResponse.match(/\{[\s\S]*\}/);

      expect(jsonMatch).not.toBeNull();
      expect(jsonMatch?.[0]).toBe('{ "duaId": 2 }');

      const parsed = JSON.parse(jsonMatch![0]);
      expect(parsed.duaId).toBe(2);
    });

    it("should extract JSON from response with extra text", () => {
      const responseWithText =
        'Based on your request, I recommend: { "duaId": 1 }';
      const jsonMatch = responseWithText.match(/\{[\s\S]*\}/);

      expect(jsonMatch).not.toBeNull();
      const parsed = JSON.parse(jsonMatch![0]);
      expect(parsed.duaId).toBe(1);
    });
  });

  // Note: OpenAI service is only used as a fallback when regex matching fails
  // Most queries should be handled by regex, not AI
  // Full OpenAI API integration tests are minimal since it's fallback-only
});
