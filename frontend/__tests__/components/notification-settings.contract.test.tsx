import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Animated, Linking } from "react-native";

import NotificationSettings from "@/components/NotificationSettings";
import { type PrayerKey, PRAYERS, type SoundMode, WINDOW_PRAYERS, WINDOW_OFFSET_OPTIONS, type WindowPrayerKey } from "@/utils/notifications/constants";

const mockUseNotificationPreferences = jest.fn();
const mockUseAdhanPreview = jest.fn();

const setPrayerPreference = jest.fn(async () => {});
const updateSoundMode = jest.fn(async () => {});
const setWindowPreference = jest.fn(async () => {});
const setWindowOffset = jest.fn(async () => {});
const setFridayEnabled = jest.fn(async () => {});
const stopPreview = jest.fn(async () => {});
const handlePreviewPress = jest.fn();
const pulseHeader = jest.fn();
const pulsePrayer = jest.fn();
const pulseWindowPrayer = jest.fn();

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
    windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
    windowOffset: 15,
    fridayEnabled: true,
    setWindowPreference,
    setWindowOffset,
    setFridayEnabled,
  });

  mockUseAdhanPreview.mockReturnValue({
    previewing,
    handlePreviewPress,
    stopPreview,
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

  it("opens OS settings when the master row is pressed", async () => {
    const openSettingsSpy = jest
      .spyOn(Linking, "openSettings")
      .mockResolvedValueOnce(undefined);
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />
    );

    fireEvent.press(
      getByLabelText("Open system settings to change notifications")
    );

    await waitFor(() => expect(openSettingsSpy).toHaveBeenCalledTimes(1));
  });

  it("wires each prayer alert switch when enabled", async () => {
    configureHookMocks({ enabled: true, prefs: buildPrefs({ Fajr: true }) });
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />
    );

    PRAYERS.forEach((p) => expect(getByLabelText(`${p} alert`)).toBeTruthy());

    fireEvent(getByLabelText("Fajr alert"), "valueChange", false);

    await waitFor(() =>
      expect(setPrayerPreference).toHaveBeenCalledWith("Fajr", false)
    );
  });

  it("disables the prayer switches when notifications are off", () => {
    configureHookMocks({ enabled: false, prefs: buildPrefs({ Fajr: true }) });
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="denied" />
    );
    const fajrAlert = getByLabelText("Fajr alert", {
      includeHiddenElements: true,
    });

    expect(fajrAlert.props.disabled).toBe(true);
    expect(setPrayerPreference).not.toHaveBeenCalled();
  });

  it("updates sound mode and wires the adhan preview action", async () => {
    configureHookMocks({ soundMode: "default", enabled: true });
    const { getByLabelText, queryByLabelText, rerender } = render(
      <NotificationSettings notifStatus="granted" />
    );

    // The preview action only appears on the selected Adhan row.
    expect(queryByLabelText("Preview Adhan")).toBeNull();

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

  it("renders the window reminders group with switches and the offset control", () => {
    const { getByText, getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />,
    );

    expect(getByText("WINDOW REMINDERS")).toBeTruthy();
    WINDOW_PRAYERS.forEach((p) => {
      expect(getByLabelText(`${p} window reminder`)).toBeTruthy();
    });
    WINDOW_OFFSET_OPTIONS.forEach((n) => {
      expect(getByLabelText(`${n} minutes before`)).toBeTruthy();
    });
  });

  it("wires the window prayer switch when enabled", async () => {
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />,
    );

    fireEvent(getByLabelText("Asr window reminder"), "valueChange", true);

    await waitFor(() =>
      expect(setWindowPreference).toHaveBeenCalledWith("Asr", true),
    );
  });

  it("wires the window offset selection when enabled", async () => {
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />,
    );

    fireEvent.press(getByLabelText("30 minutes before"));

    await waitFor(() => expect(setWindowOffset).toHaveBeenCalledWith(30));
  });

  it("renders the Friday reminder as a row under the prayer alerts and wires it", async () => {
    const { queryByText, getByLabelText } = render(
      <NotificationSettings notifStatus="granted" />,
    );

    expect(queryByText("FRIDAY REMINDER")).toBeNull();
    const toggle = getByLabelText("Friday reminder");
    expect(toggle.props.value).toBe(true);

    fireEvent(toggle, "valueChange", false);

    await waitFor(() => expect(setFridayEnabled).toHaveBeenCalledWith(false));
  });

  it("disables the Friday reminder switch when notifications are off", () => {
    configureHookMocks({ enabled: false });
    const { getByLabelText } = render(
      <NotificationSettings notifStatus="denied" />,
    );

    expect(
      getByLabelText("Friday reminder", { includeHiddenElements: true }).props
        .disabled,
    ).toBe(true);
  });

  it("explains the Friday reminder in a footer without a section header", () => {
    const { getByText } = render(<NotificationSettings notifStatus="granted" />);
    expect(
      getByText("A notification before Dhuhr every Friday to remind you to read Surah Al-Kahf."),
    ).toBeTruthy();
  });

  it("has no suhoor reminder", () => {
    const { queryByLabelText } = render(<NotificationSettings notifStatus="granted" />);
    expect(queryByLabelText("Suhoor reminder")).toBeNull();
  });
});
