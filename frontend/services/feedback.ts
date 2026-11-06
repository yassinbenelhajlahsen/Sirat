import { apiPost } from "@/services/apiClient";
import { getAuthToken } from "@/services/auth/authToken";
import { getDiagnosticsReport } from "@/services/diagnostics";
import { readMasterEnabled } from "@/services/notifications/storage";
import { getEffectivePrayerSettings } from "@/services/prayerSettings";

export type FeedbackType = "feedback" | "bug";

// Prayer-time bugs usually hinge on these. Never the city or coordinates.
async function settingsContext() {
  try {
    const [settings, notificationsOn] = await Promise.all([
      getEffectivePrayerSettings(),
      readMasterEnabled(),
    ]);
    return { prayerMethod: settings.method, locationOn: settings.useLocation, notificationsOn };
  } catch {
    return {};
  }
}

export async function submitFeedback(input: {
  type: FeedbackType;
  message: string;
  email: string;
  signedIn: boolean;
}): Promise<void> {
  const email = input.email.trim();
  let diagnostics: object | undefined;
  if (input.type === "bug") {
    const report = await getDiagnosticsReport();
    // Compared with the server's "User" line: a mismatch shows where a session was lost.
    const auth = { signedIn: input.signedIn, hasAuthToken: Boolean(await getAuthToken()) };
    diagnostics = { ...report, context: { ...report.context, ...auth, ...(await settingsContext()) } };
  }
  await apiPost("/api/feedback", {
    type: input.type,
    message: input.message.trim(),
    ...(email ? { email } : {}),
    ...(diagnostics ? { diagnostics } : {}),
  });
}
