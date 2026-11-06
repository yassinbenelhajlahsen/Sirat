import type { FeedbackReport } from "@prisma/client";
import { ENV } from "../config/env.js";

const SUPPORT_ADDRESS = "support@sirat.dev";
const SEND_TIMEOUT_MS = 5000;

function subjectFor(report: FeedbackReport): string {
  const label = report.type === "bug" ? "Bug" : "Feedback";
  const preview = report.message.replace(/\s+/g, " ").trim().slice(0, 60);
  return `[Sirat ${label}] ${preview}`;
}

type LogEntry = { at?: unknown; kind?: unknown; message?: unknown; stack?: unknown };

function entryText({ at, kind, message, stack }: LogEntry): string {
  const when = typeof at === "number" && !Number.isNaN(new Date(at).getTime()) ? new Date(at).toISOString() : "?";
  const line = `${when} [${String(kind)}] ${String(message)}`;
  return typeof stack === "string" ? `${line}\n    ${stack.replace(/\n/g, "\n    ")}` : line;
}

function diagnosticsText(diagnostics: unknown): string {
  const { context, entries } = (diagnostics ?? {}) as { context?: unknown; entries?: unknown };
  // The shape comes from the client, so anything unexpected is shown raw, never dropped.
  if (typeof context !== "object" || context === null || !Array.isArray(entries)) {
    return JSON.stringify(diagnostics, null, 2);
  }
  const contextLines = Object.entries(context).map(([key, value]) => `${key}: ${String(value)}`);
  return [...contextLines, "", "Log (oldest first):", ...entries.map((e) => entryText(e as LogEntry))].join("\n");
}

// Plain text only, so user-written content can never inject markup.
function textFor(report: FeedbackReport): string {
  const lines = [
    `Type: ${report.type}`,
    "",
    report.message,
    "",
    `Reply to: ${report.email ?? "none"}`,
    `User: ${report.userId ?? "signed out"}`,
    `App version: ${report.appVersion ?? "unknown"}`,
    `Platform: ${report.platform ?? "-"}`,
    `Device: ${report.device ?? "-"}`,
    `Report id: ${report.id}`,
    `Created: ${report.createdAt.toISOString()}`,
  ];
  if (report.diagnostics != null) {
    lines.push("", "Diagnostics:", diagnosticsText(report.diagnostics));
  }
  return lines.join("\n");
}

export async function sendFeedbackEmail(report: FeedbackReport): Promise<void> {
  if (!ENV.RESEND_API_KEY) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${ENV.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Sirat Support <${SUPPORT_ADDRESS}>`,
      to: [SUPPORT_ADDRESS],
      ...(report.email ? { reply_to: report.email } : {}),
      subject: subjectFor(report),
      text: textFor(report),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}
