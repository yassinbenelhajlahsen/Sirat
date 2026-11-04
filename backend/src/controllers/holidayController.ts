import { Request, Response } from "express";
import { getHolidays } from "../services/aladhanService.js";
import {
  createServiceErrorSender,
  parseRequiredInteger,
  sendValidationError,
} from "./aladhanHelpers.js";

const sendServiceError = createServiceErrorSender({
  service: "holidays",
  eventPrefix: "holidays",
  failureMessage: "Failed to fetch holidays",
});

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
    return sendServiceError(req, res, error);
  }
}
