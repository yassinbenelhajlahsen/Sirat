import { Request, Response } from "express";
import { AladhanServiceError, getHolidays } from "../services/aladhanService.js";

function parseRequiredInteger(
  req: Request,
  key: string,
): number | { error: string } {
  const value = req.query[key];
  if (value === undefined) {
    return { error: `Missing required parameter: ${key}` };
  }

  const raw = String(value).trim();
  if (!/^-?\d+$/.test(raw)) {
    return { error: `Invalid ${key}: expected an integer` };
  }
  const parsed = Number.parseInt(raw, 10);

  return parsed;
}

function sendValidationError(res: Response, message: string) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      retriable: false,
    },
  });
}

function sendServiceError(res: Response, error: unknown) {
  if (error instanceof AladhanServiceError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        retriable: error.retriable,
      },
      stale: false,
    });
  }

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Failed to fetch holidays",
      retriable: false,
    },
    stale: false,
  });
}

export async function getHolidaysByYearHandler(req: Request, res: Response) {
  const year = parseRequiredInteger(req, "year");

  if (typeof year !== "number") {
    return sendValidationError(res, year.error);
  }

  if (year < 1900 || year > 2100) {
    return sendValidationError(res, "year must be between 1900 and 2100");
  }

  try {
    const result = await getHolidays(year);

    return res.json({
      success: true,
      stale: result.stale,
      cache: result.cacheStatus,
      data: result.data,
    });
  } catch (error: unknown) {
    return sendServiceError(res, error);
  }
}
