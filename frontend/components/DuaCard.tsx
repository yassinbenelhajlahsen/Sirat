import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Subhead, Title2 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import React from "react";
import { Alert, Keyboard, StyleSheet, TextInput, View } from "react-native";
import PressableScale from "./PressableScale";

interface DuaCardProps {
  onSubmit: (request: string) => Promise<void>;
  loading?: boolean;
}

const QUICK_PROMPTS = [
  { label: "Anxiety", text: "I'm feeling anxious" },
  { label: "Gratitude", text: "I want to express gratitude" },
  { label: "Guidance", text: "I'm seeking guidance" },
];

function DuaCard({ onSubmit, loading = false }: DuaCardProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const haptic = useHaptics();

  const [userInput, setUserInput] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const charactersLeft = 150 - userInput.length;
  const hasInput = userInput.trim().length > 0;
  const disabled = loading || !hasInput;

  const submitRequest = async (request: string) => {
    haptic("medium");

    try {
      await onSubmit(request);
      setUserInput("");
      Keyboard.dismiss();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to find a dua");
    }
  };

  const handleSubmit = () => {
    if (!userInput.trim()) {
      Alert.alert("Please describe what you need help with");
      return;
    }
    submitRequest(userInput);
  };

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Title2 style={styles.title}>Ask for a Dua</Title2>
      <Subhead color={colors.textSecondary} style={styles.description}>
        Describe what you need help with, and we will find the perfect dua for
        you.
      </Subhead>

      <View style={styles.chipsRow}>
        {QUICK_PROMPTS.map((prompt) => (
          <PressableScale
            key={prompt.label}
            disabled={loading}
            onPress={() => submitRequest(prompt.text)}
            accessibilityRole="button"
            accessibilityLabel={`Ask for a ${prompt.label} dua`}
            style={[styles.chip, loading ? styles.chipDisabled : undefined]}
          >
            <Caption color={colors.textSecondary} style={styles.chipText}>{prompt.label}</Caption>
          </PressableScale>
        ))}
      </View>

      <View style={[styles.inputShell, (focused || hasInput) && styles.inputShellActive]}>
        <TextInput
          placeholder="e.g., I'm anxious about an exam"
          placeholderTextColor={colors.textTertiary}
          value={userInput}
          onChangeText={setUserInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={handleSubmit}
          maxLength={150}
          editable={!loading}
          accessibilityLabel="Dua request input"
          accessibilityHint="Describe what you need help with"
          maxFontSizeMultiplier={1.4}
          style={styles.input}
        />

        <View style={styles.metaRow}>
          <Caption
            color={charactersLeft <= 15 ? colors.accent : colors.textTertiary}
            style={styles.characterCount}
            accessibilityLabel={`${charactersLeft} characters left`}
          >
            {charactersLeft}
          </Caption>
        </View>
      </View>

      <Button
        label="Find Dua"
        size="lg"
        icon="arrow-forward"
        iconPosition="trailing"
        onPress={handleSubmit}
        disabled={disabled}
        loading={loading}
        loadingLabel="Finding..."
        accessibilityLabel={loading ? "Finding dua" : "Find dua"}
        style={styles.submitButton}
      />
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
    title: {
      letterSpacing: -0.4,
    },
    description: {
      marginTop: spacing.xs,
    },
    chipsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: spacing.md,
    },
    chip: {
      flex: 1,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.white, 0.06),
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 11,
    },
    chipText: { fontWeight: "600" },
    chipDisabled: {
      opacity: 0.5,
    },
    inputShell: {
      marginTop: spacing.md,
      backgroundColor: isLight
        ? withOpacity(colors.primarySurface, 0.65)
        : withOpacity(colors.white, 0.05),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(colors.accent, 0.22)
        : withOpacity(colors.white, 0.12),
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    inputShellActive: {
      borderColor: withOpacity(colors.accent, 0.45),
      backgroundColor: isLight
        ? withOpacity(colors.primarySurface, 0.8)
        : withOpacity(colors.white, 0.07),
    },
    input: {
      color: colors.white,
      padding: 0,
      fontSize: typography.bodyLg,
      fontWeight: "400",
      marginBottom: spacing.sm,
      minHeight: 56,
      textAlignVertical: "top",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    characterCount: {
      fontWeight: "600",
      minWidth: 28,
      textAlign: "right",
    },
    submitButton: {
      marginTop: spacing.lg,
      shadowColor: withOpacity(colors.accent, 0.4),
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  });
};

export default DuaCard;
