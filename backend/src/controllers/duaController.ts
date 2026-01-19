import { Request, Response } from "express";
import { selectDuaWithOpenAI } from "../services/openaiService";
import { getRandomDua, loadDuas } from "../utils/duaDatabase";

/**
 * POST /api/dua/match
 *
 * Main endpoint: Match user request to appropriate dua
 *
 * Request:
 * { "userRequest": "I'm feeling anxious about an exam" }
 *
 * Response:
 * { "dua": { id, category, tags, arabic, english, transliteration, reference, source } }
 *
 * Backend responsibilities:
 * 1. Load duas.json (source of truth)
 * 2. Call OpenAI with ONLY metadata (ID, category, tags)
 * 3. Validate the selected dua ID exists
 * 4. Return the full dua object
 *
 * Frontend responsibilities: NONE (except calling this endpoint)
 * - Frontend does NOT hold duas.json
 * - Frontend does NOT select duas
 * - Frontend does NOT call OpenAI
 * - Frontend does NOT make Islamic decisions
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

    try {
      // Try to call OpenAI for intelligent selection
      const aiResponse = await selectDuaWithOpenAI(userRequest, duas);

      // Find the dua by ID
      selectedDua = duas.find((d) => d.id === aiResponse.duaId);

      if (!selectedDua) {
        throw new Error(`Dua ID ${aiResponse.duaId} not found in database`);
      }

      console.log(
        `✅ Match successful: "${userRequest}" → Dua ${selectedDua.id} (${selectedDua.category})`,
      );
    } catch (aiError: any) {
      // Fallback: Use random dua if OpenAI fails
      console.warn(
        `⚠️  OpenAI failed: ${aiError.message}. Using random dua fallback.`,
      );

      selectedDua = getRandomDua(duas);
      if (!selectedDua) {
        return res.status(500).json({
          error: "No duas available for fallback",
        });
      }

      console.log(
        `⚠️  Fallback used: "${userRequest}" → Random Dua ${selectedDua.id} (${selectedDua.category})`,
      );
    }

    // Return ONLY the dua object
    // NO reasoning, NO matchScore, NO confidence, NO AI explanations
    return res.json({
      dua: selectedDua,
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
