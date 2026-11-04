import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, ScrollView } from "react-native";

import NotificationSettings from "@/components/NotificationSettings";
import Screen from "@/components/ui/Screen";
import { useTheme } from "@/context/ThemeContext";
import { useScreenMargin } from "@/hooks/useScreenMargin";

export default function NotificationSettingsPage() {
  const { theme } = useTheme();
  const screenMargin = useScreenMargin();
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  // Re-read on return from iOS Settings, where the user may have changed the permission.
  const refresh = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      setNotifStatus(perm.granted ? "granted" : "denied");
    } catch {
      setNotifStatus("denied");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: screenMargin, paddingBottom: theme.spacing.xxxl }}
      >
        <NotificationSettings notifStatus={notifStatus} />
      </ScrollView>
    </Screen>
  );
}
