import axios from "axios";
import { ENV } from "../config/env.js";
import type { Dua } from "../utils/duaDatabase.js";
import { formatDuaMetadataForContext } from "../utils/duaDatabase.js";

interface OpenAIResponse {
  duaId: number;
}

/**
 * Core principle: Send ONLY dua metadata (ID, category, tags) to OpenAI
 * NEVER send: Arabic, English, transliteration, or any full dua content
 *
 * This minimizes token usage, cost, and privacy concerns.
 */
export async function selectDuaWithOpenAI(
  userRequest: string,
  duas: Dua[],
): Promise<OpenAIResponse> {
  if (!ENV.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Format duas as minimal metadata only
  // Example output:
  // [1] healing | health, illness, recovery
  // [2] anxiety | worry, fear, anxiety, stress, exam
  const duasMetadata = duas
    .map((dua) => formatDuaMetadataForContext(dua))
    .join("\n");

  const systemPrompt = `You are an Islamic scholar helping users find appropriate duas (Islamic supplications).

You will receive:
1. A user's request describing their spiritual or emotional need
2. A list of available duas (only ID, category, and tags - NOT the full dua content)

Your task: Select the SINGLE BEST matching dua ID based on the user's request.

CRITICAL RULES:
- Respond ONLY with valid JSON: { "duaId": <number> }
- NEVER include explanations, reasoning, or confidence scores
- NEVER add extra fields to the JSON
- Select the MOST APPROPRIATE dua for the user's need
- If unsure, pick the most general/applicable dua`;

  const userPrompt = `User Request: "${userRequest}"

Available Duas:
${duasMetadata}

Select the BEST matching dua ID. Respond with ONLY JSON: { "duaId": number }`;

  try {
    console.log(`📤 Sending request to OpenAI (${duas.length} duas available)`);

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: ENV.OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3, // Low temperature for consistent, deterministic selection
        max_tokens: 50, // We only expect: { "duaId": N }
      },
      {
        headers: {
          Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const content = response.data.choices[0]?.message?.content || "{}";
    console.log(`📥 OpenAI response: ${content}`);

    // Extract JSON from response (sometimes OpenAI wraps it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as OpenAIResponse;

    if (!parsed.duaId || typeof parsed.duaId !== "number") {
      throw new Error("Invalid duaId in response");
    }

    console.log(`✅ Selected dua ID: ${parsed.duaId}`);
    return parsed;
  } catch (err: any) {
    console.error("❌ OpenAI API error:", err.message);
    throw new Error("Failed to select dua with OpenAI");
  }
}
