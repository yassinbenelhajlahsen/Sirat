import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import IconButton from "@/components/ui/IconButton";
import Screen from "@/components/ui/Screen";
import ScreenHeader from "@/components/ui/ScreenHeader";
import { Footnote, Subhead } from "@/components/ui/Text";
import NotificationSettings from "@/components/NotificationSettings";
import { AccountSection } from "@/components/settings/AccountSection";
import SettingsSection from "@/components/settings/SettingsSection";
import SettingsRow from "@/components/settings/SettingsRow";
import ThemePicker from "@/components/settings/ThemePicker";
import PickerDialog from "@/components/settings/PickerDialog";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { useAccountActions } from "@/hooks/useAccountActions";
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
  const screenMargin = useScreenMargin();

  const { signOut, deleteAccount } = useAccountActions();

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
  const locationFooter =
    permissionStatus === "granted"
      ? "Using live location. Turn this off to choose a fixed city."
      : "Enable to use your current location. Turn off for manual city mode.";

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingHorizontal: screenMargin },
          {
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.xxxl,
          },
        ]}
      >
        <View style={styles.grabber} />

        <ScreenHeader
          title="Settings"
          trailing={
            <IconButton
              icon="close"
              variant="glass"
              iconSize={20}
              onPress={() => {
                haptics("selection");
                router.back();
              }}
              accessibilityLabel="Close settings"
            />
          }
        />

        {/* Account */}
        <AccountSection
          onSignIn={() => router.push("/SignIn")}
          onSignOut={() => { void signOut(); }}
          onDeleteAccount={() =>
            Alert.alert(
              "Delete account",
              "This permanently deletes your account and all synced data. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    deleteAccount().catch(() => {
                      Alert.alert("Couldn't delete account", "Something went wrong. Please try again.");
                    });
                  },
                },
              ],
            )
          }
        />

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
                <Subhead color={colors.accent} style={styles.applyText}>
                  {applyingIcon ? "…" : "Apply"}
                </Subhead>
              }
            />
          ) : null}
        </SettingsSection>

        {/* Prayer Times */}
        <SettingsSection label="Prayer times" footer={locationFooter}>
          <SettingsRow
            first
            icon="compass-outline"
            title="Calculation method"
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
            trailing={
              <Switch
                accessibilityLabel="Use my location"
                value={useLocation}
                onValueChange={(val) => {
                  haptics("light");
                  void handleLocationToggle(val);
                }}
                trackColor={{ false: colors.grayDark, true: colors.accent }}
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

        {/* Notifications owns its own grouped sections */}
        <NotificationSettings notifStatus={notifStatus} />

        {/* About */}
        <SettingsSection label="About">
          <SettingsRow first icon="star-outline" title="Rate Sirat" showChevron onPress={rateApp} />
          <SettingsRow icon="share-social-outline" title="Share Sirat" showChevron onPress={shareApp} />
          <SettingsRow icon="shield-checkmark-outline" title="Privacy policy" showChevron onPress={openPrivacy} />
          <SettingsRow icon="mail-outline" title="Send feedback" showChevron onPress={sendFeedback} />
          <SettingsRow
            icon="globe-outline"
            title="Visit website"
            value="sirat.dev"
            showChevron
            onPress={openWebsite}
          />
        </SettingsSection>

        <Footnote color={colors.textTertiary} style={styles.version}>
          Sirat {getAppVersion()}
        </Footnote>
      </ScrollView>

      <PickerDialog
        visible={methodModalVisible}
        title="Calculation method"
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
    grabber: {
      width: 38,
      height: 5,
      borderRadius: theme.radii.pill,
      backgroundColor: withOpacity(colors.white, 0.28),
      alignSelf: "center",
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    applyText: { fontWeight: "600" },
    version: { textAlign: "center", marginTop: spacing.xl },
  });
};
