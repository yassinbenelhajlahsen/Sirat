import { useCallback } from "react";
import { useAuth } from "@clerk/expo";

import { apiFetch } from "@/services/apiClient";

export function useAccountActions() {
  const { signOut } = useAuth();

  const deleteAccount = useCallback(async () => {
    // Delete server-side data first while the session token is still valid,
    // then clear the local Clerk session.
    await apiFetch("/api/account", { method: "DELETE" });
    await signOut();
  }, [signOut]);

  const doSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return { signOut: doSignOut, deleteAccount };
}
