import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
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
  const { theme } = useTheme();
  const { isSignedIn, email } = useAuthState();
  const { status, lastSyncedAt } = useSyncStatus();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      <View style={styles.syncRow}>
        <Text style={styles.syncLabel}>{syncLabel}</Text>
      </View>
    </SettingsSection>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    syncRow: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(theme.colors.white, 0.08),
    },
    syncLabel: {
      fontSize: 11,
      color: withOpacity(theme.colors.white, 0.4),
    },
  });
