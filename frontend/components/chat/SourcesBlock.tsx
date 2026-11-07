import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import AppIcon, { type AppIconName } from "@/components/ui/AppIcon";
import { Footnote, Subhead, TEXT_MAX_FONT_SCALE } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Citation } from "@/services/chat/chatApi";
import { citationKey, gradeTone, surahLabel } from "@/services/chat/sources";

type Props = {
  citations: Citation[];
  focus: { n: number; token: number } | null;
  onRowLayout?: (n: number, y: number) => void;
};

const HIGHLIGHT_MS = 1600;
const ICONS: Record<Citation["kind"], AppIconName> = {
  quran: "book-outline",
  hadith: "document-text-outline",
  dua: "hand-left-outline",
};

export default function SourcesBlock({ citations, focus, onRowLayout }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [seenToken, setSeenToken] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<{ n: number; token: number } | null>(null);
  const rowYs = useRef<Record<number, number>>({});
  const groupY = useRef<number | null>(null);

  // A new focus token expands its row and starts the highlight (state adjusted during render, not in an effect).
  if (focus && focus.token !== seenToken) {
    setSeenToken(focus.token);
    setExpanded((e) => ({ ...e, [focus.n]: true }));
    setHighlight(focus);
  }

  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlight]);

  // A row's y is relative to the group, which sits under the caption; the list wants it relative to the block.
  const reportRow = (n: number) => {
    if (groupY.current !== null && rowYs.current[n] !== undefined) onRowLayout?.(n, groupY.current + rowYs.current[n]);
  };

  // Unknown kinds (saved by a newer build) are skipped but keep their number.
  const rows = citations.map((c, i) => ({ c, n: i + 1 })).filter(({ c }) => citationKey(c) !== "");
  if (!rows.length) return null;

  return (
    <View>
      <Text style={styles.caption} maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}>
        SOURCES
      </Text>
      <View
        style={styles.group}
        onLayout={(e) => {
          groupY.current = e.nativeEvent.layout.y;
          rows.forEach(({ n }) => reportRow(n));
        }}
      >
        {rows.map(({ c, n }, i) => (
          <Row
            key={citationKey(c)}
            citation={c}
            n={n}
            last={i === rows.length - 1}
            expanded={!!expanded[n]}
            highlighted={highlight?.n === n}
            onExpand={() => setExpanded((e) => ({ ...e, [n]: true }))}
            onLayoutY={(y) => {
              rowYs.current[n] = y;
              reportRow(n);
            }}
          />
        ))}
      </View>
    </View>
  );
}

type RowProps = {
  citation: Citation;
  n: number;
  last: boolean;
  expanded: boolean;
  highlighted: boolean;
  onExpand: () => void;
  onLayoutY: (y: number) => void;
};

function Row({ citation, n, last, expanded, highlighted, onExpand, onLayoutY }: RowProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [long, setLong] = useState(false);

  // Measured unclamped first. `long` never resets, so expanding and re-measuring cannot hide the button.
  const clamped = (lines: number, node: ReactNode, style?: object) => (
    <Text
      style={style}
      maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
      numberOfLines={long && !expanded ? lines : undefined}
      onTextLayout={(e) => {
        if (e.nativeEvent.lines.length > lines) setLong(true);
      }}
    >
      {node}
    </Text>
  );
  const arabic = (text: string) => clamped(1, text, styles.arabic);
  const english = (text: string, lines = 2) => clamped(lines, text, styles.english);

  let label = "";
  let right: ReactNode = null;
  let body: ReactNode = null;
  let onPress: (() => void) | undefined;

  if (citation.kind === "quran") {
    const { surah, ayah } = citation;
    label = `${surahLabel(surah)} ${surah}:${ayah}`;
    right = <AppIcon name="chevron-forward" size={13} color={colors.textTertiary} />;
    body = (
      <>
        {arabic(citation.arabic)}
        {citation.english ? english(citation.english) : null}
      </>
    );
    onPress = () => {
      router.back();
      // A new stamp per tap, so the Quran tab scrolls again when the same verse is opened twice.
      router.push({ pathname: "/(tabs)/Quran", params: { surah, ayah, at: String(Date.now()) } });
    };
  } else if (citation.kind === "hadith") {
    const tone = gradeTone(citation.grade);
    const toneColor = tone === "authentic" ? colors.accentSecondary : tone === "good" ? colors.accent : colors.textTertiary;
    const toneBg = tone === "other" ? withOpacity(colors.white, 0.08) : withOpacity(toneColor, 0.18);
    label = citation.title;
    body = (
      <>
        {english(citation.text, 3)}
        <View style={styles.metaLine}>
          <View style={[styles.grade, { backgroundColor: toneBg }]}>
            <Text style={[styles.gradeText, { color: toneColor }]} maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}>
              {citation.grade}
            </Text>
          </View>
          <Footnote color={colors.textTertiary} style={styles.metaText}>{`${citation.source} · ${citation.credit}`}</Footnote>
        </View>
      </>
    );
  } else {
    label = "Dua";
    right = <Footnote color={colors.textTertiary}>{citation.reference}</Footnote>;
    body = (
      <>
        {arabic(citation.arabic)}
        <Text style={styles.transliteration} maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}>
          {citation.transliteration}
        </Text>
        {english(citation.english)}
      </>
    );
  }

  const headerContent = (
    <>
      <View style={styles.num}>
        <Text style={styles.numText} maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}>
          {n}
        </Text>
      </View>
      <AppIcon name={ICONS[citation.kind]} size={15} color={colors.accent} />
      <Subhead color={colors.white} style={styles.labelText}>
        {label}
      </Subhead>
      {right}
    </>
  );

  return (
    <View
      onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}
      style={[styles.row, !last && styles.divider, highlighted && styles.highlight]}
    >
      {/* Only the header opens the verse: an accessible parent would hide the body and "Show more" from VoiceOver. */}
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={onPress} style={styles.label}>
          {headerContent}
        </Pressable>
      ) : (
        <View style={styles.label}>{headerContent}</View>
      )}
      {body}
      {long && !expanded ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onExpand} style={styles.more}>
          <Subhead color={colors.accent}>Show more</Subhead>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    caption: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.4,
      color: colors.textTertiary,
      paddingHorizontal: spacing.xs,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
    },
    group: {
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: withOpacity(colors.white, 0.065),
    },
    row: { paddingVertical: spacing.md, paddingHorizontal: 14, gap: 6 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: withOpacity(colors.white, 0.09) },
    highlight: { backgroundColor: withOpacity(colors.accent, 0.1) },
    label: { flexDirection: "row", alignItems: "center", gap: 7 },
    labelText: { flex: 1, fontWeight: "600" },
    num: {
      width: 18,
      height: 18,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.accent, 0.18),
    },
    numText: { fontSize: 11, fontWeight: "700", color: colors.accent },
    arabic: {
      color: colors.white,
      fontFamily: "Amiri",
      fontSize: 20,
      lineHeight: 35,
      textAlign: "right",
      writingDirection: "rtl",
    },
    english: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    transliteration: { color: colors.textTertiary, fontSize: 13.5, lineHeight: 19, fontStyle: "italic" },
    metaLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    metaText: { flexShrink: 1 },
    grade: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 1 },
    gradeText: { fontSize: 11, fontWeight: "600" },
    more: { alignSelf: "flex-start" },
  });
};
