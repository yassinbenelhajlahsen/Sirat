import { colors, withOpacity } from "@/constants/theme";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
    <View
      style={{
        marginTop: 20,
        backgroundColor: withOpacity(colors.black, 0.2),
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        borderColor: withOpacity(colors.white, 0.08),
        shadowColor: colors.primaryDark,
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 16 },
        elevation: 6,
        position: "relative",
        zIndex: 1,
      }}
    >
      <Text
        style={{
          color: colors.accent,
          fontSize: 18,
          fontFamily: "SFProDisplay-Semibold",
          marginBottom: 12,
        }}
      >
        ✨ Ask for a Dua
      </Text>

      <Text
        style={{
          color: colors.grayMuted,
          fontSize: 14,
          fontFamily: "SFProDisplay-Regular",
          marginBottom: 10,
        }}
      >
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
        style={{
          backgroundColor: withOpacity(colors.black, 0.3),
          borderRadius: 10,
          color: colors.white,
          padding: 12,
          fontSize: 16,
          fontFamily: "SFProDisplay-Regular",
          marginBottom: 12,
          minHeight: 60,
          borderWidth: 1,
          borderColor: withOpacity(colors.white, 0.15),
        }}
      />

      <PressableScale
        disabled={loading || !userInput.trim()}
        onPress={handleSubmit}
        style={{
          backgroundColor: loading
            ? withOpacity(colors.accent, 0.5)
            : colors.accent,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          marginTop: 12,
          shadowColor: withOpacity(colors.accent, 0.4),
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }}
      >
        {loading ? (
          <>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text
              style={{
                color: colors.primary,
                fontSize: 18,
                fontFamily: "SFProDisplay-Bold",
                marginLeft: 8,
              }}
            >
              Finding...
            </Text>
          </>
        ) : (
          <Text
            style={{
              color: colors.primary,
              fontSize: 18,
              fontFamily: "SFProDisplay-Bold",
            }}
          >
            Find Dua
          </Text>
        )}
      </PressableScale>
    </View>
  );
}

export default DuaCard;
