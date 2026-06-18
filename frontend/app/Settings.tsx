import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassSurface from "@/components/ui/GlassSurface";
import Screen from "@/components/ui/Screen";
import { Caption, Footnote, LargeTitle } from "@/components/ui/Text";
import PressableScale from "@/components/PressableScale";
import NotificationSettings from "@/components/NotificationSettings";
import SettingsSection from "@/components/settings/SettingsSection";
import SettingsRow from "@/components/settings/SettingsRow";
import ThemePicker from "@/components/settings/ThemePicker";
import PickerDialog from "@/components/settings/PickerDialog";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { usePrayerSettingsState } from "@/hooks/usePrayerSettingsState";
import { useSettingsPermissions } from "@/hooks/useSettingsPermissions";
import CALCULATION_METHODS from "@/utils/calculationMethods";
import {
  getAppVersion,
  openPrivacy,
  openWebsite,
  rateApp,
  sendFeedback,
  shareApp,
} from "@/utils/appLinks";
import {
  alternateIconsSupported,
  applyIconForTheme,
  getActiveIconName,
  iconNameForTheme,
} from "@/services/appIcon";

const METHOD_ITEMS = CALCULATION_METHODS.map((m) => ({
  label: m.name,
  value: m.id,
}));

export default function Settings() {
  const { theme, themeName } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const haptics = useHaptics();

  const {
    useLocation,
    setUseLocation,
    method,
    setMethod,
    city,
    cityModalVisible,
    setCityModalVisible,
    cityItems,
    selectCityByKey,
  } = usePrayerSettingsState();
  const { permissionStatus, notifStatus, handleLocationToggle } =
    useSettingsPermissions({ useLocation, setUseLocation });

  const [methodModalVisible, setMethodModalVisible] = useState(false);

  // App-icon-per-theme: only offered when the live icon doesn't match the theme.
  const [iconSupported] = useState(alternateIconsSupported);
  const [activeIcon, setActiveIcon] = useState<string | null>(getActiveIconName);
  const [applyingIcon, setApplyingIcon] = useState(false);
  const iconNeedsMatch =
    iconSupported && iconNameForTheme(themeName) !== activeIcon;

  const handleMatchIcon = async () => {
    setApplyingIcon(true);
    try {
      await applyIconForTheme(themeName);
    } catch {
      Alert.alert(
        "Couldn't change icon",
        "The app icon couldn't be updated. Please try again.",
      );
    } finally {
      setActiveIcon(getActiveIconName());
      setApplyingIcon(false);
    }
  };

  const methodLabel =
    CALCULATION_METHODS.find((m) => m.id === method)?.name ?? "Auto";
  const cityLabel = city
    ? `${city.name}${city.country ? ", " + city.country : ""}`
    : "Select city";
  const locationSubtitle =
    permissionStatus === "granted"
      ? "Using live location. Turn this off to choose a fixed city."
      : "Enable to use your current location. Turn off for manual city mode.";

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.xxxl,
          },
        ]}
      >
        <View style={styles.grabber} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Caption color={withOpacity(colors.accent, 0.95)} style={styles.eyebrow}>
              PREFERENCES
            </Caption>
            <LargeTitle>Settings</LargeTitle>
          </View>
          <PressableScale
            onPress={() => {
              haptics("selection");
              router.back();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
          >
            <GlassSurface tier="chrome" radius={22} style={styles.closeChip}>
              <Ionicons name="close" size={20} color={withOpacity(colors.white, 0.85)} />
            </GlassSurface>
          </PressableScale>
        </View>

        {/* Appearance */}
        <SettingsSection label="Appearance">
          <ThemePicker />
          {iconNeedsMatch ? (
            <SettingsRow
              icon="phone-portrait-outline"
              title="Match app icon to theme"
              subtitle="Update your Home Screen icon to fit this theme."
              onPress={handleMatchIcon}
              disabled={applyingIcon}
              accessibilityLabel="Match app icon to theme"
              trailing={
                <Caption color={colors.accent} style={styles.applyText}>
                  {applyingIcon ? "…" : "Apply"}
                </Caption>
              }
            />
          ) : null}
        </SettingsSection>

        {/* Prayer Times */}
        <SettingsSection label="Prayer Times">
          <SettingsRow
            first
            icon="compass-outline"
            title="Calculation Method"
            value={methodLabel}
            showChevron
            onPress={() => {
              haptics("selection");
              setMethodModalVisible(true);
            }}
          />
          <SettingsRow
            icon="location-outline"
            title="Use my location"
            subtitle={locationSubtitle}
            trailing={
              <Switch
                accessibilityLabel="Use my location"
                value={useLocation}
                onValueChange={(val) => {
                  haptics("light");
                  void handleLocationToggle(val);
                }}
                trackColor={{
                  false: colors.grayDark,
                  true: theme.name === "light" ? "#DABA69" : colors.accent,
                }}
                thumbColor={useLocation ? "#FFFFFF" : colors.grayMuted}
              />
            }
          />
          {!useLocation ? (
            <SettingsRow
              icon="business-outline"
              title="Manual city"
              value={cityLabel}
              showChevron
              onPress={() => {
                haptics("selection");
                setCityModalVisible(true);
              }}
            />
          ) : null}
        </SettingsSection>

        {/* Notifications — owns its own section label + glass card (Task 6) */}
        <NotificationSettings notifStatus={notifStatus} />

        {/* About */}
        <SettingsSection label="About">
          <SettingsRow first icon="star-outline" title="Rate Sirat" showChevron onPress={rateApp} />
          <SettingsRow icon="share-outline" title="Share Sirat" showChevron onPress={shareApp} />
          <SettingsRow icon="shield-checkmark-outline" title="Privacy Policy" showChevron onPress={openPrivacy} />
          <SettingsRow icon="mail-outline" title="Send Feedback" showChevron onPress={sendFeedback} />
          <SettingsRow
            icon="globe-outline"
            title="Visit website"
            value="sirat.dev"
            showChevron
            onPress={openWebsite}
          />
        </SettingsSection>

        <Footnote color={withOpacity(colors.white, 0.4)} style={styles.version}>
          Sirat {getAppVersion()}
        </Footnote>
      </ScrollView>

      <PickerDialog
        visible={methodModalVisible}
        title="Calculation Method"
        subtitle="Authority used to compute prayer schedules."
        items={METHOD_ITEMS}
        selected={method}
        onSelect={(value) => {
          setMethod(value);
          setMethodModalVisible(false);
        }}
        onClose={() => setMethodModalVisible(false)}
      />
      <PickerDialog
        visible={cityModalVisible}
        searchable
        title="Select city"
        subtitle="Search from the supported cities list."
        items={cityItems}
        onSelect={(value) => selectCityByKey(value)}
        onClose={() => setCityModalVisible(false)}
      />
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    content: { paddingHorizontal: spacing.xl },
    grabber: {
      width: 38,
      height: 5,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.white, 0.28),
      alignSelf: "center",
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    headerText: { flex: 1, paddingRight: spacing.md },
    eyebrow: { letterSpacing: 1.4, marginBottom: spacing.xs },
    closeChip: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    applyText: { fontWeight: "700" },
    version: { textAlign: "center", marginTop: spacing.xl },
  });
};
