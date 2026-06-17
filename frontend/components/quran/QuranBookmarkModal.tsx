import BottomSheet, { BottomSheetTextInput, BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import SheetBackground from "@/components/ui/SheetBackground";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { NormalizedAyah } from "@/services/quranData";
import PressableScale from "../PressableScale";

export type QuranBookmarkModalPayload = {
  title: string;
  note: string;
};

type QuranBookmarkModalProps = {
  visible: boolean;
  ayah: NormalizedAyah | null;
  initialTitle?: string;
  initialNote?: string;
  onSubmit: (payload: QuranBookmarkModalPayload) => void;
  onClose: () => void;
  isSubmitting?: boolean;
};

const SNAP_POINTS = ["55%"];

function QuranBookmarkModal({
  visible,
  ayah,
  initialTitle,
  initialNote,
  onSubmit,
  onClose,
  isSubmitting = false,
}: QuranBookmarkModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [title, setTitle] = useState(initialTitle ?? "");
  const [note, setNote] = useState(initialNote ?? "");

  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      sheetRef.current?.snapToIndex(0);
    } else if (!visible && previousVisibleRef.current) {
      sheetRef.current?.close();
    }
    previousVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setTitle(initialTitle ?? "");
    setNote(initialNote ?? "");
  }, [initialNote, initialTitle, visible]);

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
  const trimmedNote = note.trim();
  const isDoneDisabled = !trimmedTitle || isSubmitting;

  const handleSubmit = () => {
    if (isDoneDisabled) {
      return;
    }
    onSubmit({
      title: trimmedTitle,
      note: trimmedNote,
    });
  };

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose],
  );

  const handleIndicatorStyle = useMemo(
    () => ({
      backgroundColor: withOpacity(theme.colors.white, 0.3),
      width: 38,
    }),
    [theme.colors.white],
  );

  if (!visible) {
    return null;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundComponent={SheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>New Bookmark</Text>
            <Text style={styles.headerSubtitle}>
              Save this ayah for quick return
            </Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.dismissButton}
            scaleTo={0.85}
            disabled={isSubmitting}
          >
            <View style={styles.dismissIcon}>
              <View style={[styles.dismissLine, styles.dismissLineFirst]} />
              <View style={[styles.dismissLine, styles.dismissLineSecond]} />
            </View>
          </PressableScale>
        </View>

        {ayah ? (
          <View style={styles.ayahMeta}>
            <Text style={styles.ayahMetaEnglish}>{ayah.surahNameEn}</Text>
            <Text style={styles.ayahMetaArabic}>{ayah.surahNameAr}</Text>
            <Text style={styles.ayahMetaLabel}>{ayahLabel}</Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Bookmark Name</Text>
          <BottomSheetTextInput
            style={styles.input}
            placeholder={defaultTitleFallback || "Bookmark title"}
            placeholderTextColor={withOpacity(theme.colors.white, 0.45)}
            value={title}
            onChangeText={setTitle}
            autoFocus
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Notes</Text>
          <BottomSheetTextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Add an optional note"
            placeholderTextColor={withOpacity(theme.colors.white, 0.45)}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
        </View>

        <PressableScale
          accessibilityRole="button"
          style={[
            styles.submitButton,
            isDoneDisabled && styles.submitDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isDoneDisabled}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? "Saving..." : "Done"}
          </Text>
        </PressableScale>
      </BottomSheetView>
    </BottomSheet>
  );
}

export default QuranBookmarkModal;

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const { radii } = theme;

  return StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingTop: 18,
      marginBottom: 14,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: themeColors.white,
    },
    headerSubtitle: {
      marginTop: 4,
      color: withOpacity(themeColors.white, 0.66),
      fontSize: 12,
      letterSpacing: 0.3,
    },
    dismissButton: {
      padding: 8,
      marginTop: -2,
      borderRadius: 999,
      backgroundColor: withOpacity(themeColors.white, 0.08),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.white, 0.12),
    },
    dismissIcon: {
      width: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    dismissLine: {
      position: "absolute",
      width: 18,
      height: 2,
      backgroundColor: themeColors.white,
      borderRadius: 999,
    },
    dismissLineFirst: {
      transform: [{ rotate: "45deg" }],
    },
    dismissLineSecond: {
      transform: [{ rotate: "-45deg" }],
    },
    ayahMeta: {
      marginBottom: 18,
      gap: 3,
    },
    ayahMetaEnglish: {
      color: themeColors.white,
      fontWeight: "600",
      fontSize: 16,
    },
    ayahMetaArabic: {
      color: themeColors.accent,
      fontSize: 18,
    },
    ayahMetaLabel: {
      color: withOpacity(themeColors.white, 0.68),
      fontSize: 13,
    },
    fieldGroup: {
      marginBottom: 15,
    },
    fieldLabel: {
      color: withOpacity(themeColors.white, 0.86),
      fontSize: 12,
      marginBottom: 7,
      fontWeight: "600",
      letterSpacing: 0.35,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: withOpacity(themeColors.white, 0.05),
      borderRadius: radii.row,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: themeColors.white,
      fontSize: 15,
      borderWidth: 1,
      borderColor: withOpacity(themeColors.white, 0.16),
    },
    multilineInput: {
      minHeight: 110,
    },
    submitButton: {
      backgroundColor: themeColors.accent,
      paddingVertical: 14,
      borderRadius: 15,
      alignItems: "center",
      shadowColor: themeColors.accent,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 7,
    },
    submitDisabled: {
      backgroundColor: withOpacity(themeColors.accent, 0.42),
      shadowOpacity: 0,
      elevation: 0,
    },
    submitText: {
      color: themeColors.onAccent,
      fontWeight: "700",
      fontSize: 16,
    },
  });
};
