import GlassSurface from "@/components/ui/GlassSurface";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PressableScale from "./PressableScale";

interface DuaCardProps {
  onSubmit: (request: string) => Promise<void>;
  loading?: boolean;
}

function DuaCard({ onSubmit, loading = false }: DuaCardProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [userInput, setUserInput] = React.useState("");
  const charactersLeft = 150 - userInput.length;

  const handleSubmit = async () => {
    if (!userInput.trim()) {
      Alert.alert("Please describe what you need help with");
      return;
    }

    try {
      await onSubmit(userInput);
      setUserInput("");
      Keyboard.dismiss();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to find a dua");
    }
  };

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons name="sparkles-outline" size={12} color={colors.accent} />
          <Text style={styles.badgeText}>
            Personalized
          </Text>
        </View>
      </View>

      <Text style={styles.title}>
        Ask for a Dua
      </Text>

      <Text style={styles.description}>
        Describe what you need help with, and we will find the perfect dua for
        you.
      </Text>

      <View style={styles.inputShell}>
        <TextInput
          placeholder="e.g., I'm anxious about an exam"
          placeholderTextColor={colors.grayMuted}
          value={userInput}
          onChangeText={setUserInput}
          multiline
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={handleSubmit}
          maxLength={150}
          editable={!loading}
accessibilityLabel="Dua request input"
          accessibilityHint="Describe what you need help with"
          style={styles.input}
        />

        <View style={styles.metaRow}>
          <Text
            style={[
              styles.characterCount,
              charactersLeft <= 15 ? styles.characterCountWarning : undefined,
            ]}
          >
            {charactersLeft}
          </Text>
        </View>
      </View>

      <PressableScale
        disabled={loading || !userInput.trim()}
        onPress={handleSubmit}
        accessibilityRole="button"
        accessibilityLabel={loading ? "Finding dua" : "Find dua"}
        style={[
          styles.submitButton,
          loading ? styles.submitButtonDisabled : undefined,
        ]}
      >
        {loading ? (
          <>
            <ActivityIndicator color={colors.onAccent} size="small" />
            <Text style={styles.submitTextLoading}>
              Finding...
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.submitText}>
              Find Dua
            </Text>
            <Ionicons name="arrow-forward" size={16} color={colors.onAccent} />
          </>
        )}
      </PressableScale>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, typography } = theme;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    card: {
      marginTop: spacing.xl,
      padding: spacing.xl,
      shadowColor: colors.primaryDark,
      shadowOpacity: isLight ? 0.22 : 0.28,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: isLight ? 10 : 12 },
      elevation: 4,
      position: "relative",
      zIndex: 1,
    },
    badgeRow: {
      flexDirection: "row",
      marginBottom: spacing.sm,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: withOpacity(colors.accent, 0.1),
      borderColor: withOpacity(colors.accent, 0.32),
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 9,
    },
    badgeText: {
      marginLeft: 5,
      color: withOpacity(colors.accent, 0.92),
      fontSize: 11,
      fontFamily: "SFProDisplay-Semibold",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    title: {
      color: colors.accent,
      fontSize: typography.subtitle,
      fontFamily: "SFProDisplay-Semibold",
      marginBottom: spacing.sm,
    },
    description: {
      color: withOpacity(colors.white, 0.78),
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Regular",
      marginBottom: spacing.md,
    },
    inputShell: {
      backgroundColor: isLight
        ? withOpacity(colors.primarySurface, 0.65)
        : withOpacity(colors.white, 0.06),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(colors.accent, 0.22)
        : withOpacity(colors.white, 0.14),
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    input: {
      color: colors.white,
      padding: 0,
      fontSize: typography.bodyLg,
      fontFamily: "SFProDisplay-Regular",
      marginBottom: spacing.sm,
      minHeight: 64,
      textAlignVertical: "top",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    inputHint: {
      color: withOpacity(colors.white, 0.62),
      fontSize: 12,
      fontFamily: "SFProDisplay-Regular",
    },
    characterCount: {
      color: withOpacity(colors.white, 0.65),
      fontSize: 12,
      fontFamily: "SFProDisplay-Semibold",
      minWidth: 28,
      textAlign: "right",
    },
    characterCountWarning: {
      color: withOpacity(colors.accent, 0.95),
    },
    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      marginTop: spacing.lg,
      shadowColor: withOpacity(colors.accent, 0.4),
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    submitButtonDisabled: {
      backgroundColor: withOpacity(colors.accent, 0.5),
    },
    submitText: {
      color: colors.onAccent,
      fontSize: typography.subtitle,
      fontFamily: "SFProDisplay-Bold",
      marginRight: 6,
    },
    submitTextLoading: {
      color: colors.onAccent,
      fontSize: typography.subtitle,
      fontFamily: "SFProDisplay-Bold",
      marginLeft: spacing.sm,
    },
  });
};

export default DuaCard;
