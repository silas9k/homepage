// Local operator CLI. Online backup uses SQLite's backup API, not a live-file copy.
const { openSync, closeSync, chmodSync, mkdirSync, existsSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { DatabaseSync, backup } = require("node:sqlite");

function inspect(db) {
  if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Database integrity check failed.");
  db.prepare("SELECT id, username, password_hash, enabled, created_at FROM accounts LIMIT 1").get();
  db.prepare("SELECT id_hash, account_id, csrf, created_at, expires_at FROM sessions LIMIT 1").get();
  db.prepare("SELECT key, count, expires_at FROM attempts LIMIT 1").get();
}

async function main() {
  const [action, file, confirmation] = process.argv.slice(2);
  if (!file || !["backup", "restore"].includes(action)) throw new Error("Usage: node scripts/auth-backup.cjs backup FILE | restore FILE --homepage-stopped");
  const live = resolve(process.env.HOMEPAGE_AUTH_DB || "data/auth/auth.sqlite");
  const snapshot = resolve(file);
  if (live === snapshot) throw new Error("Backup path must differ from the live database.");
  if (action === "restore" && confirmation !== "--homepage-stopped") throw new Error("Stop Homepage and back up the current database before restoring; pass --homepage-stopped.");
  const source = new DatabaseSync(action === "backup" ? live : snapshot, { readOnly: true });
  try {
    inspect(source);
    const target = action === "backup" ? snapshot : live;
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    // Reserve a private backup file exclusively: never overwrite an old backup.
    if (action === "backup" || !existsSync(target)) closeSync(openSync(target, "wx", 0o600));
    chmodSync(target, 0o600);
    await backup(source, target);
    const result = new DatabaseSync(target);
    try {
      // Portable standalone snapshots need no writable WAL/SHM sidecars when
      // mounted read-only during restore. The live store keeps its WAL mode.
      if (action === "backup") result.exec("PRAGMA journal_mode=DELETE");
      inspect(result);
      if (action === "restore") {
        // A historical backup must never resurrect previously revoked sessions.
        result.exec("BEGIN IMMEDIATE; DELETE FROM sessions; DELETE FROM attempts; COMMIT;");
        result.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      }
    } finally {
      result.close();
    }
    console.log(action === "backup" ? "Auth backup verified." : "Auth restore verified; all sessions invalidated.");
  } finally {
    source.close();
  }
}

main().catch(() => {
  console.error("Auth backup/restore failed. Check paths, permissions, database integrity and CLI usage locally.");
  process.exitCode = 1;
});
