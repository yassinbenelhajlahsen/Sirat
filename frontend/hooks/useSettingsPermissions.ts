import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Linking } from "react-native";

export function useSettingsPermissions({
  setUseLocation,
}: {
  setUseLocation: (value: boolean) => void;
}) {
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  // Null until checked. Whether this device can use location is shown, never saved over the user's choice.
  const [locationAllowed, setLocationAllowed] = useState<boolean | null>(null);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const perm = await Location.getForegroundPermissionsAsync();
      const notifPerm = await Notifications.getPermissionsAsync();

      setPermissionStatus(perm.status);
      setLocationAllowed(servicesEnabled && perm.status === "granted");
      setNotifStatus(notifPerm.granted ? "granted" : "denied");
    } catch (e) {
      console.warn("Permission refresh failed:", e);
      setNotifStatus("denied");
    }
  }, []);

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
          return;
        }

        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          perm = await Location.requestForegroundPermissionsAsync();
        }

        setPermissionStatus(perm.status);

        if (perm.status === "granted") {
          setLocationAllowed(true);
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
      } catch (e) {
        console.warn("handleLocationToggle error:", e);
      }
    },
    [setUseLocation],
  );

  return {
    permissionStatus,
    locationAllowed,
    notifStatus,
    handleLocationToggle,
  };
}
