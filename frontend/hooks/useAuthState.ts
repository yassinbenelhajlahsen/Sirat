import { useAuth, useUser } from "@clerk/expo";

export type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
};

export function useAuthState(): AuthState {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  return {
    isLoaded: Boolean(isLoaded),
    isSignedIn: Boolean(isSignedIn),
    userId: userId ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  };
}
