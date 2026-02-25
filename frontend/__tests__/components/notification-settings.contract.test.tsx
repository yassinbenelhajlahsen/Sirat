import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Animated, Linking } from "react-native";

import NotificationSettings from "@/components/NotificationSettings";
import { type PrayerKey, PRAYERS, type SoundMode } from "@/utils/notifications/constants";

const mockUseNotificationPreferences = jest.fn();
const mockUseAdhanPreview = jest.fn();
const mockUseNotificationPanelAnimation = jest.fn();
const mockUseNotificationSegmentLayout = jest.fn();

const setPrayerPreference = jest.fn(async () => {});
const updateSoundMode = jest.fn(async () => {});
const stopPreview = jest.fn(async () => {});
const handlePreviewPress = jest.fn();
const pulseHeader = jest.fn();
const pulsePrayer = jest.fn();

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
  };
});

jest.mock("@/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: (...args: unknown[]) =>
    mockUseNotificationPreferences(...args),
}));

jest.mock("@/hooks/useAdhanPreview", () => ({
  useAdhanPreview: (...args: unknown[]) => mockUseAdhanPreview(...args),
}));

jest.mock("@/hooks/useNotificationPanelAnimation", () => ({
  useNotificationPanelAnimation: (...args: unknown[]) =>
    mockUseNotificationPanelAnimation(...args),
}));

jest.mock("@/hooks/useNotificationSegmentLayout", () => ({
  useNotificationSegmentLayout: (...args: unknown[]) =>
    mockUseNotificationSegmentLayout(...args),
}));

const buildPrefs = (overrides: Partial<Record<PrayerKey, boolean>> = {}) =>
  ({
    Fajr: true,
    Sunrise: true,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true,
    ...overrides,
  }) as Record<PrayerKey, boolean>;

const buildBellAnimations = (): Record<PrayerKey, Animated.Value> =>
  PRAYERS.reduce((acc, prayer) => {
    acc[prayer] = new Animated.Value(1);
    return acc;
  }, {} as Record<PrayerKey, Animated.Value>);

function configureHookMocks({
  loaded = true,
  enabled = true,
  prefs = buildPrefs(),
  soundMode = "default" as SoundMode,
  previewing = null as SoundMode | null,
} = {}) {
  mockUseNotificationPreferences.mockReturnValue({
    loaded,
    enabled,
    prefs,
    soundMode,
    setPrayerPreference,
    updateSoundMode,
  });

  mockUseAdhanPreview.mockReturnValue({
    previewing,
    handlePreviewPress,
    stopPreview,
  });

  const soundIndicator = new Animated.Value(soundMode === "adhan" ? 1 : 0);

  mockUseNotificationPanelAnimation.mockReturnValue({
    headerScale: new Animated.Value(1),
    bellAnimations: buildBellAnimations(),
    contentOpacity: new Animated.Value(enabled ? 1 : 0),
    contentTranslateY: new Animated.Value(0),
    contentMaxHeight: new Animated.Value(enabled ? 820 : 0),
    contentScale: new Animated.Value(1),
    soundIndicator,
    pulseHeader,
    pulsePrayer,
  });

  mockUseNotificationSegmentLayout.mockReturnValue({
    segmentWidth: 120,
    indicatorTranslateX: new Animated.Value(soundMode === "adhan" ? 130 : 0),
    onLayout: jest.fn(),
  });
}

describe("NotificationSettings contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureHookMocks();
  });

  it("renders loading state while notification preferences are hydrating", () => {
    configureHookMocks({ loaded: false });

    const { getByText, queryByLabelText } = render(
      <NotificationSettings notifStatus="granted" />
    );

    expect(getByText("Notifications")).toBeTruthy();
    expect(queryByLabelText("Open system settings to change notifications")).toBeNull();
  });

  it("opens OS settings when the master toggle is used", async () => {
    const openSettingsSpy = jest
      .spyOn(Linking, "openSettings")
      .mockResolvedValueOnce(undefined);
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />
    );

    fireEvent(
      getByLabelText("Open system settings to change notifications"),
      "valueChange",
      false
    );

    expect(pulseHeader).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(openSettingsSpy).toHaveBeenCalledTimes(1));
  });

  it("wires prayer row toggle callback when enabled", async () => {
    configureHookMocks({ enabled: true, prefs: buildPrefs({ Fajr: true }) });
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />
    );

    fireEvent.press(getByLabelText("Fajr alert"));

    expect(pulsePrayer).toHaveBeenCalledWith("Fajr");
    await waitFor(() =>
      expect(setPrayerPreference).toHaveBeenCalledWith("Fajr", false)
    );
  });

  it("keeps prayer rows non-interactive when notifications are disabled", () => {
    configureHookMocks({ enabled: false, prefs: buildPrefs({ Fajr: true }) });
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="denied" />
    );
    const fajrAlert = getByLabelText("Fajr alert", {
      includeHiddenElements: true,
    });

    fireEvent.press(fajrAlert);

    expect(fajrAlert.props.accessibilityState.disabled).toBe(true);
    expect(pulsePrayer).not.toHaveBeenCalled();
    expect(setPrayerPreference).not.toHaveBeenCalled();
  });

  it("updates sound mode and wires the adhan preview control", async () => {
    configureHookMocks({ soundMode: "default", enabled: true });
    const { getByLabelText, rerender } = render(
      <NotificationSettings notifStatus="granted" />
    );

    fireEvent.press(getByLabelText("System default sound option"));
    expect(stopPreview).not.toHaveBeenCalled();
    expect(updateSoundMode).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText("Adhan sound option"));
    await waitFor(() => expect(stopPreview).toHaveBeenCalledTimes(1));
    expect(updateSoundMode).toHaveBeenCalledWith("adhan");

    configureHookMocks({ soundMode: "adhan", previewing: "adhan", enabled: true });
    rerender(<NotificationSettings notifStatus="granted" />);

    fireEvent.press(getByLabelText("Preview Adhan"));

    expect(handlePreviewPress).toHaveBeenCalledWith("adhan");
  });
});
