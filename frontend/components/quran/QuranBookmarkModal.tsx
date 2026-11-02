import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import Button from "@/components/ui/Button";
import NativeSheet from "@/components/ui/NativeSheet";
import { Body, Caption, Callout, Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { NormalizedAyah } from "@/services/quranData";

export type QuranBookmarkModalPayload = {
  title: string;
};

type QuranBookmarkModalProps = {
  visible: boolean;
  ayah: NormalizedAyah | null;
  initialTitle?: string;
  onSubmit: (payload: QuranBookmarkModalPayload) => void;
  onClose: () => void;
  isSubmitting?: boolean;
};

function QuranBookmarkModal({
  visible,
  ayah,
  initialTitle,
  onSubmit,
  onClose,
  isSubmitting = false,
}: QuranBookmarkModalProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [title, setTitle] = useState(initialTitle ?? "");

  useEffect(() => {
    if (!visible) {
      return;
    }
    setTitle(initialTitle ?? "");
  }, [initialTitle, visible]);

  const ayahLabel = useMemo(() => {
    if (!ayah) {
      return "";
    }
    return `Surah ${ayah.surahNumber} • Ayah ${ayah.ayahNumber}`;
  }, [ayah]);

  const defaultTitleFallback = useMemo(() => {
    if (!ayah) {
      return "";
    }
    if (ayah.surahNameEn) {
      return `${ayah.surahNameEn} • Ayah ${ayah.ayahNumber}`;
    }
    return `Ayah ${ayah.ayahNumber}`;
  }, [ayah]);

  const trimmedTitle = title.trim() || defaultTitleFallback;
  const isDoneDisabled = !trimmedTitle || isSubmitting;

  const handleSubmit = () => {
    if (isDoneDisabled) {
      return;
    }
    onSubmit({
      title: trimmedTitle,
    });
  };

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      title={initialTitle ? "Edit Bookmark" : "New Bookmark"}
      dismissDisabled={isSubmitting}
    >
      <View style={styles.content}>
        {ayah ? (
          <View style={styles.ayahMeta}>
            <Callout color={themeColors.white} style={styles.ayahMetaEnglish}>
              {ayah.surahNameEn}
            </Callout>
            <Body color={themeColors.accent}>{ayah.surahNameAr}</Body>
            <Footnote color={themeColors.textSecondary}>{ayahLabel}</Footnote>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Caption color={themeColors.textSecondary} style={styles.fieldLabel}>
            BOOKMARK NAME
          </Caption>
          <TextInput
            style={styles.input}
            placeholder={defaultTitleFallback || "Bookmark title"}
            placeholderTextColor={themeColors.textTertiary}
            value={title}
            onChangeText={setTitle}
            autoFocus
            editable={!isSubmitting}
            accessibilityLabel="Bookmark name"
            maxFontSizeMultiplier={1.4}
          />
        </View>

        <Button
          label="Done"
          size="lg"
          onPress={handleSubmit}
          disabled={isDoneDisabled}
          loading={isSubmitting}
          loadingLabel="Saving..."
        />
      </View>
    </NativeSheet>
  );
}

export default QuranBookmarkModal;

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const { radii } = theme;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    ayahMeta: {
      marginBottom: 18,
      gap: 3,
    },
    ayahMetaEnglish: {
      fontWeight: "600",
    },
    fieldGroup: {
      marginBottom: theme.spacing.lg,
    },
    fieldLabel: {
      marginBottom: theme.spacing.sm,
      fontWeight: "600",
      letterSpacing: 0.4,
    },
    input: {
      backgroundColor: isLight
        ? withOpacity(themeColors.black, 0.05)
        : withOpacity(themeColors.white, 0.07),
      borderRadius: radii.row,
      borderCurve: "continuous",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      minHeight: 48,
      color: themeColors.white,
      fontSize: 15,
    },
  });
};
