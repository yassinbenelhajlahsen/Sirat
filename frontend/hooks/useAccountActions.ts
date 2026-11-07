import { useCallback } from "react";
import { useAuth } from "@clerk/expo";

import { apiFetch } from "@/services/apiClient";
import { clearChat } from "@/services/chat/chatStore";

export function useAccountActions() {
  const { signOut } = useAuth();

  const deleteAccount = useCallback(async () => {
    // Delete server-side data first while the session token is still valid,
    // then clear the local chat and the Clerk session.
    await apiFetch("/api/account", { method: "DELETE" });
    await clearChat();
    await signOut();
  }, [signOut]);

  const doSignOut = useCallback(async () => {
    await clearChat();
    await signOut();
  }, [signOut]);

  return { signOut: doSignOut, deleteAccount };
}
