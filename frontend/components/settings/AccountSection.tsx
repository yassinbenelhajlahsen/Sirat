import { Text, View, StyleSheet } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";
import SettingsRow from "@/components/settings/SettingsRow";

type Props = {
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

export function AccountSection({ onSignIn, onSignOut, onDeleteAccount }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = createStyles(theme);
  const { isSignedIn, email } = useAuthState();

  if (!isSignedIn) {
    return (
      <View>
        <SettingsRow
          first
          icon="person-circle-outline"
          title="Sign in"
          showChevron
          onPress={onSignIn}
          accessibilityLabel="Sign in"
        />
      </View>
    );
  }

  return (
    <View>
      {email ? (
        <Text style={styles.email}>{email}</Text>
      ) : null}
      <SettingsRow
        first
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
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    email: {
      fontSize: 13,
      color: withOpacity(colors.white, 0.6),
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
  });
};
