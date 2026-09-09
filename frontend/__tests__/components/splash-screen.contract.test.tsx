import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import SplashScreen from "@/components/SplashScreen";
import { ThemeProvider } from "@/context/ThemeContext";
import hadiths from "@/assets/data/hadiths.json";

const LAST_SPLASH_KEY = "lastSplashDate";

const todaysHadith = (hadiths as { day: number; arabic: string; english: string; source: string }[])
  .find((h) => h.day === new Date().getDate())!;

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

const renderSplash = (props: Partial<React.ComponentProps<typeof SplashScreen>> = {}) =>
  render(wrap(<SplashScreen ready={false} {...props} />));

describe("SplashScreen", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  // The wordmark stays on the system face and the type scale — no bundled
  // display face, so nothing here waits on a font load.
  it("sets the wordmark on the largeTitle scale in the system face", async () => {
    const { getByTestId, getByText } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-wordmark")).toBeTruthy());

    const style = StyleSheet.flatten(getByTestId("splash-wordmark").props.style);
    expect(style.fontFamily).toBeUndefined();
    expect(style.fontSize).toBe(34);
    expect(style.fontWeight).toBe("700");
    expect(getByText("The path to your deen")).toBeTruthy();
  });

  it("shows today's passage on the first launch of the day", async () => {
    const { getByTestId, getByText, queryByText } = renderSplash();

    await waitFor(() => expect(getByTestId("splash-passage")).toBeTruthy());
    expect(getByText(todaysHadith.arabic)).toBeTruthy();
    expect(getByText(todaysHadith.english)).toBeTruthy();
    expect(getByText(todaysHadith.source)).toBeTruthy();
    // The hadith wins the slot over the standing Bismillah.
    expect(
      queryByText("In the name of God, the Most Gracious, the Most Merciful"),
    ).toBeNull();
  });

  it("marks the day as seen so the next launch is a repeat", async () => {
    renderSplash();
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(LAST_SPLASH_KEY)).toBe(new Date().toDateString()),
    );
  });

  // The passage slot is never empty: without a hadith the Bismillah stands in,
  // so the composition and the gold rule beside it are complete every launch.
  it("stands the Bismillah in for the hadith on a repeat launch", async () => {
    await AsyncStorage.setItem(LAST_SPLASH_KEY, new Date().toDateString());

    const { getByTestId, getByText, queryByText } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-wordmark")).toBeTruthy());

    expect(getByTestId("splash-passage")).toBeTruthy();
    expect(getByText("In the name of God, the Most Gracious, the Most Merciful")).toBeTruthy();
    expect(queryByText(todaysHadith.arabic)).toBeNull();
    // The Bismillah carries no attribution.
    expect(queryByText(todaysHadith.source)).toBeNull();
  });

  it("shows the Hijri date and no Gregorian date", async () => {
    const { getByTestId } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-hijri")).toBeTruthy());

    const hijri = getByTestId("splash-hijri").props.children as string;
    expect(hijri).toEqual(expect.stringMatching(/\d{4}/));

    const gregorianYear = String(new Date().getFullYear());
    expect(hijri).not.toContain(gregorianYear);
  });

  // The whole point of the fixed anchor: a repeat launch is the same screen with
  // the passage removed, so the wordmark must not shift between the two states.
  it("anchors the wordmark identically on both launch paths", async () => {
    const first = renderSplash();
    await waitFor(() => expect(first.getByTestId("splash-passage")).toBeTruthy());
    const firstLaunchTop = StyleSheet.flatten(
      first.getByTestId("splash-anchor").props.style,
    ).paddingTop;
    first.unmount();

    await AsyncStorage.setItem(LAST_SPLASH_KEY, new Date().toDateString());

    const repeat = renderSplash();
    await waitFor(() => expect(repeat.getByTestId("splash-wordmark")).toBeTruthy());
    const repeatLaunchTop = StyleSheet.flatten(
      repeat.getByTestId("splash-anchor").props.style,
    ).paddingTop;

    expect(repeatLaunchTop).toBe(firstLaunchTop);
    expect(firstLaunchTop).toBeGreaterThan(0);
  });

  it("hides the native splash only once it has a frame on screen", () => {
    const onReadyToHideNative = jest.fn();
    const { getByTestId } = renderSplash({ onReadyToHideNative });

    expect(onReadyToHideNative).not.toHaveBeenCalled();

    fireEvent(getByTestId("splash-root"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });

    expect(onReadyToHideNative).toHaveBeenCalledTimes(1);
  });
});
