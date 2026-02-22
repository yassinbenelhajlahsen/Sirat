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

function logHolidayError(req: Request, event: string, data: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      event,
      service: "holidays",
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? "unknown",
      ...data,
    }),
  );
}

function sendValidationError(req: Request, res: Response, message: string) {
  logHolidayError(req, "holidays_validation_error", {
    message,
    retriable: false,
    query: req.query,
  });

  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      retriable: false,
    },
  });
}

function sendServiceError(req: Request, res: Response, error: unknown) {
  if (error instanceof AladhanServiceError) {
    logHolidayError(req, "holidays_service_error", {
      code: error.code,
      message: error.message,
      status: error.status,
      retriable: error.retriable,
      query: req.query,
    });

    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        retriable: error.retriable,
      },
      stale: false,
    });
  }

  const unknownError =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack ?? null,
        }
      : {
          value: String(error),
        };

  logHolidayError(req, "holidays_unexpected_error", {
    error: unknownError,
    query: req.query,
  });

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
    return sendValidationError(req, res, year.error);
  }

  if (year < 1900 || year > 2100) {
    return sendValidationError(req, res, "year must be between 1900 and 2100");
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
    return sendServiceError(req, res, error);
  }
}
