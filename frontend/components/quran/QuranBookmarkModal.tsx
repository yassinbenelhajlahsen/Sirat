import BottomSheet, {
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/components/ui/Button";
import SheetBackground from "@/components/ui/SheetBackground";
import SheetHeader from "@/components/ui/SheetHeader";
import { Body, Caption, Callout, Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { NormalizedAyah } from "@/services/quranData";

function BookmarkSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

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

  // Stays mounted through the close animation; only unmounts once the sheet
  // reports it has fully closed (onChange === -1), so closing animates instead
  // of snapping shut.
  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

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

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        setMounted(false);
        onClose();
      }
    },
    [onClose],
  );

  const handleIndicatorStyle = useMemo(
    () => ({
      backgroundColor: withOpacity(themeColors.white, 0.3),
      width: 38,
    }),
    [themeColors.white],
  );

  if (!mounted) {
    return null;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundComponent={BookmarkSheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={styles.content}>
        <SheetHeader
          title={initialTitle ? "Edit Bookmark" : "New Bookmark"}
          subtitle="Save this ayah for quick return"
          onClose={onClose}
          closeDisabled={isSubmitting}
        />

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
          <BottomSheetTextInput
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
      </BottomSheetView>
    </BottomSheet>
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
