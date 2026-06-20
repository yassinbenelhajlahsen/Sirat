import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";
import SettingsRow from "@/components/settings/SettingsRow";
import SettingsSection from "@/components/settings/SettingsSection";

type Props = {
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

export function AccountSection({ onSignIn, onSignOut, onDeleteAccount }: Props) {
  const { theme } = useTheme();
  const { isSignedIn, email } = useAuthState();

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
    <SettingsSection label="Account">
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
