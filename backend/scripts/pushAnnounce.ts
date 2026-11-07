// Usage: railway run npm run push:announce -- --title "..." --body "..." [--test | --all]
// No mode flag is a dry run. --test sends to PUSH_TEST_TOKEN only. --all sends to every device.
import "dotenv/config";
// Railway's internal URL is unreachable from a laptop; the public one works through `railway run`.
process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL || "";
const { listPushTokens, deletePushTokens, EXPO_PUSH_TOKEN } = await import("../src/services/pushService.js");
const { prisma } = await import("../src/db/prisma.js");
const { parseAnnounceArgs, databaseLabel, errorLabel, sendAnnouncement } = await import("../src/services/pushAnnounce.js");

const USAGE = 'Usage: railway run npm run push:announce -- --title "..." --body "..." [--test | --all]';

async function main(): Promise<number> {
  const args = parseAnnounceArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(args.error);
    console.error(USAGE);
    return 1;
  }

  console.log(databaseLabel(process.env.DATABASE_URL ?? ""));

  let tokens: string[] = [];
  if (args.mode === "test") {
    const testToken = process.env.PUSH_TEST_TOKEN ?? "";
    if (!EXPO_PUSH_TOKEN.test(testToken)) {
      console.error("PUSH_TEST_TOKEN is missing or not a push token");
      return 1;
    }
    tokens = [testToken];
  } else {
    tokens = await listPushTokens();
  }

  if (args.mode === "dry") {
    console.log(`Dry run: would send to ${tokens.length} devices`);
    console.log(`Title: ${args.title}`);
    console.log(`Body: ${args.body}`);
    console.log("The count can include phones that uninstalled Sirat; they are removed after a real send.");
    return 0;
  }

  const result = await sendAnnouncement(tokens, args, {
    accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  });
  // Printed before pruning so a pruning failure can never hide that the send happened.
  console.log(`Sent ${result.sent}, accepted ${result.accepted}, errors ${result.errors}`);
  try {
    console.log(`Pruned ${await deletePushTokens(result.deadTokens)}`);
  } catch (err) {
    console.log(`Pruning failed (${errorLabel(err)})`);
  }
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (err) {
  console.error(`Failed (${errorLabel(err)})`);
} finally {
  await prisma.$disconnect().catch(() => {});
}
process.exit(exitCode);
