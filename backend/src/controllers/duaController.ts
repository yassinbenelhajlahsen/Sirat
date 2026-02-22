import { Request, Response } from "express";
import { selectDuaWithOpenAI } from "../services/openaiService.js";
import {
  getRandomDua,
  loadDuas,
} from "../utils/duaDatabase.js";

const MAX_USER_REQUEST_LENGTH = 500;

function logDuaError(
  req: Request,
  event: string,
  data: Record<string, unknown>,
) {
  console.error(
    JSON.stringify({
      event,
      service: "dua",
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? "unknown",
      ...data,
    }),
  );
}

function validateDuaMatchPayload(body: unknown): { userRequest: string } | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }

  const typed = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(typed, "userRequest")) {
    return { error: "userRequest is required and must be a string" };
  }

  const userRequest = typed.userRequest;
  if (typeof userRequest !== "string") {
    return { error: "userRequest is required and must be a string" };
  }

  if (userRequest.length === 0) {
    return { error: "userRequest is required and must be a string" };
  }

  const normalizedRequest = userRequest.trim();
  if (normalizedRequest.length < 3) {
    return { error: "Request must be at least 3 characters" };
  }

  if (normalizedRequest.length > MAX_USER_REQUEST_LENGTH) {
    return {
      error: `Request must be ${MAX_USER_REQUEST_LENGTH} characters or fewer`,
    };
  }

  return { userRequest: normalizedRequest };
}

/**
 * POST /api/dua
 *
 * Main endpoint: Match user request to appropriate dua
 *
 * Request:
 * { "userRequest": "I'm feeling anxious about an exam" }
 *
 * Response:
 * { "dua": { id, category, tags, arabic, english, transliteration, reference, source }, "matchSource": "ai" | "fallback" }
 *
 * Matching strategy:
 * 1. Try OpenAI selection
 * 2. If OpenAI fails, use random dua (absolute fallback)
 *
 * Backend responsibilities:
 * 1. Load duas.json (source of truth)
 * 2. Try OpenAI selection
 * 3. Validate the selected dua exists
 * 4. Fall back to random if AI fails
 * 5. Return the full dua object with match source
 */
export async function matchDua(req: Request, res: Response) {
  try {
    const validatedPayload = validateDuaMatchPayload(req.body);
    if ("error" in validatedPayload) {
      return res.status(400).json({
        error: validatedPayload.error,
      });
    }
    const userRequest = validatedPayload.userRequest;

    // Load all duas from duas.json
    const duas = await loadDuas();
    if (duas.length === 0) {
      return res.status(500).json({
        error: "No duas available",
      });
    }

    let selectedDua;
    let matchSource: "ai" | "fallback" = "fallback";

    try {
      const aiResponse = await selectDuaWithOpenAI(userRequest, duas);

      // Find the dua by ID
      selectedDua = duas.find((d) => d.id === aiResponse.duaId);

      if (!selectedDua) {
        throw new Error(`Dua ID ${aiResponse.duaId} not found in database`);
      }

      matchSource = "ai";
    } catch (aiError: unknown) {
      // Step 2: Absolute fallback - random dua
      logDuaError(req, "dua_ai_fallback", {
        reason: aiError instanceof Error ? aiError.message : "Unknown AI error",
        userRequestLength: userRequest.length,
      });

      selectedDua = getRandomDua(duas);
      if (!selectedDua) {
        return res.status(500).json({
          error: "No duas available for fallback",
        });
      }

      matchSource = "fallback";
    }

    // Return the dua object with match source for logging/analytics
    return res.json({
      dua: selectedDua,
      matchSource,
    });
  } catch (err: unknown) {
    logDuaError(req, "dua_match_unexpected_error", {
      error:
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              stack: err.stack ?? null,
            }
          : {
              value: String(err),
            },
    });

    return res.status(500).json({
      error: "Failed to match dua",
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
