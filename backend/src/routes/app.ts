import { Router } from "express";
import type { Request, Response } from "express";
import { ENV } from "../config/env.js";
import { isVersionLessThan } from "../utils/semver.js";

const router = Router();

/**
 * GET /api/app/version
 * Proactive version compatibility check — always available regardless of ENFORCE_MIN_VERSION.
 * Reads x-sirat-app-version header.
 */
router.get("/version", (req: Request, res: Response): void => {
  const version = req.headers["x-sirat-app-version"] as string | undefined;
  const currentVersion = version ?? "unknown";

  const isOutdated =
    !version || isVersionLessThan(version, ENV.MIN_SUPPORTED_APP_VERSION);

  if (isOutdated) {
    res.json({
      supported: false,
      minVersion: ENV.MIN_SUPPORTED_APP_VERSION,
      currentVersion,
    });
    return;
  }

  res.json({ supported: true });
});

export default router;
