// app/components/NotificationSettings.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Easing,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

type PrayerKey = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
const PRAYERS: PrayerKey[] = [
  "Fajr",
  "Sunrise",
  "Dhuhr",
  "Asr",
  "Maghrib",
  "Isha",
];

const STORAGE_ENABLED = "notif_enabled_v1";
const STORAGE_MAP = "notif_map_v1";
export const NOTIF_PREFS_UPDATED_EVENT = "NOTIF_PREFS_UPDATED";

type Props = {
  // From Settings.tsx: notifStatus = "granted" | "denied"
  notifStatus?: string | null;
};

export default function NotificationSettings({ notifStatus }: Props) {
  const colors = useMemo(
    () => ({
      bg: "#134b0a",
      card: "#134b0a",
      cardAlt: "#1e5c1a",
      text: "#ffffff",
      subtext: "#C8E6C9",
      accent: "#DABA69",
      divider: "rgba(255,255,255,0.08)",
    }),
    []
  );

  const [enabled, setEnabled] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<Record<PrayerKey, boolean>>({
    Fajr: true,
    Sunrise: true,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true,
  });

  // Track whether the user has an explicit stored preference
  const hasStoredEnabledKey = useRef<boolean>(false);

  // Animation: header pulse (matches location toggle scale)
  const headerScale = useRef(new Animated.Value(1)).current;

  // Animation: content open/close (fade, slide, expand)
  const contentAnim = useRef(new Animated.Value(0)).current;

  const bellAnimRef = useRef<Record<PrayerKey, Animated.Value>>({
    Fajr: new Animated.Value(1),
    Sunrise: new Animated.Value(1),
    Dhuhr: new Animated.Value(1),
    Asr: new Animated.Value(1),
    Maghrib: new Animated.Value(1),
    Isha: new Animated.Value(1),
  });

  // Load prefs
  useEffect(() => {
    (async () => {
      try {
        const [rawEnabled, rawMap] = await Promise.all([
          AsyncStorage.getItem(STORAGE_ENABLED),
          AsyncStorage.getItem(STORAGE_MAP),
        ]);
        hasStoredEnabledKey.current = rawEnabled !== null;

        if (rawEnabled !== null) setEnabled(rawEnabled === "1");
        if (rawMap) setPrefs((p) => ({ ...p, ...JSON.parse(rawMap) }));
      } catch {
        // ignore load errors
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Auto-enable once if OS permission is granted and user never chose
  useEffect(() => {
    if (!loaded) return;
    if (notifStatus === "granted" && !hasStoredEnabledKey.current && !enabled) {
      persistEnabled(true);
      hasStoredEnabledKey.current = true;
    }
  }, [notifStatus, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drive open/close animation when enabled changes
  useEffect(() => {
    if (!loaded) return;
    Animated.timing(contentAnim, {
      toValue: enabled ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // using maxHeight so must be false
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

  const persistEnabled = useCallback(
    async (val: boolean) => {
      setEnabled(val);
      await AsyncStorage.setItem(STORAGE_ENABLED, val ? "1" : "0");
      DeviceEventEmitter.emit(NOTIF_PREFS_UPDATED_EVENT, {
        enabled: val,
        prefs,
      });
    },
    [prefs]
  );

  const setPrayer = useCallback(
    async (k: PrayerKey, val: boolean) => {
      const next = { ...prefs, [k]: val };
      setPrefs(next);
      await AsyncStorage.setItem(STORAGE_MAP, JSON.stringify(next));
      DeviceEventEmitter.emit(NOTIF_PREFS_UPDATED_EVENT, {
        enabled,
        prefs: next,
      });
    },
    [prefs, enabled]
  );

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
      setPrayer(k, !prefs[k]);
    },
    [prefs, setPrayer]
  );

  // Interpolations for content reveal
  const contentOpacity = contentAnim; // 0 -> 1
  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });
  // Big enough max height to cover the list; keeps it smooth without measuring
  const contentMaxHeight = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 600],
  });
  const contentScale = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  return (
    <View>
      <Animated.View
        style={[
          styles.sectionHeader,
          { transform: [{ scale: headerScale }] },
        ]}
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
            onValueChange={(val) => {
              hasStoredEnabledKey.current = true;
              pulseHeader();
              persistEnabled(val);
            }}
            trackColor={{
              false: "rgba(255,255,255,0.08)",
              true: colors.accent,
            }}
            thumbColor={enabled ? "#ffffff" : "#f4f3f4"}
            ios_backgroundColor="rgba(255,255,255,0.08)"
            accessibilityLabel={
              enabled ? "Disable notifications" : "Enable notifications"
            }
          />
        )}
      </Animated.View>

      {/* Keep mounted so close animates out smoothly */}
      <Animated.View
        pointerEvents={enabled ? "auto" : "none"}
        accessibilityElementsHidden={!enabled}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.divider,
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }, { scale: contentScale }],
            maxHeight: contentMaxHeight,
            overflow: "hidden",
          },
        ]}
      >
        {PRAYERS.map((p, idx) => {
          const isOn = prefs[p];
          const anim = bellAnimRef.current[p];
          return (
            <Animated.View
              key={p}
              style={[
                styles.itemCard,
                {
                  backgroundColor: idx % 2 === 0 ? colors.cardAlt : colors.card,
                  borderColor: colors.divider,
                  transform: [{ scale: anim }],
                },
              ]}
            >
              <View style={styles.itemRow}>
                <View style={styles.meta}>
                  <Text style={[styles.title, { color: colors.text }]}>{p}</Text>
                </View>

                <Animated.View>
                  <Pressable
                    onPress={() => togglePrayer(p)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`${p} alert ${isOn ? "on" : "off"}. Toggle`}
                    style={[
                      styles.togglePill,
                      {
                        backgroundColor: isOn
                          ? colors.accent
                          : "rgba(255,255,255,0.04)",
                        borderColor: isOn ? "transparent" : colors.divider,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isOn ? "notifications" : "notifications-off-outline"}
                      size={16}
                      color={isOn ? "#0c3605" : colors.subtext}
                    />
                  </Pressable>
                </Animated.View>
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  card: {
    marginTop: 10,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  meta: { flex: 1, justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "SFProDisplay-Semibold" },
  subtitle: {
    fontSize: 12,
    marginTop: 3,
    fontFamily: "SFProDisplay-Regular",
    opacity: 0.9,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    minWidth: 44,
  },
});
