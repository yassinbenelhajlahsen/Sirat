import { colors as themeColors, withOpacity } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";

import {
  PRAYERS,
  SOUND_OPTIONS,
  SOUND_SEGMENT_GAP,
  type PrayerKey,
  type SoundMode,
} from "./notification/constants";
import { notificationStyles as styles } from "./notification/styles";
import { useAdhanPreview } from "./notification/useAdhanPreview";
import { useNotificationPreferences } from "./notification/useNotificationPreferences";

export { NOTIF_PREFS_UPDATED_EVENT } from "./notification/constants";

type Props = {
  // From Settings.tsx: "granted" | "denied" | null
  notifStatus?: string | null;
};

export default function NotificationSettings({ notifStatus }: Props) {
  const colors = {
    text: themeColors.white,
    accent: themeColors.accent,
    divider: withOpacity(themeColors.white, 0.08),
    pillOffBg: withOpacity(themeColors.white, 0.04),
  } as const;

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

  const [segmentWidth, setSegmentWidth] = useState<number | null>(null);

  // Animations
  const headerScale = useRef(new Animated.Value(1)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const soundIndicator = useRef(
    new Animated.Value(soundMode === "adhan" ? 1 : 0)
  ).current;

  const bellAnimRef = useRef<Record<PrayerKey, Animated.Value>>({
    Fajr: new Animated.Value(1),
    Sunrise: new Animated.Value(1),
    Dhuhr: new Animated.Value(1),
    Asr: new Animated.Value(1),
    Maghrib: new Animated.Value(1),
    Isha: new Animated.Value(1),
  });

  const initialAnimSet = useRef(false);

  // Drive open/close animation when enabled changes
  useEffect(() => {
    if (!loaded) return;
    if (!initialAnimSet.current) {
      contentAnim.setValue(enabled ? 1 : 0);
      initialAnimSet.current = true;
      return;
    }
    Animated.timing(contentAnim, {
      toValue: enabled ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // maxHeight animation
    }).start();
  }, [enabled, loaded, contentAnim]);

  const pulseHeader = () => {
    Animated.sequence([
      Animated.timing(headerScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(headerScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pulse = (k: PrayerKey) => {
    const a = bellAnimRef.current[k];
    a.setValue(1);
    Animated.sequence([
      Animated.timing(a, {
        toValue: 0.9,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(a, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const togglePrayer = useCallback(
    (k: PrayerKey) => {
      pulse(k);
      void setPrayerPreference(k, !prefs[k]);
    },
    [prefs, setPrayerPreference]
  );

  const handleSoundModeChange = useCallback(
    async (nextMode: SoundMode) => {
      if (nextMode === soundMode) return;
      await stopPreview();
      await updateSoundMode(nextMode);
    },
    [soundMode, stopPreview, updateSoundMode]
  );

  useEffect(() => {
    Animated.timing(soundIndicator, {
      toValue: soundMode === "adhan" ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: true,
    }).start();
  }, [soundIndicator, soundMode]);

  // Interpolations for content reveal
  const contentOpacity = contentAnim;
  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });
  const contentMaxHeight = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 820],
  });
  const contentScale = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  const selectedSoundOption =
    SOUND_OPTIONS.find((option) => option.id === soundMode) ?? SOUND_OPTIONS[0];

  return (
    <View>
      <Animated.View
        style={[styles.sectionHeader, { transform: [{ scale: headerScale }] }]}
      >
        <View style={{ flexShrink: 1, paddingRight: 12 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Notifications
          </Text>
          <Text
            style={{
              color: colors.text,
              opacity: 0.8,
              fontSize: 13,
              marginTop: 2,
              fontFamily: "SFProDisplay-Regular",
            }}
          >
            Alerts for prayers
          </Text>
        </View>

        {!loaded ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={async () => {
              // Do not flip locally. Always guide user to system settings.
              pulseHeader();
              try {
                await Linking.openSettings();
              } catch {
                // ignore
              }
            }}
            trackColor={{
              false: colors.divider,
              true: colors.accent,
            }}
            thumbColor={enabled ? colors.text : themeColors.offWhite}
            ios_backgroundColor={colors.divider}
            accessibilityLabel="Open system settings to change notifications"
          />
        )}
      </Animated.View>

      {/* Keep mounted so close animates out smoothly */}
      <Animated.View
        pointerEvents={enabled ? "auto" : "none"}
        accessibilityElementsHidden={!enabled}
        style={[
          styles.cardContainer,
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
        {PRAYERS.map((p) => {
          const isOn = prefs[p];
          const anim = bellAnimRef.current[p];
          const iconColor = enabled
            ? isOn
              ? colors.accent
              : withOpacity(colors.text, 0.55)
            : withOpacity(colors.text, 0.35);

          return (
            <Animated.View
              key={p}
              style={[
                styles.rowWrapper,
                {
                  transform: [{ scale: anim }],
                  opacity: enabled ? 1 : 0.55,
                },
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
                  isOn && enabled ? styles.rowActive : undefined,
                  pressed && enabled ? styles.rowPressed : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.rowLabel,
                    !enabled ? styles.rowLabelDisabled : undefined,
                  ]}
                >
                  {p}
                </Text>
                <View style={styles.rowIndicator}>
                  <Ionicons
                    name={isOn ? "notifications" : "notifications-off-outline"}
                    size={18}
                    color={iconColor}
                  />
                  <Text style={[styles.rowIndicatorText, { color: iconColor }]}>
                    {isOn ? "On" : "Off"}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
        <View
          style={[
            styles.soundCard,
            {
              opacity: enabled ? 1 : 0.55,
            },
          ]}
        >
          <Text
            style={[styles.soundSectionTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            Adhan sound
          </Text>
          <Text
            style={[
              styles.soundSectionSubtitle,
              { color: withOpacity(colors.text, 0.75) },
            ]}
          >
            Choose the alert sound for prayer reminders.
          </Text>

          <View
            style={styles.soundSegmentRow}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (!width) return;
              const calculated =
                (width - SOUND_SEGMENT_GAP * (SOUND_OPTIONS.length - 1)) /
                SOUND_OPTIONS.length;
              if (!Number.isFinite(calculated) || calculated <= 0) return;
              if (
                segmentWidth != null &&
                Math.abs(segmentWidth - calculated) < 0.5
              ) {
                return;
              }
              setSegmentWidth(calculated);
            }}
          >
            {segmentWidth != null && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.soundSegmentHighlight,
                  {
                    width: segmentWidth,
                    transform: [
                      {
                        translateX: soundIndicator.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, segmentWidth + SOUND_SEGMENT_GAP],
                        }),
                      },
                    ],
                    backgroundColor: colors.accent,
                    borderColor: colors.accent,
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
                        idx === SOUND_OPTIONS.length - 1
                          ? 0
                          : SOUND_SEGMENT_GAP,
                      backgroundColor: selected
                        ? "transparent"
                        : colors.pillOffBg,
                      borderColor: selected ? "transparent" : colors.divider,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.soundSegmentLabel,
                      {
                        color: selected ? themeColors.primaryDark : colors.text,
                      },
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
                  borderColor: colors.divider,
                  backgroundColor: withOpacity(colors.text, 0.05),
                },
              ]}
            >
              <Text
                style={[
                  styles.soundDescriptionText,
                  { color: withOpacity(colors.text, 0.85) },
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
                        ? withOpacity(colors.accent, 0.2)
                        : withOpacity(colors.accent, 0.12),
                      borderColor: colors.accent,
                      opacity: pressed ? 0.95 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={previewing === "adhan" ? "pause" : "play"}
                    size={16}
                    color={colors.accent}
                  />
                  <Text
                    style={[styles.soundPreviewText, { color: colors.accent }]}
                  >
                    {previewing === "adhan" ? "Stop preview" : "Play preview"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
