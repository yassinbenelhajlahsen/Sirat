import { Ionicons } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useCallback, useEffect, useId } from "react";
import { Alert, Text, TouchableOpacity, View, Pressable, StyleSheet, Platform } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuthState } from "@/hooks/useAuthState";
import GlassSurface from "@/components/ui/GlassSurface";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { DISPLAY_FONT_FAMILY } from "@/components/ui/DisplayNumber";

WebBrowser.maybeCompleteAuthSession();

function HeroAurora({ accentColor, secondaryColor }: { accentColor: string; secondaryColor: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const emeraldId = `heroEmerald${uid}`;
  const goldId = `heroGold${uid}`;

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {/* emerald bloom — top-left */}
        <RadialGradient id={emeraldId} cx="0.30" cy="0.0" r="0.85">
          <Stop offset="0" stopColor={secondaryColor} stopOpacity={0.5} />
          <Stop offset="1" stopColor={secondaryColor} stopOpacity={0} />
        </RadialGradient>
        {/* gold bloom — top-right */}
        <RadialGradient id={goldId} cx="1.0" cy="0.2" r="0.75">
          <Stop offset="0" stopColor={accentColor} stopOpacity={0.42} />
          <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${emeraldId})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${goldId})`} />
    </Svg>
  );
}

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
    <Pressable style={styles.backdrop} onPress={() => router.back()}>
      {/* Inner Pressable absorbs taps so they don't bubble to the backdrop */}
      <Pressable onPress={() => {}} style={styles.cardWrapper}>
        <GlassSurface tier="card" style={styles.card}>
          {/* Hero region — aurora glow + headline */}
          <View style={styles.hero}>
            <HeroAurora
              accentColor={colors.accent}
              secondaryColor={colors.accentSecondary}
            />
            <Text style={styles.headline}>{"Sync your\njourney"}</Text>
          </View>

          {/* Body region */}
          <View style={styles.body}>
            <Text style={styles.subtitle}>
              Sign in to back up your tracker & settings across devices.
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
        </GlassSurface>
      </Pressable>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, radii } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: withOpacity(colors.black, 0.55),
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    cardWrapper: {
      width: "100%",
      maxWidth: 360,
    },
    card: {
      padding: 0,
      overflow: "hidden",
      borderRadius: radii.heroLg,
    },
    // Hero
    hero: {
      height: 150,
      justifyContent: "flex-end",
      padding: 20,
      paddingLeft: 24,
      overflow: "hidden",
    },
    headline: {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: 27,
      lineHeight: 29,
      color: colors.white,
      position: "relative",
    },
    // Body
    body: {
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 16,
    },
    subtitle: {
      fontSize: 13.5,
      lineHeight: 20,
      color: withOpacity(colors.white, 0.6),
    },
    stack: {
      marginTop: 14,
      gap: 11,
    },
    // Apple button — solid light pill
    appleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 52,
      borderRadius: radii.row,
      backgroundColor: colors.white,
      // soft glow per mockup B
      shadowColor: colors.white,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 15,
      elevation: 8,
    },
    appleButtonText: {
      fontSize: 15.5,
      fontWeight: "600",
      color: colors.primaryDeep,
    },
    // Google button — frosted glass
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 52,
      borderRadius: radii.row,
      backgroundColor: withOpacity(colors.white, 0.06),
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.16),
    },
    googleButtonText: {
      fontSize: 15.5,
      fontWeight: "600",
      color: colors.white,
    },
    // Not now — full-width ghost, big touch target
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
