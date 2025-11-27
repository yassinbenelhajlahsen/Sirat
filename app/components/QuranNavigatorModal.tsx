import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  InteractionManager,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors as themeColors, withOpacity } from "@/app/constants/theme";
import { NormalizedSurahMeta } from "@/services/quranData";
import PressableScale from "./PressableScale";

type QuranNavigatorModalProps = {
  visible: boolean;
  surahs: readonly NormalizedSurahMeta[];
  filteredSurahs: readonly NormalizedSurahMeta[];
  surahSearchQuery: string;
  onSurahSearchQueryChange: (value: string) => void;
  onSelectSurah: (surahNumber: number) => void;
  onSelectJuz: (juzNumber: number) => void;
  onClose: () => void;
};

function QuranNavigatorModal({
  visible,
  surahs,
  filteredSurahs,
  surahSearchQuery,
  onSurahSearchQueryChange,
  onSelectSurah,
  onSelectJuz,
  onClose,
}: QuranNavigatorModalProps) {
  const trimmedQuery = surahSearchQuery.trim();
  const visibleSurahs = useMemo(
    () => (trimmedQuery ? filteredSurahs : surahs),
    [filteredSurahs, surahs, trimmedQuery]
  );

  const [shouldRender, setShouldRender] = useState(visible);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(28)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // Fade the backdrop and slide the card whenever the modal toggles.
  useEffect(() => {
    overlayOpacity.stopAnimation();
    cardTranslateY.stopAnimation();
    cardOpacity.stopAnimation();

    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 28,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [cardOpacity, cardTranslateY, overlayOpacity, visible]);

  const juzRows = useMemo(() => {
    const rows: number[][] = [];
    const JUZ_PER_ROW = 3;
    const TOTAL_JUZ = 30;

    for (let start = 0; start < TOTAL_JUZ; start += JUZ_PER_ROW) {
      const row: number[] = [];
      for (
        let offset = 0;
        offset < JUZ_PER_ROW && start + offset < TOTAL_JUZ;
        offset++
      ) {
        row.push(start + offset + 1);
      }
      rows.push(row);
    }

    return rows;
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={shouldRender}
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Jump To</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionContainer}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search surah..."
                placeholderTextColor={withOpacity(themeColors.white, 0.5)}
                value={surahSearchQuery}
                onChangeText={onSurahSearchQueryChange}
              />
              <View style={styles.surahResultsList}>
                {visibleSurahs.map((surah) => (
                  <PressableScale
                    key={surah.surahNumber}
                    style={styles.sectionButton}
                    onPress={() => {
                      onClose();
                      InteractionManager.runAfterInteractions(() => {
                        onSelectSurah(surah.surahNumber);
                      });
                    }}
                  >
                    <View style={styles.sectionButtonRow}>
                      <Text style={styles.sectionButtonLabel}>
                        {surah.englishName}
                      </Text>
                      <Text style={styles.sectionButtonArabic}>
                        {surah.arabicName}
                      </Text>
                    </View>
                    <Text style={styles.sectionButtonMeta}>
                      Surah {surah.surahNumber} • {surah.ayahCount} ayat
                    </Text>
                  </PressableScale>
                ))}
                {trimmedQuery && visibleSurahs.length === 0 ? (
                  <Text style={styles.surahResultsEmpty}>No surah found.</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Juz</Text>
              <View style={styles.juzGrid}>
                {juzRows.map((row, rowIndex) => (
                  <View key={`juz-row-${rowIndex}`} style={styles.juzRow}>
                    {row.map((juz) => (
                      <PressableScale
                        key={juz}
                        style={styles.juzButton}
                        onPress={() => {
                          onClose();
                          InteractionManager.runAfterInteractions(() => {
                            onSelectJuz(juz);
                          });
                        }}
                      >
                        <Text style={styles.juzButtonText}>Juz {juz}</Text>
                      </PressableScale>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          <PressableScale
            style={styles.modalClose}
            onPress={onClose}
            scaleTo={0.9}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </PressableScale>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default memo(QuranNavigatorModal);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: withOpacity(themeColors.black, 0.45),
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: themeColors.primary,
    borderRadius: 20,
    paddingBottom: 12,
    maxHeight: "90%",
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: themeColors.white,
    marginBottom: 12,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 24,
  },
  sectionContainer: {
    gap: 12,
  },
  sectionHeading: {
    color: themeColors.white,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  modalSearchInput: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: withOpacity(themeColors.white, 0.1),
    color: themeColors.white,
    fontSize: 15,
  },
  surahResultsList: {
    gap: 12,
  },
  juzGrid: {
    gap: 12,
  },
  juzRow: {
    flexDirection: "row",
    gap: 12,
  },
  sectionButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: themeColors.primarySurface,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.5),
  },
  sectionButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionButtonLabel: {
    color: themeColors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  sectionButtonArabic: {
    color: themeColors.accent,
    fontSize: 18,
    marginLeft: 12,
  },
  sectionButtonMeta: {
    color: withOpacity(themeColors.white, 0.6),
    fontSize: 12,
  },
  surahResultsEmpty: {
    color: withOpacity(themeColors.white, 0.7),
    textAlign: "center",
    fontSize: 14,
    paddingVertical: 12,
  },
  juzButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: withOpacity(themeColors.accent, 0.08),
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.25),
    alignItems: "center",
    justifyContent: "center",
  },
  juzButtonText: {
    color: themeColors.white,
    fontWeight: "600",
  },
  modalClose: {
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: {
    color: themeColors.accent,
    fontWeight: "600",
    fontSize: 15,
  },
});
