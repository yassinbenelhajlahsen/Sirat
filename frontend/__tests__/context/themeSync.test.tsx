import { render, act, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { themeSetting } from "@/services/syncedSettings";

function Probe() {
  const { themeName } = useTheme();
  return <Text testID="t">{themeName}</Text>;
}

beforeEach(async () => { await AsyncStorage.clear(); });

it("follows a theme synced in from another device", async () => {
  const { getByTestId } = render(
    <ThemeProvider><Probe /></ThemeProvider>,
  );
  await act(async () => {
    await themeSetting.applyRemote("dark");
  });
  await waitFor(() => expect(getByTestId("t").props.children).toBe("dark"));
});
