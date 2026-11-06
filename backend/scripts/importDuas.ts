// Usage: npm run import:duas [-- <path to duas.json>]   (default: ../frontend/assets/data/duas.json)
// Loads the app's verified dua list into duas. Safe to re-run; run it whenever that file changes.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/db/prisma.js";
import { mapDuasFile } from "../src/services/chat/sourceImport.js";

const file = process.argv[2] ?? "../frontend/assets/data/duas.json";
const rows = mapDuasFile(JSON.parse(readFileSync(file, "utf8")));

await prisma.$transaction(rows.map((data) => prisma.chatDua.upsert({ where: { id: data.id }, create: data, update: data })));

// A dua removed from the file must disappear from chat too.
await prisma.chatDua.deleteMany({ where: { id: { notIn: rows.map((r) => r.id) } } });

console.log(`duas: ${await prisma.chatDua.count()} rows`);
await prisma.$disconnect();
