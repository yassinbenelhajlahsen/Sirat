// frontend/components/NotificationSettings.tsx
import { useTheme } from "@/context/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Linking, Switch, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import Segmented from "@/components/ui/Segmented";
import SettingsRow from "@/components/settings/SettingsRow";
import SettingsSection from "@/components/settings/SettingsSection";
import { Subhead } from "@/components/ui/Text";
import { useAdhanPreview } from "../hooks/useAdhanPreview";
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

const WINDOW_FOOTER =
  "A heads up before a prayer's time runs out. Sent only if you have not logged it yet.";

const ANNOUNCEMENTS_FOOTER =
  "Occasional news about new features. Prayer reminders are not affected.";
const FRIDAY_FOOTER = "A notification before Dhuhr every Friday to remind you to read Surah Al-Kahf.";

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
    fridayEnabled,
    announcementsEnabled,
    setPrayerPreference,
    updateSoundMode,
    setWindowPreference,
    setWindowOffset,
    setFridayEnabled,
    setAnnouncementsEnabled,
  } = useNotificationPreferences({ notifStatus });

  const { previewing, handlePreviewPress, stopPreview } = useAdhanPreview(enabled);

  const [revealHeight, setRevealHeight] = useState(0);

  // The options reveal when notifications are on: fade, lift and grow. A first load or Reduce Motion snaps.
  const [contentAnim] = useState(() => new Animated.Value(0));
  const revealedOnce = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    if (!revealedOnce.current || reduceMotion) {
      contentAnim.setValue(enabled ? 1 : 0);
      revealedOnce.current = true;
      return;
    }
    Animated.timing(contentAnim, {
      toValue: enabled ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [contentAnim, enabled, loaded, reduceMotion]);

  const contentOpacity = contentAnim;
  const contentTranslateY = contentAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  // Until the content reports its real height this stays generous so nothing is clipped on the first frame.
  const contentMaxHeight = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, revealHeight > 0 ? revealHeight : 2000],
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

            <SettingsSection footer={FRIDAY_FOOTER}>
              <SettingsRow
                first
                title="Friday reminder"
                trailing={switchFor("Friday reminder", fridayEnabled, (next) => {
                  void setFridayEnabled(next);
                })}
              />
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

            <SettingsSection footer={ANNOUNCEMENTS_FOOTER}>
              <SettingsRow
                first
                title="App announcements"
                trailing={switchFor("App announcements", announcementsEnabled, (next) => {
                  void setAnnouncementsEnabled(next);
                })}
              />
            </SettingsSection>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
