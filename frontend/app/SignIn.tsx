import { Ionicons } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useCallback, useEffect } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import Aurora from "@/components/ui/Aurora";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { DISPLAY_FONT_FAMILY } from "@/components/ui/DisplayNumber";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { theme } = useTheme();
  const { colors } = theme;
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
            <Text style={styles.headline}>{"Sync your\njourney"}</Text>
            <Text style={styles.subtitle}>
              Sign in to back up your tracker &amp; settings across devices.
            </Text>

            <View style={styles.stack}>
              {Platform.OS === "ios" && (
                <TouchableOpacity
                  style={styles.appleButton}
                  accessibilityRole="button"
                  onPress={() => void signInWithApple()}
                >
                  <Ionicons name="logo-apple" size={20} color={colors.primaryDeep} />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.googleButton}
                accessibilityRole="button"
                onPress={() => void signInWithGoogle()}
              >
                <GoogleIcon size={19} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notNowButton}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Not now"
              >
                <Text style={styles.notNowText}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, radii } = theme;
  const isLightTheme = theme.name === "light";
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isLightTheme
        ? withOpacity(colors.black, 0.24)
        : withOpacity(colors.black, 0.58),
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    cardWrapper: { width: "100%", maxWidth: 360 },
    card: {
      borderRadius: radii.heroLg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.2),
    },
    content: {
      paddingTop: 32,
      paddingHorizontal: 24,
      paddingBottom: 16,
    },
    headline: {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: 30,
      lineHeight: 32,
      color: colors.white,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 13.5,
      lineHeight: 20,
      color: withOpacity(colors.white, 0.62),
    },
    stack: {
      marginTop: 22,
      gap: 11,
    },
    // Apple — solid light pill
    appleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 52,
      borderRadius: radii.row,
      backgroundColor: colors.white,
    },
    appleButtonText: {
      fontSize: 15.5,
      fontWeight: "600",
      color: colors.primaryDeep,
    },
    // Google — frosted
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 52,
      borderRadius: radii.row,
      backgroundColor: withOpacity(colors.white, 0.08),
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.16),
    },
    googleButtonText: {
      fontSize: 15.5,
      fontWeight: "600",
      color: colors.white,
    },
    // Not now — full-width ghost, large touch target
    notNowButton: {
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.row,
    },
    notNowText: {
      fontSize: 15,
      fontWeight: "500",
      color: withOpacity(colors.white, 0.62),
    },
  });
};
