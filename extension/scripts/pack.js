/**
 * Pack extension for Chrome Web Store upload (no dependencies).
 * Usage: node scripts/pack.js
 */
import { mkdirSync, cpSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const staging = join(root, "dist", "staging");
const outZip = join(root, "dist", "rolebolt-extension.zip");

const COPY = ["manifest.json", "background.js", "icons", "lib", "content", "popup", "PRIVACY.md"];

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

for (const item of COPY) {
  const src = join(root, item);
  if (!existsSync(src)) {
    console.warn("Skip missing:", item);
    continue;
  }
  cpSync(src, join(staging, item), { recursive: true });
}

if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${staging}\\*' -DestinationPath '${outZip}' -Force"`,
    { stdio: "inherit" },
  );
} else {
  execSync(`cd "${staging}" && zip -r "${outZip}" .`, { stdio: "inherit" });
}

rmSync(staging, { recursive: true, force: true });
console.log("Packed →", outZip);
