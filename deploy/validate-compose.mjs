import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Uses only example values. Never loads a user's .env or starts a container.
const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "artifacts/compose-validation");
mkdirSync(output, { recursive: true });
const executable = process.env.COMPOSE_BINARY || "docker";
const prefix = process.env.COMPOSE_BINARY ? [] : ["compose"];
function config(files, envFile, extra = []) {
  const result = spawnSync(
    executable,
    [
      ...prefix,
      "--env-file",
      envFile,
      ...files.flatMap((file) => ["-f", file]),
      ...extra,
      "config",
      "--format",
      "json",
    ],
    { cwd: root, encoding: "utf8", env: { ...process.env, HOMEPAGE_ENV_FILE: ".env.example" } },
  );
  if (result.status !== 0) throw new Error(`Compose validation failed: ${result.stderr || result.error}`);
  return JSON.parse(result.stdout);
}
function privatePorts(stack) {
  for (const service of Object.values(stack.services)) {
    for (const port of service.ports ?? []) assert.equal(port.host_ip, "127.0.0.1");
    for (const volume of service.volumes ?? []) assert.ok(!volume.source?.includes("docker.sock"));
    assert.ok(service.restart, "Every application should have a restart policy");
  }
}
const homepage = config(["compose.yaml"], ".env.example");
privatePorts(homepage);
assert.equal(homepage.services.homepage.volumes[0].read_only, true);
for (const app of ["memos", "homebridge", "crafty", "palmr"]) {
  const stack = config(
    [`deploy/${app}/compose.yaml`],
    `deploy/${app}/.env.example`,
    app === "palmr" ? ["--profile", "evaluation"] : [],
  );
  privatePorts(stack);
  for (const service of Object.values(stack.services)) {
    for (const volume of service.volumes ?? []) {
      assert.ok(volume.source.replaceAll("\\", "/").includes("/srv/"), "Application data must be outside Git");
    }
  }
  if (app === "palmr") assert.deepEqual(stack.services.palmr.profiles, ["evaluation"]);
  if (app === "homebridge") assert.equal(stack.services.homebridge.network_mode, "host");
  console.log(`${app}: valid; private port defaults, persistent data, no socket`);
}
const response = await fetch("https://github.com/immich-app/immich/releases/download/v3.3.1/docker-compose.yml");
assert.ok(response.ok, "Official Immich release must be downloadable");
const bytes = Buffer.from(await response.arrayBuffer());
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  "2601c893aa3217d3c0c7284c23aaa1699aac75b533c84c0315fd16b7889fd552",
);
writeFileSync(resolve(output, "compose.yaml"), bytes);
copyFileSync(resolve(root, "deploy/immich/.env.example"), resolve(output, ".env"));
const immich = config(
  [resolve(output, "compose.yaml"), "deploy/immich/compose.private.yaml"],
  "deploy/immich/.env.example",
);
privatePorts(immich);
assert.equal(immich.services["immich-server"].ports.length, 1, "Override must remove the public upstream binding");
assert.equal(immich.services.database.ports, undefined);
assert.equal(immich.services.redis.ports, undefined);
console.log("Immich: verified official release + private override; DB/Redis not published");
console.log("All six stacks validated. Container execution requires Docker Engine on Debian.");
