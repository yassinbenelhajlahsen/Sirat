import type { ContentReport, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export type ReportInput = {
  kind: string;
  input: string;
  output: Record<string, unknown>;
  userId: string | null;
  appVersion: string | null;
};

export function createContentReport(report: ReportInput): Promise<ContentReport> {
  return prisma.contentReport.create({
    data: { ...report, output: report.output as Prisma.InputJsonValue },
  });
}
