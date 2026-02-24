import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Linking } from "react-native";

export function useSettingsPermissions({
  useLocation,
  setUseLocation,
}: {
  useLocation: boolean;
  setUseLocation: (value: boolean) => void;
}) {
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const perm = await Location.getForegroundPermissionsAsync();
      const notifPerm = await Notifications.getPermissionsAsync();

      setPermissionStatus(perm.status);
      setNotifStatus(notifPerm.granted ? "granted" : "denied");

      if (useLocation && (!servicesEnabled || perm.status !== "granted")) {
        setUseLocation(false);
      }
    } catch (e) {
      console.warn("Permission refresh failed:", e);
      if (useLocation) setUseLocation(false);
      setNotifStatus("denied");
    }
  }, [setUseLocation, useLocation]);

  useEffect(() => {
    void refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        await refreshPermissionStatus();
      }
    });

    return () => sub.remove();
  }, [refreshPermissionStatus]);

  const handleLocationToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        setUseLocation(false);
        return;
      }

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          Alert.alert(
            "Location is off",
            "Please enable Location Services on your device, then try again.",
            [
              { text: "Open Settings", onPress: () => Linking.openSettings() },
              { text: "Cancel", style: "cancel" },
            ],
          );
          setUseLocation(false);
          return;
        }

        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          perm = await Location.requestForegroundPermissionsAsync();
        }

        setPermissionStatus(perm.status);

        if (perm.status === "granted") {
          setUseLocation(true);
          return;
        }

        Alert.alert(
          "Permission needed",
          "Sirat needs Location permission for automatic prayer times.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" },
          ],
        );
        setUseLocation(false);
      } catch (e) {
        console.warn("handleLocationToggle error:", e);
        setUseLocation(false);
      }
    },
    [setUseLocation],
  );

  return {
    permissionStatus,
    notifStatus,
    handleLocationToggle,
  };
}
