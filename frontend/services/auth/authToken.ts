import { getClerkInstance } from "@clerk/expo";

/**
 * Returns the active Clerk session JWT for attaching to backend requests,
 * or null when signed out / unavailable. Never throws — callers treat a
 * null token as "anonymous". This is the only non-React Clerk touch point.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const clerk = getClerkInstance();
    const token = await clerk.session?.getToken();
    return token ?? null;
  } catch {
    return null;
  }
}
