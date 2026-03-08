import { NextFunction, Request, Response } from "express";
import { ENV } from "../config/env.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error("❌ Unhandled error:", err);

  const status = err.status || 500;
  const message =
    ENV.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
  });
}
