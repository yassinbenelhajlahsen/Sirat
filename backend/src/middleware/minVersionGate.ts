import type { NextFunction, Request, Response } from "express";
import { ENV } from "../config/env.js";
import { isVersionLessThan } from "../utils/semver.js";

const EXEMPT_PATHS = new Set(["/", "/api/app/version"]);

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.has(path)) return true;
  if (path.endsWith("/health")) return true;
  return false;
}

export function minVersionGate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isExempt(req.path)) {
    next();
    return;
  }

  const version = req.headers["x-sirat-app-version"] as string | undefined;
  const platform = req.headers["x-sirat-platform"] as string | undefined;

  if (ENV.ENFORCE_MIN_VERSION !== "true") {
    // Monitor mode: log and pass through
    console.log(
      `[minVersionGate] version=${version ?? "missing"} platform=${platform ?? "missing"} path=${req.path}`,
    );
    next();
    return;
  }

  // Enforcement mode
  const currentVersion = version ?? "unknown";
  const isOutdated =
    !version || isVersionLessThan(version, ENV.MIN_SUPPORTED_APP_VERSION);

  if (isOutdated) {
    res.status(426).json({
      error: {
        code: "APP_UPDATE_REQUIRED",
        minVersion: ENV.MIN_SUPPORTED_APP_VERSION,
        currentVersion,
        retriable: false,
      },
    });
    return;
  }

  next();
}
