import type { FeedbackReport, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export type FeedbackInput = {
  type: "feedback" | "bug";
  message: string;
  email: string | null;
  userId: string | null;
  appVersion: string | null;
  platform: string | null;
  device: string | null;
  diagnostics: unknown | null;
};

export function createFeedbackReport(input: FeedbackInput): Promise<FeedbackReport> {
  const { diagnostics, ...rest } = input;
  return prisma.feedbackReport.create({
    data: {
      ...rest,
      ...(diagnostics != null ? { diagnostics: diagnostics as Prisma.InputJsonValue } : {}),
    },
  });
}
