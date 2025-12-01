import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors as themeColors, withOpacity } from "@/constants/theme";
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

function QuranBookmarkModal({
  visible,
  ayah,
  initialTitle,
  initialNote,
  onSubmit,
  onClose,
  isSubmitting = false,
}: QuranBookmarkModalProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [note, setNote] = useState(initialNote ?? "");

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

  return (
    <Modal
      animationType="fade"
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.cardWrapper}
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>New Bookmark</Text>
              <PressableScale
                accessibilityRole="button"
                onPress={onClose}
                style={styles.dismissButton}
                scaleTo={0.85}
                disabled={isSubmitting}
              >
                <View style={styles.dismissIcon}>
                  <View style={[styles.dismissLine, styles.dismissLineFirst]} />
                  <View
                    style={[styles.dismissLine, styles.dismissLineSecond]}
                  />
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
              <TextInput
                style={styles.input}
                placeholder={defaultTitleFallback || "Bookmark title"}
                placeholderTextColor={withOpacity(themeColors.white, 0.45)}
                value={title}
                onChangeText={setTitle}
                autoFocus
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Add an optional note"
                placeholderTextColor={withOpacity(themeColors.white, 0.45)}
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
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default QuranBookmarkModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withOpacity(themeColors.black, 0.6),
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: withOpacity(themeColors.primaryDeep, .95),
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.5),
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: themeColors.white,
  },
  dismissButton: {
    padding: 6,
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
    marginBottom: 16,
    gap: 4,
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
    color: withOpacity(themeColors.white, 0.75),
    fontSize: 13,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: withOpacity(themeColors.white, 0.75),
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: themeColors.primaryDark,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: themeColors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.3),
  },
  multilineInput: {
    minHeight: 110,
  },
  submitButton: {
    backgroundColor: themeColors.accent,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  submitDisabled: {
    backgroundColor: withOpacity(themeColors.accent, 0.4),
  },
  submitText: {
    color: themeColors.primaryDeep,
    fontWeight: "700",
    fontSize: 16,
  },
});
