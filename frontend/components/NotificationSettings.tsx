// frontend/components/NotificationSettings.tsx
import { useTheme } from "@/context/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Animated, Linking, Switch, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import Segmented from "@/components/ui/Segmented";
import SettingsRow from "@/components/settings/SettingsRow";
import SettingsSection from "@/components/settings/SettingsSection";
import { Subhead } from "@/components/ui/Text";
import { useAdhanPreview } from "../hooks/useAdhanPreview";
import { useNotificationPanelAnimation } from "../hooks/useNotificationPanelAnimation";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";
import {
  PRAYERS,
  SOUND_OPTIONS,
  WINDOW_OFFSET_OPTIONS,
  WINDOW_PRAYERS,
  type PrayerKey,
  type SoundMode,
  type WindowPrayerKey,
} from "../utils/notifications/constants";
import { getNotificationStyles } from "../utils/notifications/styles";

export { NOTIF_PREFS_UPDATED_EVENT } from "../utils/notifications/constants";

const WINDOW_FOOTER =
  "A heads up before a prayer's time runs out. Sent only if you have not logged it yet.";

type Props = {
  // From Settings.tsx: "granted" | "denied" | null
  notifStatus?: string | null;
};

export default function NotificationSettings({ notifStatus }: Props) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => getNotificationStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();

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

  const { previewing, handlePreviewPress, stopPreview } = useAdhanPreview(enabled);

  const [revealHeight, setRevealHeight] = useState(0);

  const offsetIndex = Math.max(
    0,
    (WINDOW_OFFSET_OPTIONS as readonly number[]).indexOf(windowOffset),
  );

  // Only the reveal fade is still rendered: the bell and header pulses went with
  // the old toggle cards. The hook keeps its full signature.
  const { contentOpacity, contentTranslateY, contentMaxHeight } =
    useNotificationPanelAnimation({
      loaded,
      enabled,
      soundMode,
      contentHeight: revealHeight,
      offsetIndex,
      reduceMotion,
    });

  const togglePrayer = useCallback(
    (k: PrayerKey, next: boolean) => {
      void setPrayerPreference(k, next);
    },
    [setPrayerPreference],
  );

  const toggleWindowPrayer = useCallback(
    (k: WindowPrayerKey, next: boolean) => {
      void setWindowPreference(k, next);
    },
    [setWindowPreference],
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

  const openSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // ignore
    }
  }, []);

  const selectedSoundOption =
    SOUND_OPTIONS.find((option) => option.id === soundMode) ?? SOUND_OPTIONS[0];

  const offsetOptions = useMemo(
    () =>
      WINDOW_OFFSET_OPTIONS.map((minutes) => ({
        value: minutes,
        label: `${minutes} min`,
        accessibilityLabel: `${minutes} minutes before`,
      })),
    [],
  );

  const switchFor = (
    label: string,
    value: boolean,
    onChange: (next: boolean) => void,
  ) => (
    <Switch
      accessibilityLabel={label}
      value={value}
      disabled={!enabled}
      onValueChange={onChange}
      trackColor={{ false: themeColors.grayDark, true: themeColors.accent }}
    />
  );

  return (
    <View>
      <SettingsSection label="Notifications">
        <SettingsRow
          first
          icon="notifications-outline"
          title="Notifications"
          value={loaded ? (enabled ? "On" : "Off") : undefined}
          trailing={loaded ? undefined : <ActivityIndicator size="small" color={themeColors.accent} />}
          showChevron={loaded}
          onPress={loaded ? openSystemSettings : undefined}
          accessibilityLabel="Open system settings to change notifications"
        />
      </SettingsSection>

      {/* Kept mounted so closing animates out; inert while notifications are off. */}
      <Animated.View
        pointerEvents={enabled ? "auto" : "none"}
        accessibilityElementsHidden={!enabled}
        importantForAccessibility={enabled ? "auto" : "no-hide-descendants"}
        style={{
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslateY }],
          maxHeight: contentMaxHeight,
        }}
      >
        <View onLayout={(e) => setRevealHeight(e.nativeEvent.layout.height)}>
          <View style={enabled ? undefined : styles.dimmed}>
            <SettingsSection label="Prayer alerts">
              {PRAYERS.map((p, i) => (
                <SettingsRow
                  key={p}
                  first={i === 0}
                  title={p}
                  trailing={switchFor(`${p} alert`, prefs[p], (next) => togglePrayer(p, next))}
                />
              ))}
            </SettingsSection>

            <SettingsSection label="Window reminders" footer={WINDOW_FOOTER}>
              <View style={styles.segmentRow}>
                <Segmented
                  options={offsetOptions}
                  value={windowOffset}
                  onChange={handleOffsetChange}
                  disabled={!enabled}
                  accessibilityLabel="Minutes before the prayer ends"
                />
              </View>
              {WINDOW_PRAYERS.map((p) => (
                <SettingsRow
                  key={p}
                  title={p}
                  trailing={switchFor(
                    `${p} window reminder`,
                    windowPrefs[p],
                    (next) => toggleWindowPrayer(p, next),
                  )}
                />
              ))}
            </SettingsSection>

            <SettingsSection label="Adhan sound" footer={selectedSoundOption.description}>
              {SOUND_OPTIONS.map((option, i) => {
                const selected = soundMode === option.id;
                const canPreview = selected && option.id === "adhan";
                return (
                  <SettingsRow
                    key={option.id}
                    first={i === 0}
                    title={option.label}
                    accessibilityLabel={`${option.label} sound option`}
                    onPress={() => void handleSoundModeChange(option.id)}
                    disabled={!enabled}
                    trailing={
                      <View style={styles.soundTrailing}>
                        {canPreview ? (
                          <PressableScale
                            variant="button"
                            disabled={!enabled}
                            hitSlop={8}
                            onPress={() => enabled && handlePreviewPress(option.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Preview ${option.label}`}
                            accessibilityState={{ disabled: !enabled }}
                          >
                            <Subhead color={themeColors.accent} style={styles.previewAction}>
                              {previewing === "adhan" ? "Stop preview" : "Preview"}
                            </Subhead>
                          </PressableScale>
                        ) : null}
                        {selected ? (
                          <AppIcon name="checkmark" size={18} color={themeColors.accent} />
                        ) : null}
                      </View>
                    }
                  />
                );
              })}
            </SettingsSection>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
