import { useAuthState } from "@/hooks/useAuthState";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import SettingsRow from "@/components/settings/SettingsRow";
import SettingsSection from "@/components/settings/SettingsSection";

type Props = {
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

export function AccountSection({ onSignIn, onSignOut, onDeleteAccount }: Props) {
  const { isSignedIn, email } = useAuthState();
  const { status, lastSyncedAt } = useSyncStatus();

  const syncLabel =
    status === "syncing" ? "Syncing…" :
    status === "error" ? "Sync failed — will retry" :
    lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` :
    "Not synced yet";

  if (!isSignedIn) {
    return (
      <SettingsSection label="Account">
        <SettingsRow
          first
          icon="person-circle-outline"
          title="Sign in"
          subtitle="Sign in to sync your data"
          showChevron
          onPress={onSignIn}
          accessibilityLabel="Sign in"
        />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection label="Account" footer={syncLabel}>
      <SettingsRow
        first
        icon="person-circle-outline"
        title="Signed in"
        subtitle={email ?? undefined}
        accessibilityLabel="Account"
      />
      <SettingsRow
        icon="log-out-outline"
        title="Sign out"
        onPress={onSignOut}
        accessibilityLabel="Sign out"
      />
      <SettingsRow
        danger
        icon="trash-outline"
        title="Delete account"
        onPress={onDeleteAccount}
        accessibilityLabel="Delete account"
      />
    </SettingsSection>
  );
}
