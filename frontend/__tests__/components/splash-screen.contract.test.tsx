import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { StyleSheet } from "react-native";

import SplashScreen from "@/components/SplashScreen";
import { ThemeProvider } from "@/context/ThemeContext";
import hadiths from "@/assets/data/hadiths.json";
import { darkTheme, lightTheme } from "@/constants/theme";

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  getLastKnownPositionAsync: jest.fn(async () => null),
}));

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
  // The launch check gates both the masthead and leaving the splash, so a location
  // call that never answers must not hold it: the sunset lookup gives up after 300ms.
  it("finishes the launch check when the location never answers", async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValueOnce({
      status: "granted",
    } as Location.LocationPermissionResponse);
    jest.mocked(Location.getLastKnownPositionAsync).mockReturnValueOnce(new Promise(() => {}));

    const { getByTestId } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-passage")).toBeTruthy());
  });

  it("sets the wordmark large, in the system face", async () => {
    const { getByTestId, getByText } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-wordmark")).toBeTruthy());

    const style = StyleSheet.flatten(getByTestId("splash-wordmark").props.style);
    expect(style.fontFamily).toBeUndefined();
    expect(style.fontSize).toBeGreaterThan(34);
    expect(style.fontWeight).toBe("700");
  });

  it("drops the tagline", async () => {
    const { getByTestId, queryByText } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-wordmark")).toBeTruthy());
    expect(queryByText("The path to your deen")).toBeNull();
  });

  it("sets the emblem lettering in gold Amiri", async () => {
    const { getByTestId, getByText } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-emblem-text")).toBeTruthy());

    const style = StyleSheet.flatten(getByTestId("splash-emblem-text").props.style);
    expect(getByText("صراط")).toBeTruthy();
    expect(style.fontFamily).toBe("Amiri");
  });

  it("sets the hadith Arabic in Amiri so the splash uses one Arabic face", async () => {
    const { getByTestId, getByText } = renderSplash();
    await waitFor(() => expect(getByTestId("splash-passage")).toBeTruthy());

    const style = StyleSheet.flatten(getByText(todaysHadith.arabic).props.style);
    expect(style.fontFamily).toBe("Amiri");
  });

  // Day 31 is the longest hadith; at the full size it ran into the wordmark.
  it("sets a long hadith smaller than a short one", async () => {
    const getDate = jest.spyOn(Date.prototype, "getDate");
    const sizeOnDay = async (day: number) => {
      await AsyncStorage.clear();
      getDate.mockReturnValue(day);
      const view = renderSplash();
      const arabic = (hadiths as { day: number; arabic: string }[]).find((h) => h.day === day)!
        .arabic;
      await waitFor(() => expect(view.getByText(arabic)).toBeTruthy());
      const { fontSize } = StyleSheet.flatten(view.getByText(arabic).props.style);
      view.unmount();
      return fontSize as number;
    };

    const short = await sizeOnDay(15);
    const long = await sizeOnDay(31);
    getDate.mockRestore();

    expect(long).toBeLessThan(short);
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

  it("focuses the horizon glow under the passage and softens it on a repeat launch", async () => {
    const first = renderSplash();
    await waitFor(() => expect(first.getByTestId("splash-passage")).toBeTruthy());
    expect(first.getByTestId("splash-glow-focused")).toBeTruthy();
    expect(first.queryByTestId("splash-glow-soft")).toBeNull();
    first.unmount();

    await AsyncStorage.setItem(LAST_SPLASH_KEY, new Date().toDateString());
    const repeat = renderSplash();
    await waitFor(() => expect(repeat.getByTestId("splash-wordmark")).toBeTruthy());
    await waitFor(() => expect(repeat.getByTestId("splash-glow-soft")).toBeTruthy());
    expect(repeat.queryByTestId("splash-glow-focused")).toBeNull();
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

  // Gold on the cream Light sky is under 2:1, unreadable at text size. The gold
  // stays on the dark skies, where it reads.
  it("sets the Hijri date and hadith source in gold on the dark sky only", async () => {
    const hijriColor = async () => {
      const view = renderSplash();
      await waitFor(() => expect(view.getByTestId("splash-passage")).toBeTruthy());
      const hijri = StyleSheet.flatten(view.getByTestId("splash-hijri").props.style).color;
      const source = StyleSheet.flatten(view.getByText(todaysHadith.source).props.style).color;
      view.unmount();
      return { hijri, source };
    };

    await AsyncStorage.setItem("app_theme_v1", "dark");
    expect(await hijriColor()).toEqual({
      hijri: darkTheme.colors.accent,
      source: darkTheme.colors.accent,
    });

    await AsyncStorage.clear();
    await AsyncStorage.setItem("app_theme_v1", "light");
    const light = await hijriColor();
    expect(light.hijri).not.toBe(lightTheme.colors.accent);
    expect(light.source).not.toBe(lightTheme.colors.accent);
  });

  it("dissolves out and hands off to the app once ready", async () => {
    await AsyncStorage.setItem(LAST_SPLASH_KEY, new Date().toDateString());
    const onFinished = jest.fn();
    renderSplash({ ready: true, onFinished });

    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1), { timeout: 5000 });
  }, 10000);
});
