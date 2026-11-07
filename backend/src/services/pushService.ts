import { prisma } from "../db/prisma.js";

export const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$/;

export async function savePushToken(token: string, appVersion: string | null): Promise<void> {
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, appVersion },
    update: { lastSeenAt: new Date(), appVersion },
  });
}

export async function deletePushToken(token: string): Promise<void> {
  await prisma.pushToken.deleteMany({ where: { token } });
}

export async function listPushTokens(): Promise<string[]> {
  const rows = await prisma.pushToken.findMany({ select: { token: true } });
  return rows.map((r) => r.token);
}

export async function deletePushTokens(tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;
  const { count } = await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
  return count;
}
