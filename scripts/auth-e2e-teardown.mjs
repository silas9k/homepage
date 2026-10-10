// Only the isolated E2E store and generated fixture credentials are touched.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

export default function teardown() {
  const directory = resolve("artifacts/auth-e2e");
  const runtime = resolve(directory, "runtime.json");
  if (!existsSync(runtime)) return;
  const { databasePath } = JSON.parse(readFileSync(runtime, "utf8"));
  if (!databasePath || !resolve(databasePath).startsWith(directory + sep) || !databasePath.endsWith(".sqlite"))
    throw new Error("Invalid isolated E2E database path.");
  if (existsSync(databasePath)) {
    const db = new DatabaseSync(databasePath);
    try {
      if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'").get())
        db.exec("BEGIN IMMEDIATE; UPDATE accounts SET enabled=0; DELETE FROM sessions; DELETE FROM attempts; COMMIT;");
    } finally {
      db.close();
    }
  }
  const key = databasePath.replace(/\.sqlite$/, ".key");
  if (existsSync(key)) writeFileSync(key, "", { mode: 0o600 });
  writeFileSync(runtime, "{}", { mode: 0o600 });
}
