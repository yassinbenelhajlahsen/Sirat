import { Ionicons } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useCallback, useEffect } from "react";
import { Alert, Text, TouchableOpacity, View, StyleSheet, Platform } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";
import Screen from "@/components/ui/Screen";
import GoogleIcon from "@/components/ui/GoogleIcon";

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { isSignedIn } = useAuthState();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();

  useEffect(() => {
    if (isSignedIn) router.back();
  }, [isSignedIn]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: "sirat" });
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.back();
      }
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Sign-in failed", "Something went wrong. Please try again.");
    }
  }, [startSSOFlow]);

  const signInWithApple = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.back();
      }
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Sign-in failed", "Something went wrong. Please try again.");
    }
  }, [startAppleAuthenticationFlow]);

  const { colors } = theme;

  return (
    <Screen safeArea={false}>
      <View style={styles.content}>
        <Text style={styles.title}>Sign in to sync</Text>
        <Text style={styles.subtitle}>
          Back up your tracker and settings across devices. You can keep using Sirat without an
          account.
        </Text>

        {Platform.OS === "ios" && (
          <TouchableOpacity
            style={styles.button}
            accessibilityRole="button"
            onPress={() => void signInWithApple()}
          >
            <Ionicons name="logo-apple" size={20} color={colors.white} />
            <Text style={styles.buttonText}>Continue with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.button}
          accessibilityRole="button"
          onPress={() => void signInWithGoogle()}
        >
          <GoogleIcon size={20} />
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
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, radii } = theme;
  return StyleSheet.create({
    content: {
      flex: 1,
      padding: spacing.xxl,
      justifyContent: "center",
      gap: spacing.lg,
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
