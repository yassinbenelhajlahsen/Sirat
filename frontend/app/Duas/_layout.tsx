import { router, Stack } from "expo-router";

import { glassTintFor } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useNativeHeaderOptions } from "@/hooks/useNativeHeaderOptions";

// The library is one modal sheet; topics, Saved and Recent push inside it like iOS Settings.
export default function DuasLayout() {
  const { theme } = useTheme();
  const header = useNativeHeaderOptions("Duas", { large: false, titleSize: 26 });

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
      <Stack.Screen name="[list]" />
    </Stack>
  );
}
