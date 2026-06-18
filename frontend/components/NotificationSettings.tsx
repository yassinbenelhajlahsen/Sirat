// frontend/components/NotificationSettings.tsx
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { useAdhanPreview } from "../hooks/useAdhanPreview";
import { useNotificationPanelAnimation } from "../hooks/useNotificationPanelAnimation";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";
import { useNotificationSegmentLayout } from "../hooks/useNotificationSegmentLayout";
import {
  PRAYERS,
  SOUND_OPTIONS,
  SOUND_SEGMENT_GAP,
  type PrayerKey,
  type SoundMode,
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

  const textColor = themeColors.white;
  const accentColor = themeColors.accent;
  const dividerColor = withOpacity(themeColors.white, 0.08);
  const pillOffBgColor = withOpacity(themeColors.white, 0.04);
  const rowOnBgColor = withOpacity(themeColors.accent, 0.18);
  const rowOnBorderColor = withOpacity(themeColors.accent, 0.75);
  const rowOffBgColor = withOpacity(themeColors.white, 0.03);
  const rowOffBorderColor = withOpacity(themeColors.white, 0.12);
  const rowOffTextColor = withOpacity(themeColors.white, 0.65);
  const rowDisabledTextColor = withOpacity(themeColors.white, 0.4);

  const {
    loaded,
    enabled,
    prefs,
    soundMode,
    setPrayerPreference,
    updateSoundMode,
  } = useNotificationPreferences({ notifStatus });

  const { previewing, handlePreviewPress, stopPreview } =
    useAdhanPreview(enabled);

  const {
    headerScale,
    bellAnimations,
    contentOpacity,
    contentTranslateY,
    contentMaxHeight,
    contentScale,
    soundIndicator,
    pulseHeader,
    pulsePrayer,
  } = useNotificationPanelAnimation({ loaded, enabled, soundMode });

  const { segmentWidth, indicatorTranslateX, onLayout } =
    useNotificationSegmentLayout({
      soundIndicator,
      optionCount: SOUND_OPTIONS.length,
      gap: SOUND_SEGMENT_GAP,
    });

  const togglePrayer = useCallback(
    (k: PrayerKey) => {
      pulsePrayer(k);
      void setPrayerPreference(k, !prefs[k]);
    },
    [prefs, pulsePrayer, setPrayerPreference],
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
            <Text style={[styles.masterTitle, { color: textColor }]}>
              Notifications
            </Text>
            <Text
              style={[styles.masterSubtitle, { color: withOpacity(textColor, 0.55) }]}
            >
              Managed in System Settings.
            </Text>
          </View>
          {!loaded ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open system settings to change notifications"
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
              <Text
                style={[styles.masterStatus, { color: withOpacity(textColor, 0.6) }]}
              >
                {enabled ? "On" : "Off"}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={withOpacity(textColor, 0.4)}
              />
            </Pressable>
          )}
        </Animated.View>

        {/* Reveal: kept mounted so close animates out smoothly */}
        <Animated.View
          pointerEvents={enabled ? "auto" : "none"}
          accessibilityElementsHidden={!enabled}
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
          <View style={styles.revealDivider} />
          <View style={styles.prayerSectionHeader}>
            <Text style={[styles.prayerSectionTitle, { color: textColor }]}>
              Prayer Alerts
            </Text>
            <Text
              style={[
                styles.prayerSectionDescription,
                { color: withOpacity(textColor, 0.72) },
              ]}
            >
              Tap a row to enable or disable reminders for each prayer.
            </Text>
          </View>
          {PRAYERS.map((p) => {
            const isOn = prefs[p];
            const anim = bellAnimations[p];
            const labelColor = !enabled
              ? rowDisabledTextColor
              : isOn
                ? textColor
                : rowOffTextColor;
            const indicatorColor = !enabled
              ? withOpacity(textColor, 0.35)
              : isOn
                ? accentColor
                : rowOffTextColor;
            const cardBg = !enabled
              ? pillOffBgColor
              : isOn
                ? rowOnBgColor
                : rowOffBgColor;
            const cardBorder = !enabled
              ? dividerColor
              : isOn
                ? rowOnBorderColor
                : rowOffBorderColor;

            return (
              <Animated.View
                key={p}
                style={[
                  styles.rowWrapper,
                  { transform: [{ scale: anim }], opacity: enabled ? 1 : 0.55 },
                ]}
              >
                <Pressable
                  onPress={() => {
                    if (!enabled) return;
                    togglePrayer(p);
                  }}
                  disabled={!enabled}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isOn, disabled: !enabled }}
                  accessibilityLabel={`${p} alert`}
                  style={({ pressed }) => [
                    styles.rowBase,
                    styles.rowSurface,
                    { backgroundColor: cardBg, borderColor: cardBorder },
                    isOn && enabled ? styles.rowActive : undefined,
                    pressed && enabled ? styles.rowPressed : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: labelColor },
                      !enabled ? styles.rowLabelDisabled : undefined,
                    ]}
                  >
                    {p}
                  </Text>
                  <View style={styles.rowIndicator}>
                    <Ionicons
                      name={isOn ? "notifications" : "notifications-off-outline"}
                      size={18}
                      color={indicatorColor}
                    />
                    <Text
                      style={[styles.rowIndicatorText, { color: indicatorColor }]}
                    >
                      {isOn ? "On" : "Off"}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
          <View style={[styles.soundCard, { opacity: enabled ? 1 : 0.55 }]}>
            <Text
              style={[styles.soundSectionTitle, { color: textColor }]}
              accessibilityRole="header"
            >
              Adhan sound
            </Text>
            <Text
              style={[
                styles.soundSectionSubtitle,
                { color: withOpacity(textColor, 0.75) },
              ]}
            >
              Choose the alert sound for prayer reminders.
            </Text>

            <View style={styles.soundSegmentRow} onLayout={onLayout}>
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
                    <Text
                      style={[
                        styles.soundSegmentLabel,
                        { color: selected ? themeColors.onAccent : textColor },
                      ]}
                    >
                      {option.label}
                    </Text>
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
                <Text
                  style={[
                    styles.soundDescriptionText,
                    { color: withOpacity(textColor, 0.85) },
                  ]}
                >
                  {selectedSoundOption.description}
                </Text>
                {selectedSoundOption.id === "adhan" && (
                  <Pressable
                    disabled={!enabled}
                    onPress={() =>
                      enabled && handlePreviewPress(selectedSoundOption.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Preview ${selectedSoundOption.label}`}
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
                    <Text style={[styles.soundPreviewText, { color: accentColor }]}>
                      {previewing === "adhan" ? "Stop preview" : "Play preview"}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </GlassSurface>
    </View>
  );
}
