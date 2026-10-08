import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const standalone = resolve(root, ".next/standalone");
if (!existsSync(resolve(standalone, "server.js"))) {
  throw new Error("Run pnpm build before starting the production preview.");
}
cpSync(resolve(root, "public"), resolve(standalone, "public"), { recursive: true });
cpSync(resolve(root, ".next/static"), resolve(standalone, ".next/static"), { recursive: true });
const port = process.env.PORT || "3100";
const child = spawn(process.execPath, [resolve(standalone, "server.js")], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: "127.0.0.1",
    HOMEPAGE_CONFIG_DIR: resolve(root, "config"),
    HOMEPAGE_ALLOWED_HOSTS: process.env.HOMEPAGE_ALLOWED_HOSTS || `localhost:${port},127.0.0.1:${port}`,
    LOG_TARGETS: "stdout",
    NEXT_TELEMETRY_DISABLED: "1",
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
