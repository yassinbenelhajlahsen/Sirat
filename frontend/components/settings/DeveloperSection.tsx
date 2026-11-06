import { Host, DatePicker } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";

import SettingsRow from "@/components/settings/SettingsRow";
import SettingsSection from "@/components/settings/SettingsSection";
import Button from "@/components/ui/Button";
import NativeSheet from "@/components/ui/NativeSheet";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import {
  TEST_NOTIFICATION_ITEMS,
  sendTestNotification,
  type TestNotificationKind,
} from "@/services/notifications/devTest";
import { formatClock } from "@/services/prayerDay";
import { appNow, isPretendingTime, setPretendTime } from "@/utils/devClock";
import { setChatDevBypass, useChatDevBypass } from "@/utils/devChat";
import { getAlwaysFirstSplash, setAlwaysFirstSplash } from "@/utils/devSplash";
import { isPretendingRamadan, setPretendRamadan } from "@/utils/hijriDate";

const HOUR_AND_MINUTE = ["hourAndMinute" as const];
const WHEEL = [datePickerStyle("wheel")];

/** Settings rows that only exist in dev builds, to preview states without waiting for them. */
export default function DeveloperSection() {
  const { theme } = useTheme();
  const { colors } = theme;
  const haptics = useHaptics();

  const [pretendRamadan, setPretendRamadanState] = useState(isPretendingRamadan);
  const chatBypass = useChatDevBypass();
  const [alwaysFirstSplash, setAlwaysFirstSplashState] = useState(false);
  useEffect(() => {
    void getAlwaysFirstSplash().then(setAlwaysFirstSplashState);
  }, []);

  const [notificationSheet, setNotificationSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [pretendTime, setPretendTimeState] = useState<Date | null>(
    isPretendingTime() ? appNow() : null,
  );

  const sendTest = async (kind: TestNotificationKind) => {
    setNotificationSheet(false);
    haptics("light");
    const sent = await sendTestNotification(kind).catch(() => false);
    if (!sent) Alert.alert("Could not send", "Allow notifications for Sirat, then try again.");
  };

  const pickTime = (date: Date) => {
    setPretendTime({ hour: date.getHours(), minute: date.getMinutes() });
    setPretendTimeState(date);
  };

  const useRealTime = () => {
    setPretendTime(null);
    setPretendTimeState(null);
    setTimeSheet(false);
  };

  return (
    <>
      <SettingsSection label="Developer">
        <SettingsRow
          first
          icon="sparkles-outline"
          title="Always first-launch splash"
          trailing={
            <Switch
              accessibilityLabel="Always first-launch splash"
              value={alwaysFirstSplash}
              onValueChange={(val) => {
                void setAlwaysFirstSplash(val);
                setAlwaysFirstSplashState(val);
              }}
              trackColor={{ false: colors.grayDark, true: colors.accent }}
            />
          }
        />
        <SettingsRow
          icon="moon-outline"
          title="Pretend it's Ramadan"
          trailing={
            <Switch
              accessibilityLabel="Pretend it's Ramadan"
              value={pretendRamadan}
              onValueChange={(val) => {
                setPretendRamadan(val);
                setPretendRamadanState(val);
              }}
              trackColor={{ false: colors.grayDark, true: colors.accent }}
            />
          }
        />
        <SettingsRow
          icon="chatbubble-ellipses-outline"
          title="Chat without sign-in or limit"
          subtitle="Needs a local server with CHAT_DEV_BYPASS=1"
          trailing={
            <Switch
              accessibilityLabel="Chat without sign-in or limit"
              value={chatBypass}
              onValueChange={(val) => void setChatDevBypass(val)}
              trackColor={{ false: colors.grayDark, true: colors.accent }}
            />
          }
        />
        <SettingsRow
          icon="time-outline"
          title="Pretend time of day"
          value={pretendTime ? formatClock(pretendTime) : "Real time"}
          showChevron
          onPress={() => setTimeSheet(true)}
        />
        <SettingsRow
          icon="notifications-outline"
          title="Send test notification"
          showChevron
          onPress={() => setNotificationSheet(true)}
        />
      </SettingsSection>

      {/* Plain rows, not PickerDialog: its FlatList can't sit inside the Settings ScrollView. */}
      <NativeSheet
        visible={notificationSheet}
        onClose={() => setNotificationSheet(false)}
        title="Send test notification"
      >
        <SettingsSection>
          {TEST_NOTIFICATION_ITEMS.map((item, i) => (
            <SettingsRow
              key={item.value}
              first={i === 0}
              title={item.label}
              onPress={() => void sendTest(item.value)}
            />
          ))}
        </SettingsSection>
      </NativeSheet>

      <NativeSheet visible={timeSheet} onClose={() => setTimeSheet(false)} title="Pretend time of day">
        <View style={styles.body}>
          <Host matchContents style={styles.picker}>
            <DatePicker
              selection={pretendTime ?? appNow()}
              displayedComponents={HOUR_AND_MINUTE}
              onDateChange={pickTime}
              modifiers={WHEEL}
            />
          </Host>
          <Button label="Use real time" variant="tonal" onPress={useRealTime} />
        </View>
      </NativeSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  picker: { alignSelf: "center" },
});
