import { ActionSheetIOS, Alert, Platform } from "react-native";

import type { AppTheme } from "@/constants/theme";

export type ActionMenuOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Params = {
  title: string;
  message?: string;
  options: ActionMenuOption[];
  theme: AppTheme;
};

/**
 * Contextual menu for a row: a native action sheet on iOS, an Alert elsewhere.
 * Gives every secondary action a full-size target instead of a 24pt icon.
 *
 * NEEDS NATIVE BUILD: `userInterfaceStyle` is the only reason this sheet follows
 * the in-app theme. Alert (the fallback here and every other Alert in the app)
 * stays dark until app.config.js `ios.userInterfaceStyle` becomes "automatic".
 */
export function showActionMenu({ title, message, options, theme }: Params): void {
  if (Platform.OS === "ios") {
    const labels = [...options.map((o) => o.label), "Cancel"];
    const destructive = options
      .map((o, i) => (o.destructive ? i : -1))
      .filter((i) => i >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: destructive.length > 0 ? destructive : undefined,
        userInterfaceStyle: theme.name === "light" ? "light" : "dark",
      },
      (index) => {
        options[index]?.onPress();
      },
    );
    return;
  }

  Alert.alert(title, message, [
    ...options.map((o) => ({
      text: o.label,
      style: o.destructive ? ("destructive" as const) : ("default" as const),
      onPress: o.onPress,
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}
