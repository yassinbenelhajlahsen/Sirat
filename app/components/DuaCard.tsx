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
}

export function DuaCard({ onSubmit, loading = false }: DuaCardProps) {
  const [userInput, setUserInput] = React.useState("");

  const handleSubmit = async () => {
    if (!userInput.trim()) {
      Alert.alert("Please describe what you need help with");
      return;
    }

    try {
      Keyboard.dismiss();
      await onSubmit(userInput);
      setUserInput("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to find a dua");
    }
  };

  return (
    <View
      style={{
        backgroundColor: withOpacity(colors.primarySurface, 0.5),
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: withOpacity(colors.white, 0.12),
        shadowColor: withOpacity(colors.black, 0.15),
        shadowOpacity: 0.3,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 6,
        overflow: "hidden",
      }}
    >
      <Text
        style={{
          color: colors.accent,
          fontSize: 16,
          fontFamily: "SFProDisplay-Semibold",
          marginBottom: 12,
        }}
      >
        ✨ Ask for a Dua
      </Text>

      <Text
        style={{
          color: colors.grayMuted,
          fontSize: 12,
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
        maxLength={150}
        editable={!loading}
        style={{
          backgroundColor: withOpacity(colors.black, 0.3),
          borderRadius: 10,
          color: colors.white,
          padding: 12,
          fontSize: 14,
          fontFamily: "SFProDisplay-Regular",
          marginBottom: 12,
          minHeight: 60,
          borderWidth: 1,
          borderColor: withOpacity(colors.white, 0.15),
        }}
      />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          style={{
            color: colors.grayMuted,
            fontSize: 11,
            fontFamily: "SFProDisplay-Regular",
          }}
        >
          {userInput.length}/150
        </Text>
      </View>

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
                fontSize: 16,
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
              fontSize: 16,
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
