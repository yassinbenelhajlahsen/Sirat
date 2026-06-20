import { Ionicons } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useCallback, useEffect } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { isSignedIn } = useAuthState();
  const { startSSOFlow } = useSSO();

  useEffect(() => {
    if (isSignedIn) router.back();
  }, [isSignedIn]);

  const signInWith = useCallback(
    async (strategy: "oauth_apple" | "oauth_google") => {
      try {
        const redirectUrl = AuthSession.makeRedirectUri({ scheme: "sirat" });
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl,
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.back();
        }
      } catch {
        // User cancelled or flow failed — stay on screen
      }
    },
    [startSSOFlow],
  );

  const { colors } = theme;

  return (
    <View style={styles.container}>
      <View style={styles.grabber} />

      <Text style={styles.title}>Sign in to sync</Text>
      <Text style={styles.subtitle}>
        Back up your tracker and settings across devices. You can keep using Sirat without an
        account.
      </Text>

      <TouchableOpacity
        style={styles.button}
        accessibilityRole="button"
        onPress={() => void signInWith("oauth_apple")}
      >
        <Ionicons name="logo-apple" size={20} color={colors.white} />
        <Text style={styles.buttonText}>Continue with Apple</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        accessibilityRole="button"
        onPress={() => void signInWith("oauth_google")}
      >
        <Ionicons name="logo-google" size={20} color={colors.white} />
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Not now"
      >
        <Text style={styles.dismiss}>Not now</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, radii } = theme;
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.xxl,
      justifyContent: "center",
      gap: spacing.lg,
      backgroundColor: colors.primaryDark,
    },
    grabber: {
      width: 38,
      height: 5,
      borderRadius: radii.pill,
      backgroundColor: withOpacity(colors.white, 0.28),
      alignSelf: "center",
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.white,
    },
    subtitle: {
      fontSize: 15,
      color: withOpacity(colors.white, 0.6),
      marginBottom: spacing.sm,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 14,
      borderRadius: radii.row,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.white,
    },
    dismiss: {
      textAlign: "center",
      color: withOpacity(colors.white, 0.6),
      marginTop: spacing.sm,
    },
  });
};
