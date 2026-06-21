import type { Request, Response } from "express";
import { deleteAccount } from "../services/accountService.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

export async function deleteAccountHandler(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).userId as string;
    await deleteAccount(userId);
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error("account_delete_failed", err);
    return res.status(500).json({ error: "Account deletion failed" });
  }
}
