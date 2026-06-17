import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { memo, useCallback, useMemo } from "react";
import {
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { radii, withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

import PressableScale from "../../PressableScale";

type JuzTabProps = {
  onSelectJuz: (juzNumber: number) => void;
  onClose: () => void;
};

function JuzTab({ onSelectJuz, onClose }: JuzTabProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rows = useMemo(() => {
    const JUZ_PER_ROW = 3;
    const TOTAL_JUZ = 30;
    const result: number[][] = [];

    for (let start = 0; start < TOTAL_JUZ; start += JUZ_PER_ROW) {
      const row: number[] = [];
      for (
        let offset = 0;
        offset < JUZ_PER_ROW && start + offset < TOTAL_JUZ;
        offset += 1
      ) {
        row.push(start + offset + 1);
      }
      result.push(row);
    }

    return result;
  }, []);

  const handleSelect = useCallback(
    (juz: number) => {
      onClose();
      InteractionManager.runAfterInteractions(() => {
        onSelectJuz(juz);
      });
    },
    [onClose, onSelectJuz]
  );

  return (
    <BottomSheetScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View>
        {rows.map((row, rowIndex) => (
          <View key={`juz-row-${rowIndex}`} style={styles.row}>
            {row.map((juz, index) => {
              const isLast = index === row.length - 1;
              return (
                <PressableScale
                  key={juz}
                  style={[styles.button, !isLast && styles.buttonSpaced]}
                  onPress={() => handleSelect(juz)}
                >
                  <Text style={styles.buttonText}>Juz {juz}</Text>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>
    </BottomSheetScrollView>
  );
}

export default memo(JuzTab);

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      paddingTop: 20,
    },
    row: {
      flexDirection: "row",
      marginBottom: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: radii.row,
      borderCurve: "continuous",
      backgroundColor: withOpacity(themeColors.white, 0.05),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.3),
      alignItems: "center",
      justifyContent: "center",
    },
    buttonSpaced: {
      marginRight: 12,
    },
    buttonText: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontWeight: "600",
      fontSize: 14,
    },
  });
};
