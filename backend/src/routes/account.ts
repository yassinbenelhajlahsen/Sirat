import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import { deleteAccountHandler } from "../controllers/accountController.js";

const router = Router();

router.use(clerkMiddleware());

/**
 * DELETE /api/account
 * Deletes the authenticated user's data and Clerk identity.
 */
router.delete("/", requireAuth, deleteAccountHandler);

export default router;
