import { execSync } from "node:child_process";

try {
  execSync("tsc", { stdio: "inherit" });
  console.log("Build completed successfully.");
} catch (err) {
  console.error("Build failed:", err);
  process.exit(1);
}
