// frontend/components/tracking/HabitEditor.tsx
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetTextInput, BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import Button from "@/components/ui/Button";
import SheetBackground from "@/components/ui/SheetBackground";
import { Caption, Headline, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import type { Habit, HabitFrequency } from "@/services/habitTracker";
import { WEEKDAY_SHORT } from "@/utils/habitFrequency";

type IoniconName = keyof typeof Ionicons.glyphMap;

function EditorSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

// Spoken names so VoiceOver reads "Moon icon", not the glyph id.
const GLYPHS: { name: IoniconName; label: string }[] = [
  { name: "book-outline", label: "Book" },
  { name: "moon-outline", label: "Moon" },
  { name: "hand-left-outline", label: "Hand" },
  { name: "heart-outline", label: "Heart" },
  { name: "sunny-outline", label: "Sun" },
  { name: "water-outline", label: "Water" },
  { name: "walk-outline", label: "Walk" },
  { name: "cash-outline", label: "Charity" },
  { name: "people-outline", label: "People" },
  { name: "star-outline", label: "Star" },
  { name: "leaf-outline", label: "Leaf" },
  { name: "time-outline", label: "Clock" },
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
  const tabBarClearance = useTabBarClearance();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IoniconName>(GLYPHS[0].name);
  const [weekly, setWeekly] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  // Initialise the form whenever the sheet opens.
  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      setName(initial?.name ?? "");
      setIcon((initial?.icon as IoniconName) ?? GLYPHS[0].name);
      const f = initial?.frequency;
      setWeekly(f?.type === "weekly");
      setSelectedDays(f?.type === "weekly" ? [...f.days] : []);
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
  const needsDays = weekly && selectedDays.length === 0;
  const canSave = trimmed.length > 0 && !needsDays;

  const toggleDay = useCallback((index: number) => {
    setSelectedDays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index],
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSubmit({
      name: trimmed,
      icon,
      frequency: weekly
        ? { type: "weekly", days: [...selectedDays].sort((a, b) => a - b) }
        : { type: "daily" },
    });
    onClose();
  }, [canSave, trimmed, icon, weekly, selectedDays, onSubmit, onClose]);

  // Deleting removes the habit and its history everywhere, so confirm first.
  const confirmDelete = useCallback(() => {
    if (!onDelete) return;
    Alert.alert(
      "Delete habit?",
      `"${initial?.name ?? trimmed}" and its history will be removed from this device and any synced devices.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete();
            onClose();
          },
        },
      ],
    );
  }, [initial?.name, onClose, onDelete, trimmed]);

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
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          style={styles.input}
          accessibilityLabel="Habit name"
          maxFontSizeMultiplier={1.4}
        />

        <Caption color={colors.textTertiary} style={styles.sectionLabel}>ICON</Caption>
        <View style={styles.glyphGrid}>
          {GLYPHS.map((g) => {
            const active = g.name === icon;
            return (
              <PressableScale
                key={g.name}
                onPress={() => setIcon(g.name)}
                accessibilityRole="button"
                accessibilityLabel={`${g.label} icon`}
                accessibilityState={{ selected: active }}
                style={[styles.glyph, active && styles.glyphActive]}
              >
                <Ionicons
                  name={g.name}
                  size={20}
                  color={active ? colors.onAccent : colors.textSecondary}
                />
              </PressableScale>
            );
          })}
        </View>

        <Caption color={colors.textTertiary} style={styles.sectionLabel}>FREQUENCY</Caption>
        <View style={styles.freqRow}>
          <PressableScale
            onPress={() => setWeekly(false)}
            accessibilityRole="button"
            accessibilityState={{ selected: !weekly }}
            style={[styles.freqBtn, !weekly && styles.freqBtnActive]}
          >
            <Headline color={!weekly ? colors.onAccent : colors.white}>Daily</Headline>
          </PressableScale>
          <PressableScale
            onPress={() => setWeekly(true)}
            accessibilityRole="button"
            accessibilityState={{ selected: weekly }}
            style={[styles.freqBtn, weekly && styles.freqBtnActive]}
          >
            <Headline color={weekly ? colors.onAccent : colors.white}>Weekly</Headline>
          </PressableScale>
        </View>

        {weekly ? (
          <>
            <View style={styles.weekdayRow}>
              {WEEKDAY_SHORT.map((label, index) => {
                const selected = selectedDays.includes(index);
                return (
                  <PressableScale
                    key={label}
                    onPress={() => toggleDay(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Toggle ${label}`}
                    accessibilityState={{ selected }}
                    style={[styles.weekday, selected && styles.weekdayActive]}
                  >
                    <Caption color={selected ? colors.onAccent : colors.white}>{label}</Caption>
                  </PressableScale>
                );
              })}
            </View>
            {needsDays ? (
              <Caption color={colors.textTertiary} accessibilityLiveRegion="polite">
                Pick at least one day.
              </Caption>
            ) : null}
          </>
        ) : null}

        <Button label="Save" size="lg" onPress={handleSave} disabled={!canSave} style={styles.save} />

        {initial && onDelete ? (
          <Button
            label="Delete habit"
            variant="danger"
            onPress={confirmDelete}
            accessibilityLabel="Delete habit"
          />
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
      minHeight: 48,
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
      justifyContent: "center",
      minHeight: 44,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    freqBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    weekdayRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.xs },
    weekday: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 40,
      borderRadius: theme.radii.chip,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    weekdayActive: { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary },
    save: { marginTop: spacing.sm },
  });
};
