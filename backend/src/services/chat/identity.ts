import { createHmac } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { ENV } from "../../config/env.js";

const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 5_000;

// shortcut: in-process cache, move to shared store if the backend runs >1 instance
const cache = new Map<string, { hash: string; expires: number }>();

/**
 * The chat quota key: an HMAC of the Apple/Google account ID, so deleting the
 * Sirat account and signing up again with the same login keeps the same count.
 * The raw provider ID is never stored.
 */
export async function getIdentityHash(userId: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expires > now) return hit.hash;

  const user = await clerkClient.users.getUser(userId);
  const account = user.externalAccounts?.[0];
  const subject = account ? `${account.provider}:${account.providerUserId}` : `clerk:${userId}`;
  const hash = createHmac("sha256", ENV.CHAT_IDENTITY_SECRET).update(subject).digest("hex");

  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(userId, { hash, expires: now + TTL_MS });
  return hash;
}
