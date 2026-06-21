import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";

export interface AuthedRequest extends Request {
  userId?: string;
}

/**
 * Verifies the Clerk session attached by `clerkMiddleware()` and stashes the
 * authenticated Clerk user id on the request. Responds 401 when absent.
 * Must run AFTER `clerkMiddleware()` on the same router.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { isAuthenticated, userId } = getAuth(req);
  if (!isAuthenticated || !userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}
