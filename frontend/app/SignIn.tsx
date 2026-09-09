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
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import Aurora from "@/components/ui/Aurora";
import Button from "@/components/ui/Button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { Footnote, Title1 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
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

  return (
    <Pressable style={styles.backdrop} onPress={() => router.back()}>
      {/* Inner Pressable absorbs taps so they don't bubble to the backdrop */}
      <Pressable onPress={() => {}} style={styles.cardWrapper}>
        <View style={styles.card}>
          {/* Same themed background every screen uses: base gradient + Aurora */}
          <LinearGradient
            colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Aurora />

          <View style={styles.content}>
            <Title1 style={styles.headline} maxFontSizeMultiplier={1.2} accessibilityRole="header">
              {"Sync your\njourney"}
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
                  buttonStyle={AppleAuthenticationButtonStyle.WHITE}
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

              <Button
                label="Not now"
                variant="ghost"
                size="lg"
                onPress={() => router.back()}
                accessibilityLabel="Not now"
              />
            </View>
          </View>
        </View>
      </Pressable>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, radii, spacing } = theme;
  const isLightTheme = theme.name === "light";
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isLightTheme
        ? withOpacity(colors.black, 0.24)
        : withOpacity(colors.black, 0.70),
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xxl,
    },
    cardWrapper: { width: "100%", maxWidth: 360 },
    card: {
      borderRadius: radii.card,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    content: {
      paddingTop: spacing.xxxl,
      paddingHorizontal: spacing.xxl,
      paddingBottom: spacing.lg,
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
