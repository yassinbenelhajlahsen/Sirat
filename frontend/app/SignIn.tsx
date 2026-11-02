import { useSSO } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from "expo-apple-authentication";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useCallback, useEffect, useMemo } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import Button from "@/components/ui/Button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { Footnote, Title1 } from "@/components/ui/Text";
import { type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        // Navigation is handled by the isSignedIn useEffect above.
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
        // Navigation is handled by the isSignedIn useEffect above.
      }
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Sign-in failed", "Something went wrong. Please try again.");
    }
  }, [startAppleAuthenticationFlow]);

  // The native form sheet supplies the surface, grabber and swipe-down to dismiss.
  return (
    <View style={styles.content}>
      <Title1 style={styles.headline} maxFontSizeMultiplier={1.2} accessibilityRole="header">
        Sync your journey
      </Title1>
      <Footnote color={colors.textSecondary}>
        Sign in to back up your tracker &amp; settings across devices.
      </Footnote>

      <View style={styles.stack}>
        {Platform.OS === "ios" && (
          // Apple's own control: required styling, localisation and the
          // "Continue with" wording come for free.
          <AppleAuthenticationButton
            buttonType={AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              theme.name === "light"
                ? AppleAuthenticationButtonStyle.BLACK
                : AppleAuthenticationButtonStyle.WHITE
            }
            cornerRadius={26}
            style={styles.appleButton}
            accessibilityLabel="Continue with Apple"
            onPress={() => void signInWithApple()}
          />
        )}

        <Button
          label="Continue with Google"
          variant="tonal"
          size="lg"
          leading={<GoogleIcon size={19} />}
          onPress={() => void signInWithGoogle()}
        />
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    content: {
      paddingTop: spacing.xxxl,
      paddingHorizontal: spacing.xxl,
      paddingBottom: spacing.xxl,
    },
    headline: { marginBottom: spacing.md },
    stack: {
      marginTop: spacing.xxl,
      gap: spacing.md,
    },
    appleButton: {
      height: 52,
      width: "100%",
    },
  });
};
