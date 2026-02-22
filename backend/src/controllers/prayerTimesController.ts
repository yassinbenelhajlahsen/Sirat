import { Request, Response } from "express";
import {
  AladhanServiceError,
  getCalendar,
  getTimings,
} from "../services/aladhanService.js";

const ALLOWED_METHODS = new Set([
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  99,
]);

function parseRequiredNumber(
  req: Request,
  key: string,
): number | { error: string } {
  const value = req.query[key];
  if (value === undefined) {
    return { error: `Missing required parameter: ${key}` };
  }

  const raw = String(value).trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return { error: `Invalid ${key}: expected a number` };
  }

  return parsed;
}

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
      message: "Failed to fetch prayer times",
      retriable: false,
    },
    stale: false,
  });
}

export async function getTimingsHandler(req: Request, res: Response) {
  const latitude = parseRequiredNumber(req, "latitude");
  const longitude = parseRequiredNumber(req, "longitude");
  const method = parseRequiredInteger(req, "method");

  if (typeof latitude !== "number") {
    return sendValidationError(res, latitude.error);
  }
  if (typeof longitude !== "number") {
    return sendValidationError(res, longitude.error);
  }
  if (typeof method !== "number") {
    return sendValidationError(res, method.error);
  }

  if (latitude < -90 || latitude > 90) {
    return sendValidationError(res, "latitude must be between -90 and 90");
  }
  if (longitude < -180 || longitude > 180) {
    return sendValidationError(res, "longitude must be between -180 and 180");
  }
  if (!ALLOWED_METHODS.has(method)) {
    return sendValidationError(res, "method must be a supported Aladhan method id");
  }

  try {
    const result = await getTimings({
      latitude,
      longitude,
      method,
    });

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

export async function getCalendarHandler(req: Request, res: Response) {
  const latitude = parseRequiredNumber(req, "latitude");
  const longitude = parseRequiredNumber(req, "longitude");
  const method = parseRequiredInteger(req, "method");
  const month = parseRequiredInteger(req, "month");
  const year = parseRequiredInteger(req, "year");

  if (typeof latitude !== "number") {
    return sendValidationError(res, latitude.error);
  }
  if (typeof longitude !== "number") {
    return sendValidationError(res, longitude.error);
  }
  if (typeof method !== "number") {
    return sendValidationError(res, method.error);
  }
  if (typeof month !== "number") {
    return sendValidationError(res, month.error);
  }
  if (typeof year !== "number") {
    return sendValidationError(res, year.error);
  }

  if (latitude < -90 || latitude > 90) {
    return sendValidationError(res, "latitude must be between -90 and 90");
  }
  if (longitude < -180 || longitude > 180) {
    return sendValidationError(res, "longitude must be between -180 and 180");
  }
  if (!ALLOWED_METHODS.has(method)) {
    return sendValidationError(res, "method must be a supported Aladhan method id");
  }
  if (month < 1 || month > 12) {
    return sendValidationError(res, "month must be between 1 and 12");
  }
  if (year < 1900 || year > 2100) {
    return sendValidationError(res, "year must be between 1900 and 2100");
  }

  try {
    const result = await getCalendar({
      latitude,
      longitude,
      method,
      month,
      year,
    });

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
