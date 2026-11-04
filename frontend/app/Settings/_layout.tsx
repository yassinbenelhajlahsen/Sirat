import { router, Stack } from "expo-router";

import { glassTintFor } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useNativeHeaderOptions } from "@/hooks/useNativeHeaderOptions";

// Settings is one modal sheet; sub pages such as Notifications push inside it.
export default function SettingsLayout() {
  const { theme } = useTheme();
  const header = useNativeHeaderOptions("Settings", { large: false, titleSize: 26 });

  return (
    <Stack
      screenOptions={{
        ...header,
        contentStyle: { backgroundColor: theme.colors.primaryDark },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          unstable_headerRightItems: () => [
            {
              type: "button",
              label: "Close",
              icon: { type: "sfSymbol", name: "xmark" },
              variant: "prominent" as const,
              tintColor: glassTintFor(theme),
              onPress: () => router.back(),
            },
          ],
        }}
      />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
    </Stack>
  );
}
