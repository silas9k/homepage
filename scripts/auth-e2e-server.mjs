// Ephemeral HTTPS production validation fixture; never used for deployment.
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { resolve } from "node:path";

const root = process.cwd();
const directory = resolve(root, "artifacts/auth-e2e");
mkdirSync(directory, { recursive: true });
const runId = randomBytes(8).toString("hex");
const password = randomBytes(32).toString("base64url");
const username = "e2e-owner";
const databasePath = resolve(directory, `${runId}.sqlite`);
const openssl =
  process.env.OPENSSL_BINARY || (process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl");
const key = resolve(directory, `${runId}.key`);
const certificate = resolve(directory, `${runId}.crt`);
execFileSync(
  openssl,
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    certificate,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ],
  { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
);
writeFileSync(resolve(directory, "runtime.json"), JSON.stringify({ username, password, databasePath }), { mode: 0o600 });
const standalone = resolve(root, ".next/standalone");
if (!existsSync(resolve(standalone, "server.js"))) throw new Error("Run pnpm build first.");
cpSync(resolve(root, "public"), resolve(standalone, "public"), { recursive: true });
cpSync(resolve(root, ".next/static"), resolve(standalone, ".next/static"), { recursive: true });
const child = spawn(process.execPath, [resolve(standalone, "server.js")], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: "3198",
    LOG_TARGETS: "stdout",
    NEXT_TELEMETRY_DISABLED: "1",
    HOMEPAGE_CONFIG_DIR: resolve(root, "config"),
    HOMEPAGE_ALLOWED_HOSTS: "localhost:3443,127.0.0.1:3198,home.silasnet.win,debian-docker.tail277de6.ts.net",
    HOMEPAGE_AUTH_ORIGINS: "https://localhost:3443,https://home.silasnet.win,https://debian-docker.tail277de6.ts.net",
    HOMEPAGE_AUTH_DB: databasePath,
    HOMEPAGE_AUTH_BOOTSTRAP_USERNAME: username,
    HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD: password,
  },
});
const server = https.createServer({ key: readFileSync(key), cert: readFileSync(certificate) }, (req, res) => {
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 3198,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-for": "127.0.0.1" },
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(503);
    res.end();
  });
  req.pipe(upstream);
});
server.listen(3443, "127.0.0.1");
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  server.close();
  child.kill();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, close);
child.on("exit", (code) => {
  server.close();
  process.exit(code ?? 0);
});
