// scripts/reset-project.js
const { execSync } = require("child_process");

function run(cmd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit" });
}

try {
  console.log("🚀 Resetting project...");

  run("rm -rf node_modules package-lock.json");
  run("npm cache clean --force");

  // Force install React 18 deps
  run(
    "npm install react@18.2.0 react-dom@18.2.0 @types/react@18.2.66 --save --legacy-peer-deps"
  );

  // Reinstall project deps
  run("npm install --legacy-peer-deps");

  // Sync with Expo’s required versions
  run("npx expo install --npm -- --legacy-peer-deps");

  console.log("\n✅ Project reset complete! Try `npx expo start -c`.");
} catch (err) {
  console.error("❌ Reset failed:", err.message);
  process.exit(1);
}
