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

  // The wordmark stays on the system face, but sets above the type scale: the
  // scale tops out at 34 for screens that also carry UI, and this one carries
  // none, so it is set for a page rather than an interface.
  it("sets the wordmark large, in the system face", async () => {
    const { getByTestId, getByText } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-wordmark")).toBeTruthy());

    const style = StyleSheet.flatten(getByTestId("splash-wordmark").props.style);
    expect(style.fontFamily).toBeUndefined();
    expect(style.fontSize).toBeGreaterThan(34);
    expect(style.fontWeight).toBe("700");
    expect(getByText("The path to your deen")).toBeTruthy();
  });

  // Reflow would break the fixed anchor, and nothing here is read at length.
  it("pins every size against Dynamic Type", async () => {
    const { getByTestId } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-passage")).toBeTruthy());

    for (const id of ["splash-wordmark", "splash-hijri"]) {
      expect(getByTestId(id).props.allowFontScaling).toBe(false);
    }
  });

  it("shows today's passage on the first launch of the day", async () => {
    const { getByTestId, getByText } = renderSplash();

    await waitFor(() => expect(getByTestId("splash-passage")).toBeTruthy());
    expect(getByText(todaysHadith.arabic)).toBeTruthy();
    expect(getByText(todaysHadith.english)).toBeTruthy();
    expect(getByText(todaysHadith.source)).toBeTruthy();
  });

  it("marks the day as seen so the next launch is a repeat", async () => {
    renderSplash();
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(LAST_SPLASH_KEY)).toBe(new Date().toDateString()),
    );
  });

  // The passage is the first launch of the day only; every launch after that is
  // the masthead alone. Nothing stands in for it.
  it("shows the masthead alone on a repeat launch", async () => {
    await AsyncStorage.setItem(LAST_SPLASH_KEY, new Date().toDateString());

    const { getByTestId, queryByTestId, queryByText } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-wordmark")).toBeTruthy());

    expect(getByTestId("splash-hijri")).toBeTruthy();
    expect(queryByTestId("splash-passage")).toBeNull();
    expect(queryByText(todaysHadith.arabic)).toBeNull();
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
