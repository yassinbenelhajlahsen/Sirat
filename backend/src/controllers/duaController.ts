import { Request, Response } from "express";
import { selectDuaWithOpenAI } from "../services/openaiService.js";
import {
  getRandomDua,
  getRandomDuaByCategory,
  loadDuas,
} from "../utils/duaDatabase.js";
import { matchByRegex, type MatchSource } from "../utils/duaMatcher.js";

/**
 * POST /api/dua
 *
 * Main endpoint: Match user request to appropriate dua
 *
 * Request:
 * { "userRequest": "I'm feeling anxious about an exam" }
 *
 * Response:
 * { "dua": { id, category, tags, arabic, english, transliteration, reference, source }, "matchSource": "regex" | "ai" | "fallback" }
 *
 * Matching strategy (deterministic-first):
 * 1. Try regex pattern matching (fast, free, predictable)
 * 2. If regex fails, try OpenAI (intelligent but costs tokens)
 * 3. If OpenAI fails, use random dua (absolute fallback)
 *
 * Backend responsibilities:
 * 1. Load duas.json (source of truth)
 * 2. Try regex matching first
 * 3. Fall back to OpenAI only if regex doesn't match
 * 4. Validate the selected dua exists
 * 5. Return the full dua object with match source
 */
export async function matchDua(req: Request, res: Response) {
  try {
    const { userRequest } = req.body;

    // Validate input
    if (!userRequest || typeof userRequest !== "string") {
      return res.status(400).json({
        error: "userRequest is required and must be a string",
      });
    }

    if (userRequest.trim().length < 3) {
      return res.status(400).json({
        error: "Request must be at least 3 characters",
      });
    }

    // Load all duas from duas.json
    const duas = await loadDuas();
    if (duas.length === 0) {
      return res.status(500).json({
        error: "No duas available",
      });
    }

    let selectedDua;
    let matchSource: MatchSource = "fallback";

    // Step 1: Try regex matching (deterministic, fast, free)
    const regexCategory = matchByRegex(userRequest);

    if (regexCategory) {
      // Regex matched! Get a random dua from this category
      selectedDua = getRandomDuaByCategory(duas, regexCategory);

      if (selectedDua) {
        matchSource = "regex";
        console.log(
          `✅ Regex match: "${userRequest}" → Category: ${regexCategory} → Dua ${selectedDua.id}`,
        );
      }
    }

    // Step 2: If regex didn't match or category has no duas, try AI
    if (!selectedDua) {
      try {
        console.log(`⚙️  Regex didn't match. Trying AI for: "${userRequest}"`);

        const aiResponse = await selectDuaWithOpenAI(userRequest, duas);

        // Find the dua by ID
        selectedDua = duas.find((d) => d.id === aiResponse.duaId);

        if (!selectedDua) {
          throw new Error(`Dua ID ${aiResponse.duaId} not found in database`);
        }

        matchSource = "ai";
        console.log(
          `✅ AI match: "${userRequest}" → Dua ${selectedDua.id} (${selectedDua.category})`,
        );
      } catch (aiError: any) {
        // Step 3: Absolute fallback - random dua
        console.warn(
          `⚠️  AI failed: ${aiError.message}. Using random dua fallback.`,
        );

        selectedDua = getRandomDua(duas);
        if (!selectedDua) {
          return res.status(500).json({
            error: "No duas available for fallback",
          });
        }

        matchSource = "fallback";
        console.log(
          `⚠️  Fallback used: "${userRequest}" → Random Dua ${selectedDua.id} (${selectedDua.category})`,
        );
      }
    }

    // Return the dua object with match source for logging/analytics
    return res.json({
      dua: selectedDua,
      matchSource,
    });
  } catch (err: any) {
    console.error("❌ Error in matchDua:", err);
    return res.status(500).json({
      error: err.message || "Failed to match dua",
    });
  }
}

/**
 * GET /api/dua/health
 *
 * Health check endpoint
 * Returns: status, number of duas loaded, timestamp
 */
export async function health(req: Request, res: Response) {
  try {
    const duas = await loadDuas();
    return res.json({
      status: "ok",
      duasCount: duas.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      error: "Failed to load duas",
    });
  }
}
