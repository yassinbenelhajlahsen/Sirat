import { colors, withOpacity } from "@/constants/theme";
import type { Dua } from "@/services/duaService";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";

interface DuaResultCardProps {
  dua: Dua;
  onClose: () => void;
  onSaveBookmark?: () => Promise<void>;
}

export function DuaResultCard({
  dua,
  onClose,
  onSaveBookmark,
}: DuaResultCardProps) {
  const [bookmarkLoading, setBookmarkLoading] = React.useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `✨ Check out this dua:\n\n${dua.arabic}\n\n${dua.transliteration}\n\n${dua.english}\n\n— ${dua.reference}`,
        title: "Islamic Dua",
      });
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const handleBookmark = async () => {
    if (!onSaveBookmark) return;

    try {
      setBookmarkLoading(true);
      await onSaveBookmark();
    } catch (err: any) {
      console.error("Bookmark error:", err);
    } finally {
      setBookmarkLoading(false);
    }
  };

  return (
    <ScrollView
      style={{
        backgroundColor: withOpacity(colors.primarySurface, 0.5),
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
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
      showsVerticalScrollIndicator={false}
    >
      {/* Header with close button */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <View>
          <Text
            style={{
              color: colors.accent,
              fontSize: 12,
              fontFamily: "SFProDisplay-Regular",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {dua.category.charAt(0).toUpperCase() + dua.category.slice(1)}
          </Text>
        </View>

        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons
            name="close-circle-outline"
            size={24}
            color={colors.white}
          />
        </Pressable>
      </View>

      {/* Arabic Text - Main Display */}
      <View style={{ marginBottom: 16, alignItems: "center" }}>
        <Text
          style={{
            color: colors.accent,
            fontSize: 26,
            fontFamily: "SFProDisplay-Bold",
            textAlign: "right",
            lineHeight: 42,
            marginBottom: 8,
          }}
        >
          {dua.arabic}
        </Text>
      </View>

      {/* Transliteration */}
      <View
        style={{
          marginBottom: 12,
          backgroundColor: withOpacity(colors.black, 0.25),
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: withOpacity(colors.white, 0.15),
        }}
      >
        <Text
          style={{
            color: colors.grayMedium,
            fontSize: 11,
            fontFamily: "SFProDisplay-Regular",
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          Transliteration
        </Text>
        <Text
          style={{
            color: colors.white,
            fontSize: 13,
            fontFamily: "SFProDisplay-Regular",
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          {dua.transliteration}
        </Text>
      </View>

      {/* English Translation */}
      <View
        style={{
          marginBottom: 12,
          backgroundColor: withOpacity(colors.black, 0.25),
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: withOpacity(colors.white, 0.15),
        }}
      >
        <Text
          style={{
            color: colors.grayMedium,
            fontSize: 11,
            fontFamily: "SFProDisplay-Regular",
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          English Translation
        </Text>
        <Text
          style={{
            color: colors.white,
            fontSize: 13,
            fontFamily: "SFProDisplay-Regular",
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          {dua.english}
        </Text>
      </View>

      {/* Reference & Source */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 16,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: withOpacity(colors.white, 0.1),
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.grayMuted,
              fontSize: 10,
              fontFamily: "SFProDisplay-Regular",
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Reference
          </Text>
          <Text
            style={{
              color: colors.accent,
              fontSize: 13,
              fontFamily: "SFProDisplay-Semibold",
              marginTop: 4,
            }}
          >
            {dua.reference}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text
            style={{
              color: colors.grayMuted,
              fontSize: 10,
              fontFamily: "SFProDisplay-Regular",
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Source
          </Text>
          <Text
            style={{
              color: colors.accent,
              fontSize: 13,
              fontFamily: "SFProDisplay-Semibold",
              marginTop: 4,
            }}
          >
            {dua.source}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
        }}
      >
        {/* Share Button */}
        <Pressable
          onPress={handleShare}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withOpacity(colors.black, 0.25),
            borderRadius: 8,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: withOpacity(colors.white, 0.15),
            shadowColor: withOpacity(colors.black, 0.15),
            shadowOpacity: 0.15,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          <Ionicons
            name="share-social-outline"
            size={16}
            color={colors.accent}
          />
          <Text
            style={{
              color: colors.accent,
              fontSize: 13,
              fontFamily: "SFProDisplay-Semibold",
              marginLeft: 6,
            }}
          >
            Share
          </Text>
        </Pressable>

        {/* Bookmark Button */}
        {onSaveBookmark && (
          <Pressable
            onPress={handleBookmark}
            disabled={bookmarkLoading}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withOpacity(colors.black, 0.25),
              borderRadius: 8,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: withOpacity(colors.white, 0.15),
              shadowColor: withOpacity(colors.black, 0.15),
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            {bookmarkLoading ? (
              <Ionicons
                name="bookmark-outline"
                size={16}
                color={colors.grayMuted}
              />
            ) : (
              <Ionicons
                name="bookmark-outline"
                size={16}
                color={colors.accent}
              />
            )}
            <Text
              style={{
                color: bookmarkLoading ? colors.grayMuted : colors.accent,
                fontSize: 13,
                fontFamily: "SFProDisplay-Semibold",
                marginLeft: 6,
              }}
            >
              Save
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}
