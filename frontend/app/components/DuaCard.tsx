import { colors, spacing, typography, withOpacity } from "@/constants/theme";
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
  onInputFocus?: () => void;
}

function DuaCard({ onSubmit, loading = false, onInputFocus }: DuaCardProps) {
  const [userInput, setUserInput] = React.useState("");

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
    <View style={styles.card}>
      <Text style={styles.title}>
        Ask for a Dua
      </Text>

      <Text style={styles.description}>
        Describe what you need help with, and we will find the perfect dua for
        you.
      </Text>

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
        onFocus={() => {
          // Let focus happen first, then scroll
          requestAnimationFrame(() => onInputFocus?.());
        }}
        accessibilityLabel="Dua request input"
        accessibilityHint="Describe what you need help with"
        style={styles.input}
      />

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
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.submitTextLoading}>
              Finding...
            </Text>
          </>
        ) : (
          <Text style={styles.submitText}>
            Find Dua
          </Text>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.xl,
    backgroundColor: withOpacity(colors.black, 0.2),
    borderRadius: 18,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: withOpacity(colors.white, 0.08),
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
    position: "relative",
    zIndex: 1,
  },
  title: {
    color: colors.accent,
    fontSize: typography.subtitle,
    fontFamily: "SFProDisplay-Semibold",
    marginBottom: spacing.md,
  },
  description: {
    color: colors.grayMuted,
    fontSize: typography.body,
    fontFamily: "SFProDisplay-Regular",
    marginBottom: spacing.sm + 2,
  },
  input: {
    backgroundColor: withOpacity(colors.black, 0.3),
    borderRadius: 10,
    color: colors.white,
    padding: spacing.md,
    fontSize: typography.bodyLg,
    fontFamily: "SFProDisplay-Regular",
    marginBottom: spacing.md,
    minHeight: 60,
    borderWidth: 1,
    borderColor: withOpacity(colors.white, 0.15),
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: spacing.md,
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
    color: colors.primary,
    fontSize: typography.subtitle,
    fontFamily: "SFProDisplay-Bold",
  },
  submitTextLoading: {
    color: colors.primary,
    fontSize: typography.subtitle,
    fontFamily: "SFProDisplay-Bold",
    marginLeft: spacing.sm,
  },
});

export default DuaCard;
