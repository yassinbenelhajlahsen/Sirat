import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { radii, withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { QuranBookmark } from "@/services/quranBookmarks";

import PressableScale from "../../PressableScale";

export type BookmarkNavigatorItem = {
  bookmark: QuranBookmark;
  title: string;
  note?: string;
  surahEnglish: string;
  surahArabic: string;
};

type BookmarksTabProps = {
  bookmarks: readonly BookmarkNavigatorItem[];
  filteredBookmarks: readonly BookmarkNavigatorItem[];
  bookmarkSearchQuery: string;
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
          accessibilityLabel="Delete bookmark"
        >
          <View style={styles.deleteActionContent}>
            <Ionicons
              name="trash-outline"
              size={18}
              color={themeColors.white}
            />
          </View>
        </Pressable>
      </Animated.View>
    ),
    [deleteActionOpacity, handleDelete, styles, themeColors]
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
        <PressableScale style={styles.bookmarkButton} onPress={handleSelect}>
          <View style={styles.bookmarkRowInner}>
            <View style={styles.bookmarkIconCircle}>
              <Ionicons
                name="bookmark"
                size={14}
                color={themeColors.accent}
              />
            </View>
            <View style={styles.bookmarkContent}>
              <Text style={styles.bookmarkTitle}>{item.title}</Text>
              <Text style={styles.bookmarkMeta}>
                {item.bookmark.surahNumber}:{item.bookmark.ayahNumber}
                {item.surahArabic ? ` · ${item.surahArabic}` : ""}
              </Text>
              {item.note ? (
                <Text style={styles.bookmarkNote}>{item.note}</Text>
              ) : null}
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
  onBookmarkSearchQueryChange,
  onSelectBookmark,
  onDeleteBookmark,
  onClose,
}: BookmarksTabProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const isLight = theme.name === "light";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const trimmedQuery = bookmarkSearchQuery.trim();
  const hasBookmarks = bookmarks.length > 0;
  const visibleBookmarks = useMemo(() => {
    return trimmedQuery ? filteredBookmarks : bookmarks;
  }, [bookmarks, filteredBookmarks, trimmedQuery]);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {hasBookmarks ? (
        <View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search bookmarks..."
            placeholderTextColor={
              isLight
                ? withOpacity(themeColors.grayDark, 0.85)
                : withOpacity(themeColors.white, 0.5)
            }
            value={bookmarkSearchQuery}
            onChangeText={onBookmarkSearchQueryChange}
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
            <Text style={styles.bookmarkEmptyText}>No bookmark found.</Text>
          ) : null}
          <Text style={styles.bookmarkSwipeHint}>
            Swipe right to delete a bookmark.
          </Text>
        </View>
      ) : (
        <Text style={styles.bookmarkEmptyText}>
          Double tap an Ayah to make your first bookmark.
        </Text>
      )}
    </ScrollView>
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
      paddingHorizontal: 20,
      paddingBottom: 18,
      paddingTop: 8,
    },
    searchInput: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 15,
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurface, 0.95)
        : withOpacity(themeColors.white, 0.09),
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 15,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.72)
        : withOpacity(themeColors.white, 0.16),
    },
    bookmarkList: {
      marginBottom: 12,
    },
    bookmarkRow: {
      borderRadius: radii.row,
      overflow: "hidden",
      marginBottom: 11,
    },
    bookmarkButton: {
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: radii.row,
      borderCurve: "continuous",
      backgroundColor: withOpacity(themeColors.white, 0.05),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.white, 0.1),
    },
    bookmarkRowInner: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    bookmarkIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: withOpacity(themeColors.accent, 0.15),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.3),
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      marginTop: 1,
      flexShrink: 0,
    },
    bookmarkContent: {
      flex: 1,
    },
    bookmarkTitle: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 3,
    },
    bookmarkMeta: {
      color: themeColors.accent,
      fontSize: 12,
      marginBottom: 2,
    },
    bookmarkNote: {
      color: isLight
        ? withOpacity(themeColors.offWhite, 0.86)
        : withOpacity(themeColors.white, 0.65),
      fontSize: 12,
      marginTop: 2,
    },
    bookmarkEmptyText: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.92)
        : withOpacity(themeColors.white, 0.7),
      fontSize: 13,
      paddingVertical: 6,
      textAlign: "center",
    },
    bookmarkSwipeHint: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.88)
        : withOpacity(themeColors.white, 0.62),
      fontSize: 12,
    },
    deleteActionContainer: {
      justifyContent: "center",
      marginVertical: 4,
      paddingLeft: 20,
    },
    deleteAction: {
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.72)
        : "#fd0000ff",
      paddingVertical: 17,
      paddingHorizontal: 17,
      borderRadius: radii.row,
      borderCurve: "continuous",
      marginRight: 4,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryOutline, 0.88)
        : withOpacity(themeColors.white, 0.22),
    },
    deleteActionContent: {
      flexDirection: "row",
      alignItems: "center",
    },
  });
};
