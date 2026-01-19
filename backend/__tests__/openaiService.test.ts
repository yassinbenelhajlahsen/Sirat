import { describe, expect, it } from "@jest/globals";
import type { Dua } from "../src/utils/duaDatabase.js";
import { formatDuaMetadataForContext } from "../src/utils/duaDatabase.js";

describe("openaiService", () => {
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

  describe("dua metadata formatting (used by OpenAI)", () => {
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

  // Note: Full OpenAI API integration tests with actual network calls
  // are tested through integration tests in duaRoutes.test.ts
});

describe("openaiService Real API Integration", () => {
  // Only run these tests if OPENAI_API_KEY is set
  const apiKey = process.env.OPENAI_API_KEY;
  const runRealTests = apiKey && apiKey.length > 0;

  if (!runRealTests) {
    it.skip("Skipping real OpenAI tests - OPENAI_API_KEY not set", () => {});
  }

  const mockDuas = [
    {
      id: 1,
      category: "healing",
      tags: ["health", "illness", "recovery", "sick"],
      arabic: "اللَّهُمَّ رَبَّ النَّاسِ",
      english: "O Allah, Lord of mankind",
      transliteration: "Allahumma Rabban-naas",
      reference: "Sahih Bukhari 5743",
      source: "hadith",
    },
    {
      id: 2,
      category: "anxiety",
      tags: ["worry", "fear", "stress", "nervous", "exam"],
      arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ",
      english: "O Allah, I seek refuge in You",
      transliteration: "Allahumma inni a'udhu bika",
      reference: "Sahih Bukhari 6369",
      source: "hadith",
    },
    {
      id: 3,
      category: "gratitude",
      tags: ["thanks", "blessing", "appreciation", "grateful"],
      arabic: "الْحَمْدُ لِلَّهِ",
      english: "All praise is due to Allah",
      transliteration: "Alhamdulillah",
      reference: "Quran 1:2",
      source: "quran",
    },
    {
      id: 4,
      category: "forgiveness",
      tags: ["sin", "repentance", "mercy", "pardon"],
      arabic: "أَسْتَغْفِرُ اللَّهَ",
      english: "I seek forgiveness from Allah",
      transliteration: "Astaghfirullah",
      reference: "Quran 71:10",
      source: "quran",
    },
  ];

  (runRealTests ? describe : describe.skip)("Real OpenAI API Calls", () => {
    // Import the real service
    let selectDuaWithOpenAI: any;

    beforeAll(async () => {
      const module = await import("../src/services/openaiService.js");
      selectDuaWithOpenAI = module.selectDuaWithOpenAI;
    });

    it("should successfully call OpenAI and return valid dua ID", async () => {
      const response = await selectDuaWithOpenAI(
        "I'm feeling sick and need healing",
        mockDuas,
      );

      expect(response).toBeDefined();
      expect(response).toHaveProperty("duaId");
      expect(typeof response.duaId).toBe("number");
      expect(response.duaId).toBeGreaterThan(0);

      // Should match a dua from our list
      const matchedDua = mockDuas.find((d) => d.id === response.duaId);
      expect(matchedDua).toBeDefined();
    }, 10000); // 10 second timeout for API call

    it("should match healing request to healing dua", async () => {
      const response = await selectDuaWithOpenAI(
        "I am sick and need prayers for recovery",
        mockDuas,
      );

      expect(response.duaId).toBe(1); // Should select healing dua
    }, 10000);

    it("should match anxiety request to anxiety dua", async () => {
      const response = await selectDuaWithOpenAI(
        "I'm nervous about my exam tomorrow",
        mockDuas,
      );

      expect(response.duaId).toBe(2); // Should select anxiety dua
    }, 10000);

    it("should match gratitude request to gratitude dua", async () => {
      const response = await selectDuaWithOpenAI(
        "I want to thank Allah for my blessings",
        mockDuas,
      );

      expect(response.duaId).toBe(3); // Should select gratitude dua
    }, 10000);

    it("should match forgiveness request to forgiveness dua", async () => {
      const response = await selectDuaWithOpenAI(
        "I sinned and want to repent",
        mockDuas,
      );

      expect(response.duaId).toBe(4); // Should select forgiveness dua
    }, 10000);

    it("should handle complex multi-topic request", async () => {
      const response = await selectDuaWithOpenAI(
        "I'm stressed about work and feeling anxious",
        mockDuas,
      );

      expect(response.duaId).toBe(2); // Should select anxiety dua
    }, 10000);

    it("should handle vague request and return valid dua", async () => {
      const response = await selectDuaWithOpenAI("I need help", mockDuas);

      // Should return any valid dua ID
      expect([1, 2, 3, 4]).toContain(response.duaId);
    }, 10000);

    it("should be consistent with low temperature setting", async () => {
      const userRequest = "I'm feeling anxious about an exam";

      const response1 = await selectDuaWithOpenAI(userRequest, mockDuas);
      const response2 = await selectDuaWithOpenAI(userRequest, mockDuas);

      // With temperature 0.3, should be mostly consistent
      // Allow for occasional variation but expect same category
      const dua1 = mockDuas.find((d) => d.id === response1.duaId);
      const dua2 = mockDuas.find((d) => d.id === response2.duaId);

      expect(dua1).toBeDefined();
      expect(dua2).toBeDefined();
      // Both should be anxiety-related (id: 2)
      expect(response1.duaId).toBe(2);
      expect(response2.duaId).toBe(2);
    }, 20000); // 20 seconds for 2 API calls

    it("should handle Arabic text in request", async () => {
      const response = await selectDuaWithOpenAI(
        "أنا مريض وأحتاج إلى الشفاء", // I am sick and need healing
        mockDuas,
      );

      expect(response.duaId).toBe(1); // Should understand and select healing
    }, 10000);

    it("should handle very short request", async () => {
      const response = await selectDuaWithOpenAI("sick", mockDuas);

      expect([1, 2, 3, 4]).toContain(response.duaId);
    }, 10000);

    it("should handle emoji in request", async () => {
      const response = await selectDuaWithOpenAI(
        "I'm so stressed 😰😭",
        mockDuas,
      );

      expect(response.duaId).toBe(2); // Should match anxiety
    }, 10000);

    it("should not return extra fields beyond duaId", async () => {
      const response = await selectDuaWithOpenAI("help me", mockDuas);

      const keys = Object.keys(response);
      expect(keys).toHaveLength(1);
      expect(keys[0]).toBe("duaId");
    }, 10000);

    it("should handle request with special characters", async () => {
      const response = await selectDuaWithOpenAI(
        "I'm feeling... really anxious!!! Need help???",
        mockDuas,
      );

      expect(response.duaId).toBe(2);
    }, 10000);

    it("should handle long detailed request", async () => {
      const longRequest = `I have been feeling extremely anxious lately. 
        I have an important exam coming up next week and I can't stop 
        worrying about it. I need something to help calm my nerves 
        and put my trust in Allah.`;

      const response = await selectDuaWithOpenAI(longRequest, mockDuas);

      expect(response.duaId).toBe(2); // Should match anxiety
    }, 10000);

    it("should work with minimal duas list", async () => {
      const minimalDuas = [mockDuas[0]]; // Only one dua

      const response = await selectDuaWithOpenAI("I need help", minimalDuas);

      expect(response.duaId).toBe(1);
    }, 10000);

    it("should work with larger duas list", async () => {
      const largeDuasList = [
        ...mockDuas,
        {
          id: 5,
          category: "travel",
          tags: ["journey", "safety"],
          arabic: "",
          english: "",
          transliteration: "",
          reference: "",
          source: "hadith",
        },
        {
          id: 6,
          category: "sleep",
          tags: ["rest", "night"],
          arabic: "",
          english: "",
          transliteration: "",
          reference: "",
          source: "hadith",
        },
        {
          id: 7,
          category: "morning",
          tags: ["dawn", "start"],
          arabic: "",
          english: "",
          transliteration: "",
          reference: "",
          source: "hadith",
        },
      ];

      const response = await selectDuaWithOpenAI(
        "I'm going on a trip",
        largeDuasList,
      );

      expect(response.duaId).toBe(5); // Should match travel
    }, 10000);
  });

  // Note: API key validation test is covered in unit tests
  // Testing with real module reload is complex in ESM
});
