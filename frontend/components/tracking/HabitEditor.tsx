// frontend/components/tracking/HabitEditor.tsx
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetTextInput, BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/PressableScale";
import SheetBackground from "@/components/ui/SheetBackground";
import { Caption, Headline, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit, HabitFrequency } from "@/services/habitTracker";

type IoniconName = keyof typeof Ionicons.glyphMap;

function EditorSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

const GLYPHS: IoniconName[] = [
  "book-outline",
  "moon-outline",
  "hand-left-outline",
  "heart-outline",
  "sunny-outline",
  "water-outline",
  "walk-outline",
  "cash-outline",
  "people-outline",
  "star-outline",
  "leaf-outline",
  "time-outline",
];

type Props = {
  visible: boolean;
  initial?: Habit | null;
  onSubmit: (input: { name: string; icon: string; frequency: HabitFrequency }) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export default function HabitEditor({ visible, initial, onSubmit, onDelete, onClose }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const tabBarClearance = Math.max(insets.bottom, 14) + 6 + 64 + 8;

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IoniconName>(GLYPHS[0]);
  const [weekly, setWeekly] = useState(false);
  const [timesPerWeek, setTimesPerWeek] = useState(1);

  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  // Initialise the form whenever the sheet opens.
  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      setName(initial?.name ?? "");
      setIcon((initial?.icon as IoniconName) ?? GLYPHS[0]);
      const f = initial?.frequency;
      setWeekly(f?.type === "weekly");
      setTimesPerWeek(f?.type === "weekly" ? f.timesPerWeek : 1);
    }
  }, [visible, initial]);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      sheetRef.current?.snapToIndex(0);
    } else if (!visible && previousVisibleRef.current) {
      sheetRef.current?.close();
    }
    previousVisibleRef.current = visible;
  }, [visible]);

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
    () => ({ backgroundColor: withOpacity(colors.white, 0.3), width: 38 }),
    [colors.white],
  );

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSubmit({
      name: trimmed,
      icon,
      frequency: weekly ? { type: "weekly", timesPerWeek } : { type: "daily" },
    });
    onClose();
  }, [canSave, trimmed, icon, weekly, timesPerWeek, onSubmit, onClose]);

  if (!mounted) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      backgroundComponent={EditorSheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: tabBarClearance + 16 }]}>
        <Title3 style={styles.title}>{initial ? "Edit habit" : "New habit"}</Title3>

        <BottomSheetTextInput
          placeholder="Habit name"
          placeholderTextColor={withOpacity(colors.white, 0.4)}
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <Caption color={withOpacity(colors.white, 0.6)} style={styles.sectionLabel}>ICON</Caption>
        <View style={styles.glyphGrid}>
          {GLYPHS.map((g) => {
            const active = g === icon;
            return (
              <PressableScale
                key={g}
                onPress={() => setIcon(g)}
                accessibilityRole="button"
                accessibilityLabel={`Choose icon ${g}`}
                style={[styles.glyph, active && styles.glyphActive]}
              >
                <Ionicons
                  name={g}
                  size={20}
                  color={active ? colors.onAccent : withOpacity(colors.white, 0.8)}
                />
              </PressableScale>
            );
          })}
        </View>

        <Caption color={withOpacity(colors.white, 0.6)} style={styles.sectionLabel}>FREQUENCY</Caption>
        <View style={styles.freqRow}>
          <PressableScale
            onPress={() => setWeekly(false)}
            accessibilityRole="button"
            style={[styles.freqBtn, !weekly && styles.freqBtnActive]}
          >
            <Headline color={!weekly ? colors.onAccent : colors.white}>Daily</Headline>
          </PressableScale>
          <PressableScale
            onPress={() => setWeekly(true)}
            accessibilityRole="button"
            style={[styles.freqBtn, weekly && styles.freqBtnActive]}
          >
            <Headline color={weekly ? colors.onAccent : colors.white}>Weekly</Headline>
          </PressableScale>
        </View>

        {weekly ? (
          <View style={styles.stepper}>
            <PressableScale
              onPress={() => setTimesPerWeek((n) => Math.max(1, n - 1))}
              accessibilityRole="button"
              accessibilityLabel="Decrease times per week"
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={18} color={colors.white} />
            </PressableScale>
            <Headline style={styles.stepValue}>{timesPerWeek}× / week</Headline>
            <PressableScale
              onPress={() => setTimesPerWeek((n) => Math.min(7, n + 1))}
              accessibilityRole="button"
              accessibilityLabel="Increase times per week"
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={18} color={colors.white} />
            </PressableScale>
          </View>
        ) : null}

        <PressableScale
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          style={[styles.save, !canSave && styles.saveDisabled]}
        >
          <Headline color={colors.onAccent}>Save</Headline>
        </PressableScale>

        {initial && onDelete ? (
          <PressableScale
            onPress={() => {
              onDelete();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete habit"
            style={styles.delete}
          >
            <Headline color={colors.danger}>Delete</Headline>
          </PressableScale>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
    title: { marginBottom: spacing.xs },
    input: {
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
      borderRadius: theme.radii.row,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.white,
      fontSize: 16,
    },
    sectionLabel: { letterSpacing: 1, marginTop: spacing.xs },
    glyphGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    glyph: {
      width: 46,
      height: 46,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.1),
    },
    glyphActive: { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary },
    freqRow: { flexDirection: "row", gap: spacing.sm },
    freqBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    freqBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.row,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    stepValue: { flex: 1, textAlign: "center" },
    save: {
      backgroundColor: colors.accent,
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: theme.radii.row,
      marginTop: spacing.sm,
    },
    saveDisabled: { opacity: 0.4 },
    delete: { alignItems: "center", paddingVertical: spacing.sm },
  });
};
