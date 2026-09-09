// frontend/components/NotificationSettings.tsx
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Animated, Linking, Pressable, View } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Footnote, Headline, Subhead } from "@/components/ui/Text";
import { useAdhanPreview } from "../hooks/useAdhanPreview";
import { useNotificationPanelAnimation } from "../hooks/useNotificationPanelAnimation";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";
import { useNotificationSegmentLayout } from "../hooks/useNotificationSegmentLayout";
import {
  PRAYERS,
  SOUND_OPTIONS,
  SOUND_SEGMENT_GAP,
  WINDOW_OFFSET_OPTIONS,
  WINDOW_PRAYERS,
  type PrayerKey,
  type SoundMode,
  type WindowPrayerKey,
} from "../utils/notifications/constants";
import { getNotificationStyles } from "../utils/notifications/styles";

export { NOTIF_PREFS_UPDATED_EVENT } from "../utils/notifications/constants";

type Props = {
  // From Settings.tsx: "granted" | "denied" | null
  notifStatus?: string | null;
};

export default function NotificationSettings({ notifStatus }: Props) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => getNotificationStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();

  const textColor = themeColors.white;
  const accentColor = themeColors.accent;
  const dividerColor = withOpacity(themeColors.white, 0.08);
  const pillOffBgColor = withOpacity(themeColors.white, 0.04);
  const rowOnBgColor = withOpacity(themeColors.accent, 0.18);
  const rowOnBorderColor = withOpacity(themeColors.accent, 0.75);
  const rowOffBgColor = withOpacity(themeColors.white, 0.03);
  const rowOffBorderColor = withOpacity(themeColors.white, 0.12);
  const rowOffTextColor = themeColors.textSecondary;
  const rowDisabledTextColor = themeColors.textDisabled;

  const {
    loaded,
    enabled,
    prefs,
    soundMode,
    windowPrefs,
    windowOffset,
    setPrayerPreference,
    updateSoundMode,
    setWindowPreference,
    setWindowOffset,
  } = useNotificationPreferences({ notifStatus });

  const { previewing, handlePreviewPress, stopPreview } =
    useAdhanPreview(enabled);

  const [revealHeight, setRevealHeight] = useState(0);

  const offsetIndex = Math.max(
    0,
    (WINDOW_OFFSET_OPTIONS as readonly number[]).indexOf(windowOffset),
  );

  const {
    headerScale,
    bellAnimations,
    contentOpacity,
    contentTranslateY,
    contentMaxHeight,
    contentScale,
    soundIndicator,
    offsetIndicator,
    windowPrayerAnimations,
    pulseHeader,
    pulsePrayer,
    pulseWindowPrayer,
  } = useNotificationPanelAnimation({
    loaded,
    enabled,
    soundMode,
    contentHeight: revealHeight,
    offsetIndex,
    reduceMotion,
  });

  const { segmentWidth, indicatorTranslateX, onLayout } =
    useNotificationSegmentLayout({
      soundIndicator,
      optionCount: SOUND_OPTIONS.length,
      gap: SOUND_SEGMENT_GAP,
    });

  const {
    segmentWidth: offsetSegmentWidth,
    indicatorTranslateX: offsetIndicatorTranslateX,
    onLayout: offsetOnLayout,
  } = useNotificationSegmentLayout({
    soundIndicator: offsetIndicator,
    optionCount: WINDOW_OFFSET_OPTIONS.length,
    gap: SOUND_SEGMENT_GAP,
  });

  const togglePrayer = useCallback(
    (k: PrayerKey) => {
      pulsePrayer(k);
      void setPrayerPreference(k, !prefs[k]);
    },
    [prefs, pulsePrayer, setPrayerPreference],
  );

  const toggleWindowPrayer = useCallback(
    (k: WindowPrayerKey) => {
      pulseWindowPrayer(k);
      void setWindowPreference(k, !windowPrefs[k]);
    },
    [windowPrefs, pulseWindowPrayer, setWindowPreference],
  );

  const handleOffsetChange = useCallback(
    (minutes: number) => {
      void setWindowOffset(minutes);
    },
    [setWindowOffset],
  );

  const handleSoundModeChange = useCallback(
    async (nextMode: SoundMode) => {
      if (nextMode === soundMode) return;
      await stopPreview();
      await updateSoundMode(nextMode);
    },
    [soundMode, stopPreview, updateSoundMode],
  );

  const selectedSoundOption =
    SOUND_OPTIONS.find((option) => option.id === soundMode) ?? SOUND_OPTIONS[0];

  // One prayer toggle card; used for both alert and window-reminder grids.
  const renderPrayerCard = (
    label: string,
    isOn: boolean,
    anim: Animated.Value,
    cellStyle: object,
    accessibilityLabel: string,
    onToggle: () => void,
  ) => {
    const labelColor = !enabled
      ? rowDisabledTextColor
      : isOn
        ? textColor
        : rowOffTextColor;
    const indicatorColor = !enabled
      ? themeColors.textDisabled
      : isOn
        ? accentColor
        : rowOffTextColor;
    const cardBg = !enabled ? pillOffBgColor : isOn ? rowOnBgColor : rowOffBgColor;
    const cardBorder = !enabled ? dividerColor : isOn ? rowOnBorderColor : rowOffBorderColor;

    return (
      <Animated.View
        key={label}
        style={[cellStyle, { transform: [{ scale: anim }], opacity: enabled ? 1 : 0.55 }]}
      >
        <Pressable
          onPress={() => {
            if (!enabled) return;
            onToggle();
          }}
          disabled={!enabled}
          accessibilityRole="switch"
          accessibilityState={{ checked: isOn, disabled: !enabled }}
          accessibilityLabel={accessibilityLabel}
          style={({ pressed }) => [
            styles.prayerCard,
            { backgroundColor: cardBg, borderColor: cardBorder },
            pressed && enabled ? styles.prayerCardPressed : undefined,
          ]}
        >
          <Ionicons
            name={isOn ? "notifications" : "notifications-off-outline"}
            size={20}
            color={indicatorColor}
          />
          <Footnote color={labelColor} style={styles.prayerCardLabel} numberOfLines={1}>
            {label}
          </Footnote>
          <Caption color={indicatorColor} style={styles.prayerCardStatus}>
            {isOn ? "On" : "Off"}
          </Caption>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.section}>
      <Caption color={withOpacity(accentColor, 0.95)} style={styles.sectionLabel}>
        NOTIFICATIONS
      </Caption>
      <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
        {/* Master row: status mirror that routes to System Settings */}
        <Animated.View
          style={[styles.masterRow, { transform: [{ scale: headerScale }] }]}
        >
          <View style={styles.masterIcon}>
            <Ionicons name="notifications-outline" size={17} color={accentColor} />
          </View>
          <View style={styles.masterText}>
            <Headline color={textColor}>Notifications</Headline>
            <Caption color={themeColors.textTertiary} style={styles.masterSubtitle}>
              Managed in System Settings.
            </Caption>
          </View>
          {!loaded ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open system settings to change notifications"
              accessibilityValue={{ text: enabled ? "On" : "Off" }}
              onPress={async () => {
                pulseHeader();
                try {
                  await Linking.openSettings();
                } catch {
                  // ignore
                }
              }}
              style={({ pressed }) => [
                styles.masterControl,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Subhead color={themeColors.textSecondary} style={styles.masterStatus}>
                {enabled ? "On" : "Off"}
              </Subhead>
              <Ionicons name="chevron-forward" size={18} color={themeColors.iconMuted} />
            </Pressable>
          )}
        </Animated.View>

        {/* Reveal: kept mounted so close animates out smoothly */}
        <Animated.View
          pointerEvents={enabled ? "auto" : "none"}
          accessibilityElementsHidden={!enabled}
          importantForAccessibility={enabled ? "auto" : "no-hide-descendants"}
          style={[
            styles.reveal,
            {
              opacity: contentOpacity,
              transform: [
                { translateY: contentTranslateY },
                { scale: contentScale },
              ],
              maxHeight: contentMaxHeight,
            },
          ]}
        >
          <View onLayout={(e) => setRevealHeight(e.nativeEvent.layout.height)}>
          <View style={styles.revealDivider} />
          <View style={styles.prayerSectionHeader}>
            <Subhead color={textColor} style={styles.prayerSectionTitle} accessibilityRole="header">
              Prayer Alerts
            </Subhead>
            <Caption color={themeColors.textSecondary} style={styles.prayerSectionDescription}>
              Tap a prayer to turn its notification on or off.
            </Caption>
          </View>
          <View style={styles.prayerGrid}>
            {PRAYERS.map((p) =>
              renderPrayerCard(
                p,
                prefs[p],
                bellAnimations[p],
                styles.gridCell3,
                `${p} alert`,
                () => togglePrayer(p),
              ),
            )}
          </View>
          <View style={styles.revealDivider} />
          <View style={styles.prayerSectionHeader}>
            <Subhead color={textColor} style={styles.prayerSectionTitle} accessibilityRole="header">
              Window reminders
            </Subhead>
            <Caption color={themeColors.textSecondary} style={styles.prayerSectionDescription}>
              A heads up before a prayer&apos;s time runs out. Sent only if you have
              not logged it yet.
            </Caption>
          </View>

          <View
            style={[styles.soundSegmentRow, { opacity: enabled ? 1 : 0.55 }]}
            onLayout={offsetOnLayout}
            accessibilityRole="radiogroup"
          >
            {offsetSegmentWidth != null && offsetIndicatorTranslateX != null && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.soundSegmentHighlight,
                  {
                    width: offsetSegmentWidth,
                    transform: [{ translateX: offsetIndicatorTranslateX }],
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                  },
                ]}
              />
            )}
            {WINDOW_OFFSET_OPTIONS.map((minutes, idx) => {
              const selected = windowOffset === minutes;
              return (
                <Pressable
                  key={minutes}
                  disabled={!enabled}
                  onPress={() => enabled && handleOffsetChange(minutes)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !enabled }}
                  accessibilityLabel={`${minutes} minutes before`}
                  style={({ pressed }) => [
                    styles.soundSegment,
                    {
                      marginRight:
                        idx === WINDOW_OFFSET_OPTIONS.length - 1
                          ? 0
                          : SOUND_SEGMENT_GAP,
                      backgroundColor: selected ? "transparent" : pillOffBgColor,
                      borderColor: selected ? "transparent" : dividerColor,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Footnote
                    color={selected ? themeColors.onAccent : textColor}
                    style={styles.soundSegmentLabel}
                    numberOfLines={1}
                  >
                    {`${minutes} min`}
                  </Footnote>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.prayerGrid}>
            {WINDOW_PRAYERS.map((p) =>
              renderPrayerCard(
                p,
                windowPrefs[p],
                windowPrayerAnimations[p],
                styles.gridCell4,
                `${p} window reminder`,
                () => toggleWindowPrayer(p),
              ),
            )}
          </View>
          <View style={[styles.soundCard, { opacity: enabled ? 1 : 0.55 }]}>
            <Headline color={textColor} accessibilityRole="header">
              Adhan sound
            </Headline>
            <Caption color={themeColors.textSecondary} style={styles.soundSectionSubtitle}>
              Choose the alert sound for prayer reminders.
            </Caption>

            <View style={styles.soundSegmentRow} onLayout={onLayout} accessibilityRole="radiogroup">
              {segmentWidth != null && indicatorTranslateX != null && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.soundSegmentHighlight,
                    {
                      width: segmentWidth,
                      transform: [{ translateX: indicatorTranslateX }],
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                  ]}
                />
              )}
              {SOUND_OPTIONS.map((option, idx) => {
                const selected = soundMode === option.id;
                return (
                  <Pressable
                    key={option.id}
                    disabled={!enabled}
                    onPress={() => handleSoundModeChange(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label} sound option`}
                    style={({ pressed }) => [
                      styles.soundSegment,
                      {
                        marginRight:
                          idx === SOUND_OPTIONS.length - 1 ? 0 : SOUND_SEGMENT_GAP,
                        backgroundColor: selected ? "transparent" : pillOffBgColor,
                        borderColor: selected ? "transparent" : dividerColor,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Footnote
                      color={selected ? themeColors.onAccent : textColor}
                      style={styles.soundSegmentLabel}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Footnote>
                  </Pressable>
                );
              })}
            </View>
            {selectedSoundOption.description && (
              <View
                style={[
                  styles.soundDescriptionBox,
                  {
                    borderColor: dividerColor,
                    backgroundColor: withOpacity(textColor, 0.05),
                  },
                ]}
              >
                <Caption color={themeColors.textSecondary} style={styles.soundDescriptionText}>
                  {selectedSoundOption.description}
                </Caption>
                {selectedSoundOption.id === "adhan" && (
                  <Pressable
                    disabled={!enabled}
                    onPress={() =>
                      enabled && handlePreviewPress(selectedSoundOption.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Preview ${selectedSoundOption.label}`}
                    accessibilityState={{ disabled: !enabled }}
                    style={({ pressed }) => [
                      styles.soundPreviewButton,
                      {
                        backgroundColor: pressed
                          ? withOpacity(accentColor, 0.2)
                          : withOpacity(accentColor, 0.12),
                        borderColor: accentColor,
                        opacity: pressed ? 0.95 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={previewing === "adhan" ? "pause" : "play"}
                      size={16}
                      color={accentColor}
                    />
                    <Footnote color={accentColor} style={styles.soundPreviewText}>
                      {previewing === "adhan" ? "Stop preview" : "Play preview"}
                    </Footnote>
                  </Pressable>
                )}
              </View>
            )}
          </View>
          </View>
        </Animated.View>
      </GlassSurface>
    </View>
  );
}
