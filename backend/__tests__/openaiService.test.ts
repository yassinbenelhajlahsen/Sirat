import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Dua } from "../src/utils/duaDatabase.js";

describe("openaiService", () => {
  const originalEnv = process.env;
  const mockAxiosPost: jest.Mock = jest.fn();

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
  ];

  beforeEach(() => {
    jest.resetModules();
    mockAxiosPost.mockReset();
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "test-model",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadService() {
    jest.unstable_mockModule("axios", () => ({
      default: { post: mockAxiosPost },
    }));

    return import("../src/services/openaiService.js");
  }

  it("throws when OPENAI_API_KEY is missing", async () => {
    process.env = { ...originalEnv, OPENAI_API_KEY: "", OPENAI_MODEL: "test-model" };
    jest.resetModules();

    const { selectDuaWithOpenAI } = await loadService();

    await expect(selectDuaWithOpenAI("help me", mockDuas)).rejects.toThrow(
      "OPENAI_API_KEY not configured",
    );
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it("returns parsed duaId on successful JSON response", async () => {
    (mockAxiosPost as any).mockResolvedValue({
      data: {
        choices: [{ message: { content: '{"duaId":2}' } }],
      },
    });

    const { selectDuaWithOpenAI } = await loadService();
    const result = await selectDuaWithOpenAI("I am anxious about my exam", mockDuas);

    expect(result).toEqual({ duaId: 2 });
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);

    const [url, payload, config] = (mockAxiosPost as any).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(payload.model).toBe("test-model");
    expect(payload.temperature).toBe(0.3);
    expect(payload.max_tokens).toBe(50);
    expect(config.headers.Authorization).toBe("Bearer test-openai-key");

    const userPrompt = payload.messages[1].content as string;
    expect(userPrompt).toContain("I am anxious about my exam");
    expect(userPrompt).toContain("[1] healing | health, illness, recovery");
    expect(userPrompt).toContain("[2] anxiety | worry, fear, stress, exam");

    // Full dua content should not be sent in prompt context.
    expect(userPrompt).not.toContain(mockDuas[0].arabic);
    expect(userPrompt).not.toContain(mockDuas[0].english);
    expect(userPrompt).not.toContain(mockDuas[0].transliteration);
  });

  it("parses JSON wrapped in markdown code fences", async () => {
    (mockAxiosPost as any).mockResolvedValue({
      data: {
        choices: [{ message: { content: "```json\n{\"duaId\":1}\n```" } }],
      },
    });

    const { selectDuaWithOpenAI } = await loadService();
    const result = await selectDuaWithOpenAI("I need healing", mockDuas);

    expect(result).toEqual({ duaId: 1 });
  });

  it("throws a normalized service error when response has no JSON", async () => {
    (mockAxiosPost as any).mockResolvedValue({
      data: {
        choices: [{ message: { content: "No JSON here" } }],
      },
    });

    const { selectDuaWithOpenAI } = await loadService();

    await expect(selectDuaWithOpenAI("help", mockDuas)).rejects.toThrow(
      "Failed to select dua with OpenAI",
    );
  });

  it("uses default JSON when message content is missing", async () => {
    (mockAxiosPost as any).mockResolvedValue({
      data: {
        choices: [{ message: {} }],
      },
    });

    const { selectDuaWithOpenAI } = await loadService();

    await expect(selectDuaWithOpenAI("help", mockDuas)).rejects.toThrow(
      "Failed to select dua with OpenAI",
    );
  });

  it("throws a normalized service error when duaId is missing", async () => {
    (mockAxiosPost as any).mockResolvedValue({
      data: {
        choices: [{ message: { content: "{}" } }],
      },
    });

    const { selectDuaWithOpenAI } = await loadService();

    await expect(selectDuaWithOpenAI("help", mockDuas)).rejects.toThrow(
      "Failed to select dua with OpenAI",
    );
  });

  it("throws a normalized service error when duaId is not a number", async () => {
    (mockAxiosPost as any).mockResolvedValue({
      data: {
        choices: [{ message: { content: '{"duaId":"2"}' } }],
      },
    });

    const { selectDuaWithOpenAI } = await loadService();

    await expect(selectDuaWithOpenAI("help", mockDuas)).rejects.toThrow(
      "Failed to select dua with OpenAI",
    );
  });

  it("throws a normalized service error when OpenAI request fails", async () => {
    (mockAxiosPost as any).mockRejectedValue(new Error("network timeout"));

    const { selectDuaWithOpenAI } = await loadService();

    await expect(selectDuaWithOpenAI("help", mockDuas)).rejects.toThrow(
      "Failed to select dua with OpenAI",
    );
  });

  it("handles missing choices safely", async () => {
    (mockAxiosPost as any).mockResolvedValue({ data: {} });

    const { selectDuaWithOpenAI } = await loadService();

    await expect(selectDuaWithOpenAI("help", mockDuas)).rejects.toThrow(
      "Failed to select dua with OpenAI",
    );
  });
});
