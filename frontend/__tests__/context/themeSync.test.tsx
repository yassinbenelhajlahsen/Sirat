import { render, act, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { APP_THEME_STORAGE_KEY, THEME_CHANGED_EVENT } from "@/constants/theme";

function Probe() {
  const { themeName } = useTheme();
  return <Text testID="t">{themeName}</Text>;
}

beforeEach(async () => { await AsyncStorage.clear(); });

it("reloads theme from storage when THEME_CHANGED fires (sync apply path)", async () => {
  const { getByTestId } = render(
    <ThemeProvider><Probe /></ThemeProvider>,
  );
  await act(async () => {
    await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "dark");
    DeviceEventEmitter.emit(THEME_CHANGED_EVENT);
  });
  await waitFor(() => expect(getByTestId("t").props.children).toBe("dark"));
});
