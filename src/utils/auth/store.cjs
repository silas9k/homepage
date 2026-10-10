// Node-only persistent account/session store. Never import from a client component.
const { createHash, randomBytes } = require("node:crypto");
const { mkdirSync, chmodSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { hash, verify, Algorithm } = require("@node-rs/argon2");

const PASSWORD_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
const SESSION_MS = 12 * 60 * 60 * 1000;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
let db;
let bootstrap;
let dummyHash;

function database() {
  if (db) return db;
  const path = resolve(process.env.HOMEPAGE_AUTH_DB || "data/auth/auth.sqlite");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);`);
  return db;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 14 || Buffer.byteLength(password) > 1024) {
    throw new Error("Use a password of at least 14 characters and at most 1024 bytes.");
  }
}

async function initialize() {
  if (!bootstrap)
    bootstrap = (async () => {
      const connection = database();
      if (connection.prepare("SELECT COUNT(*) AS count FROM accounts").get().count) return;
      const username = normalize(process.env.HOMEPAGE_AUTH_BOOTSTRAP_USERNAME);
      const password = process.env.HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD;
      if (!username && !password) return; // Fail closed until a local account is provisioned.
      if (!/^[a-z0-9_.-]{1,64}$/.test(username)) throw new Error("Invalid bootstrap username.");
      validatePassword(password);
      const passwordHash = await hash(password, PASSWORD_OPTIONS);
      // Atomic first-account insertion also protects against simultaneous worker startup.
      connection
        .prepare(
          `INSERT INTO accounts (username,password_hash,created_at)
      SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM accounts)`,
        )
        .run(username, passwordHash, Date.now());
    })().catch((error) => {
      bootstrap = undefined;
      throw error;
    });
  await bootstrap;
}

function session(token, now = Date.now()) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    database()
      .prepare(
        `SELECT s.*, a.username FROM sessions s JOIN accounts a ON a.id=s.account_id
    WHERE s.id_hash=? AND s.expires_at>? AND a.enabled=1`,
      )
      .get(digest(token), now) || null
  );
}

function revoke(token) {
  if (typeof token === "string") database().prepare("DELETE FROM sessions WHERE id_hash=?").run(digest(token));
}

// A global budget cannot be evaded using invented usernames or spoofed proxy IPs.
// Username budgets and the global budget persist across restarts. Windows expire automatically.
function reserveAttempt(username, now) {
  const connection = database();
  connection.exec("BEGIN IMMEDIATE");
  try {
    connection.prepare("DELETE FROM attempts WHERE expires_at<=?").run(now);
    connection.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
    const budgets = [
      { key: "global", limit: 20, duration: 60000 },
      { key: `user:${digest(username)}`, limit: 5, duration: 15 * 60000 },
    ];
    for (const budget of budgets) {
      const row = connection.prepare("SELECT * FROM attempts WHERE key=?").get(budget.key);
      if (row && row.count >= budget.limit) {
        connection.exec("COMMIT");
        return Math.max(1, Math.ceil((row.expires_at - now) / 1000));
      }
    }
    for (const budget of budgets)
      connection
        .prepare(
          `INSERT INTO attempts VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=count+1`,
        )
        .run(budget.key, now + budget.duration);
    connection.exec("COMMIT");
    return 0;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

async function login(usernameInput, password, oldToken, now = Date.now()) {
  await initialize();
  const normalized = normalize(usernameInput);
  const validUsername = typeof usernameInput === "string" && usernameInput.length <= 64 && /^[a-z0-9_.-]{1,64}$/.test(normalized);
  // Reject overlong input rather than turning it into a different valid account.
  const username = validUsername ? normalized : "";
  const retryAfter = reserveAttempt(username, now);
  if (retryAfter) return { retryAfter };
  const account = database().prepare("SELECT * FROM accounts WHERE username=?").get(username);
  dummyHash ||= hash(randomBytes(32).toString("hex"), PASSWORD_OPTIONS);
  // Wait for the same first-use initialization for known and unknown usernames.
  // Otherwise the first unknown account pays an extra sequential hash latency.
  const fallbackHash = await dummyHash;
  const passwordHash = account?.password_hash || fallbackHash;
  // Always verify a hash, including unknown and disabled accounts.
  const validInput = validUsername && typeof password === "string" && password.length > 0 && Buffer.byteLength(password) <= 1024;
  const valid = await verify(passwordHash, validInput ? password : "invalid");
  if (!validInput || !valid || !account?.enabled) return { invalid: true };
  const token = randomBytes(32).toString("hex");
  const csrf = randomBytes(32).toString("hex");
  const connection = database();
  connection.exec("BEGIN IMMEDIATE");
  try {
    // Recheck enabled state after asynchronous password verification.
    if (
      !connection
        .prepare("SELECT id FROM accounts WHERE id=? AND enabled=1 AND password_hash=?")
        .get(account.id, passwordHash)
    ) {
      connection.exec("COMMIT");
      return { invalid: true };
    }
    revoke(oldToken);
    connection
      .prepare("INSERT INTO sessions VALUES (?,?,?,?,?)")
      .run(digest(token), account.id, csrf, now, now + SESSION_MS);
    connection.prepare("DELETE FROM attempts WHERE key=?").run(`user:${digest(username)}`);
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
  return { token, csrf, expiresAt: now + SESSION_MS };
}

async function resetPassword(username, password) {
  validatePassword(password);
  const passwordHash = await hash(password, PASSWORD_OPTIONS);
  const connection = database();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const account = connection.prepare("SELECT id FROM accounts WHERE username=?").get(normalize(username));
    if (!account) throw new Error("Account not found.");
    connection.prepare("UPDATE accounts SET password_hash=? WHERE id=?").run(passwordHash, account.id);
    connection.prepare("DELETE FROM sessions WHERE account_id=?").run(account.id);
    connection.prepare("DELETE FROM attempts WHERE key=?").run(`user:${digest(normalize(username))}`);
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

module.exports = { database, initialize, login, session, revoke, resetPassword, PASSWORD_OPTIONS, SESSION_MS };
