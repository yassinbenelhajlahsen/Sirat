import { BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  InteractionManager,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { Caption, Footnote, Subhead } from "@/components/ui/Text";
import { radii, withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { QuranBookmark } from "@/services/quranBookmarks";

import PressableScale from "../../PressableScale";
import AppIcon from "@/components/ui/AppIcon";

export type BookmarkNavigatorItem = {
  bookmark: QuranBookmark;
  title: string;
  surahEnglish: string;
  surahArabic: string;
};

type BookmarksTabProps = {
  bookmarks: readonly BookmarkNavigatorItem[];
  filteredBookmarks: readonly BookmarkNavigatorItem[];
  bookmarkSearchQuery: string;
  bottomInset?: number;
  onBookmarkSearchQueryChange: (value: string) => void;
  onSelectBookmark: (bookmark: QuranBookmark) => void;
  onDeleteBookmark: (bookmark: QuranBookmark) => void;
  onClose: () => void;
};

type BookmarkRowProps = {
  item: BookmarkNavigatorItem;
  onSelectBookmark: (bookmark: QuranBookmark) => void;
  onDeleteBookmark: (bookmark: QuranBookmark) => void;
  onClose: () => void;
  styles: ReturnType<typeof createStyles>;
  themeColors: AppTheme["colors"];
};

const BookmarkRow = memo(function BookmarkRow({
  item,
  onSelectBookmark,
  onDeleteBookmark,
  onClose,
  styles,
  themeColors,
}: BookmarkRowProps) {
  const swipeableRef = useRef<Swipeable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const rowOpacity = useRef(new Animated.Value(1)).current;
  const rowScale = useRef(new Animated.Value(1)).current;
  const rowTranslateX = useRef(new Animated.Value(0)).current;
  const deleteActionOpacity = useRef(new Animated.Value(1)).current;

  const handleDelete = useCallback(() => {
    if (isDeleting) {
      return;
    }
    setIsDeleting(true);
    Animated.parallel([
      Animated.timing(deleteActionOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rowOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rowScale, {
        toValue: 0.9,
        duration: 240,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rowTranslateX, {
        toValue: -80,
        duration: 240,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDeleteBookmark(item.bookmark);
    });
  }, [
    deleteActionOpacity,
    isDeleting,
    item.bookmark,
    onDeleteBookmark,
    rowOpacity,
    rowScale,
    rowTranslateX,
  ]);

  const handleSelect = useCallback(() => {
    if (isDeleting) {
      return;
    }
    swipeableRef.current?.close();
    onClose();
    InteractionManager.runAfterInteractions(() => {
      onSelectBookmark(item.bookmark);
    });
  }, [isDeleting, item.bookmark, onClose, onSelectBookmark]);

  const renderRightActions = useCallback(
    () => (
      <Animated.View
        style={[
          styles.deleteActionContainer,
          {
            opacity: deleteActionOpacity,
            transform: [
              {
                translateX: deleteActionOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable
          style={styles.deleteAction}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete bookmark ${item.title}`}
        >
          <View style={styles.deleteActionContent}>
            <AppIcon name="trash-outline" size={18} color={themeColors.onAccent} />
          </View>
        </Pressable>
      </Animated.View>
    ),
    [deleteActionOpacity, handleDelete, item.title, styles, themeColors]
  );

  return (
    <Animated.View
      style={[
        styles.bookmarkRow,
        {
          opacity: rowOpacity,
          transform: [{ translateX: rowTranslateX }, { scale: rowScale }],
        },
      ]}
      pointerEvents={isDeleting ? "none" : "auto"}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
        enabled={!isDeleting}
        activeOffsetX={[-12, 12]}
        failOffsetY={[-12, 12]}
      >
        <PressableScale
          variant="row"
          style={styles.bookmarkButton}
          onPress={handleSelect}
          accessibilityRole="button"
          accessibilityLabel={`Open bookmark ${item.title}`}
          accessibilityHint="Swipe left to delete"
        >
          <View style={styles.bookmarkRowInner}>
            <View style={styles.bookmarkIconCircle}>
              <AppIcon name="bookmark" size={14} color={themeColors.accent} />
            </View>
            <View style={styles.bookmarkContent}>
              <Subhead color={themeColors.white} style={styles.bookmarkTitle}>
                {item.title}
              </Subhead>
              <Caption color={themeColors.textTertiary}>
                {item.bookmark.surahNumber}:{item.bookmark.ayahNumber}
                {item.surahArabic ? ` · ${item.surahArabic}` : ""}
              </Caption>
            </View>
          </View>
        </PressableScale>
      </Swipeable>
    </Animated.View>
  );
});

function BookmarksTab({
  bookmarks,
  filteredBookmarks,
  bookmarkSearchQuery,
  bottomInset = 0,
  onBookmarkSearchQueryChange,
  onSelectBookmark,
  onDeleteBookmark,
  onClose,
}: BookmarksTabProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const trimmedQuery = bookmarkSearchQuery.trim();
  const hasBookmarks = bookmarks.length > 0;
  const visibleBookmarks = useMemo(() => {
    return trimmedQuery ? filteredBookmarks : bookmarks;
  }, [bookmarks, filteredBookmarks, trimmedQuery]);

  return (
    <BottomSheetScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: bottomInset + 24 },
        !hasBookmarks && styles.contentContainerEmpty,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {hasBookmarks ? (
        <View>
          <BottomSheetTextInput
            style={styles.searchInput}
            placeholder="Search bookmarks..."
            placeholderTextColor={themeColors.textTertiary}
            value={bookmarkSearchQuery}
            onChangeText={onBookmarkSearchQueryChange}
            accessibilityLabel="Search bookmarks"
            maxFontSizeMultiplier={1.4}
          />
          <View style={styles.bookmarkList}>
            {visibleBookmarks.map((item) => (
              <BookmarkRow
                key={item.bookmark.id}
                item={item}
                onSelectBookmark={onSelectBookmark}
                onDeleteBookmark={onDeleteBookmark}
                onClose={onClose}
                styles={styles}
                themeColors={themeColors}
              />
            ))}
          </View>
          {trimmedQuery && visibleBookmarks.length === 0 ? (
            <Footnote color={themeColors.textSecondary} style={styles.bookmarkEmptyText}>
              No bookmark found.
            </Footnote>
          ) : null}
          <Caption color={themeColors.textTertiary}>
            Swipe left on a bookmark to delete it.
          </Caption>
        </View>
      ) : (
        <Footnote color={themeColors.textSecondary} style={styles.bookmarkEmptyText}>
          Tap an ayah and choose Bookmark to save your first one.
        </Footnote>
      )}
    </BottomSheetScrollView>
  );
}

export default memo(BookmarksTab);

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl,
      paddingTop: theme.spacing.sm,
    },
    contentContainerEmpty: {
      justifyContent: "center",
    },
    searchInput: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      minHeight: 48,
      borderRadius: radii.row,
      borderCurve: "continuous",
      backgroundColor: isLight
        ? withOpacity(themeColors.black, 0.05)
        : withOpacity(themeColors.white, 0.07),
      color: themeColors.white,
      fontSize: 15,
      marginBottom: theme.spacing.md,
    },
    bookmarkList: {
      marginBottom: theme.spacing.md,
    },
    bookmarkRow: {
      borderRadius: radii.row,
      overflow: "hidden",
      marginBottom: theme.spacing.md,
    },
    bookmarkButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      minHeight: 56,
      borderRadius: radii.row,
      borderCurve: "continuous",
      backgroundColor: withOpacity(themeColors.white, 0.06),
    },
    bookmarkRowInner: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    bookmarkIconCircle: {
      width: 28,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing.md,
      flexShrink: 0,
    },
    bookmarkContent: {
      flex: 1,
      gap: 2,
    },
    bookmarkTitle: {
      fontWeight: "600",
    },
    bookmarkEmptyText: {
      paddingVertical: theme.spacing.sm,
      textAlign: "center",
    },
    deleteActionContainer: {
      justifyContent: "center",
      marginVertical: theme.spacing.xs,
      paddingLeft: theme.spacing.xl,
    },
    deleteAction: {
      backgroundColor: themeColors.danger,
      minWidth: 56,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      borderCurve: "circular",
      marginRight: theme.spacing.xs,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteActionContent: {
      flexDirection: "row",
      alignItems: "center",
    },
  });
};
