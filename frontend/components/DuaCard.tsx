import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Footnote, Headline, Subhead } from "@/components/ui/Text";
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
      <Headline>Ask for a dua</Headline>
      <Subhead color={colors.textSecondary} style={styles.description}>
        Describe what you need help with and we will find a dua for you.
      </Subhead>

      <View style={styles.chipsRow}>
        {QUICK_PROMPTS.map((prompt) => (
          <PressableScale
            key={prompt.label}
            variant="button"
            disabled={loading}
            onPress={() => submitRequest(prompt.text)}
            accessibilityRole="button"
            accessibilityLabel={`Ask for a ${prompt.label} dua`}
            style={[styles.chip, loading ? styles.chipDisabled : undefined]}
          >
            <Footnote color={colors.textSecondary} style={styles.chipText}>{prompt.label}</Footnote>
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
        label="Find dua"
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
      padding: spacing.lg,
      position: "relative",
      zIndex: 1,
    },
    description: {
      marginTop: spacing.xs,
    },
    chipsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    chip: {
      flex: 1,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.white, isLight ? 0.05 : 0.1),
      borderRadius: theme.radii.pill,
      borderCurve: "circular",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    chipText: { fontWeight: "600" },
    chipDisabled: {
      opacity: 0.5,
    },
    inputShell: {
      marginTop: spacing.md,
      backgroundColor: isLight
        ? withOpacity(colors.black, 0.05)
        : withOpacity(colors.white, 0.07),
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    // Focus raises the fill one step; iOS never rings a field in the tint colour.
    inputShellActive: {
      backgroundColor: isLight
        ? withOpacity(colors.black, 0.08)
        : withOpacity(colors.white, 0.11),
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
    },
  });
};

export default DuaCard;
