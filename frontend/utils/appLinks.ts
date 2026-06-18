// frontend/utils/appLinks.ts
import Constants from "expo-constants";
import { Linking, Share } from "react-native";

const APP_STORE_ID = "6753838183";

export const APP_LINKS = {
  website: "https://sirat.dev",
  privacy: "https://sirat.dev/privacy",
  feedbackEmail: "yassinbenelhajlahsen@gmail.com",
  appStoreUrl: `https://apps.apple.com/app/id${APP_STORE_ID}`,
  reviewUrl: `itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
} as const;

async function open(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // best-effort: never surface a link failure to the UI
  }
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "—";
}

export function openWebsite(): Promise<void> {
  return open(APP_LINKS.website);
}

export function openPrivacy(): Promise<void> {
  return open(APP_LINKS.privacy);
}

export async function shareApp(): Promise<void> {
  try {
    await Share.share({
      message:
        "Sirat — your companion for prayer, Qur'an, qibla and more. https://sirat.dev",
      url: APP_LINKS.appStoreUrl,
    });
  } catch {
    // user cancelled or share unavailable — ignore
  }
}

export function sendFeedback(): Promise<void> {
  const subject = encodeURIComponent("Sirat Feedback");
  return open(`mailto:${APP_LINKS.feedbackEmail}?subject=${subject}`);
}

export function rateApp(): Promise<void> {
  return open(APP_LINKS.reviewUrl);
}
