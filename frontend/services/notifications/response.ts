import * as Notifications from "expo-notifications";
import { router } from "expo-router";

// The listener and the cold-start lookup can both deliver the same tap.
let lastHandledId: string | null = null;

// Notifications that carry a `data.url` open that route; all others just open the app.
export function routeNotificationResponse(
  response: Notifications.NotificationResponse | null,
) {
  if (!response) return;
  const { identifier, content } = response.notification.request;
  if (identifier === lastHandledId) return;
  lastHandledId = identifier;
  // Otherwise an OTA reload would replay this tap as a cold start.
  Notifications.clearLastNotificationResponse();

  const url = (content.data as { url?: unknown } | null)?.url;
  if (typeof url === "string" && url.startsWith("/")) {
    router.navigate(url as never);
  }
}
