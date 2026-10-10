import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("utils/auth/http");

let store;
let http;
let loginHandler;
let logoutHandler;
let directory;
let originalHash;
const password = randomBytes(24).toString("base64url");
const username = "owner";
const originalEnv = { ...process.env };
function req(method = "GET", path = "/api/services", token, extras = {}) {
  return {
    method,
    url: path,
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...(token ? { cookie: `${http.cookieName()}=${token}` } : {}),
      ...extras,
    },
  };
}
function response() {
  const res = { headers: {}, code: 200 };
  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  res.status = (code) => {
    res.code = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  res.end = () => res;
  return res;
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "homepage-auth-"));
  process.env.HOMEPAGE_AUTH_DB = join(directory, "auth.sqlite");
  process.env.HOMEPAGE_AUTH_BOOTSTRAP_USERNAME = username;
  process.env.HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD = password;
  store = (await import("./store.cjs")).default;
  http = await import("./http");
  loginHandler = (await import("pages/api/auth/login")).default;
  logoutHandler = (await import("pages/api/auth/logout")).default;
  await store.initialize();
  originalHash = store.database().prepare("SELECT password_hash FROM accounts").get().password_hash;
});
beforeEach(() => {
  process.env.NODE_ENV = "development";
  process.env.PORT = "3000";
  process.env.HOMEPAGE_ALLOWED_HOSTS = "home.silasnet.win";
  process.env.HOMEPAGE_AUTH_ORIGINS = "https://home.silasnet.win";
  store.database().exec("DELETE FROM sessions; DELETE FROM attempts; UPDATE accounts SET enabled=1;");
  store.database().prepare("UPDATE accounts SET password_hash=?").run(originalHash);
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  store.database().close();
  rmSync(directory, { recursive: true, force: true });
  process.env = originalEnv;
});

describe("real persistent authentication boundary", () => {
  it("stores Argon2id hashes, timestamps and enabled state without plaintext", () => {
    const row = store.database().prepare("SELECT * FROM accounts").get();
    expect(row.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(row.password_hash).not.toContain(password);
    expect(row.created_at).toBeGreaterThan(0);
    expect(row.enabled).toBe(1);
    for (const file of readdirSync(directory))
      expect(readFileSync(join(directory, file)).includes(Buffer.from(password))).toBe(false);
  });
  it("never overwrites an existing account from bootstrap", async () => {
    process.env.HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD = randomBytes(24).toString("hex");
    await store.initialize();
    expect(store.database().prepare("SELECT password_hash FROM accounts").get().password_hash).toBe(originalHash);
    expect(store.database().prepare("SELECT COUNT(*) AS count FROM accounts").get().count).toBe(1);
  });
  it("persists sessions and throttle state across server processes", async () => {
    const loggedIn = await store.login(username, password);
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `const store=require('./src/utils/auth/store.cjs');
      console.log(JSON.stringify({valid:!!store.session(process.env.TEST_SESSION),attempts:store.database().prepare('SELECT count FROM attempts WHERE key=?').get('global').count}));`,
      ],
      { cwd: process.cwd(), env: { ...process.env, TEST_SESSION: loggedIn.token }, encoding: "utf8" },
    );
    expect(child.status).toBe(0);
    expect(JSON.parse(child.stdout.trim())).toEqual({ valid: true, attempts: 1 });
  });
  it("stays closed without bootstrap values and cannot overwrite accounts on restart", () => {
    const script = `const store=require('./src/utils/auth/store.cjs');
      store.initialize().then(()=>console.log(JSON.stringify({count:store.database().prepare('SELECT COUNT(*) AS count FROM accounts').get().count,
      owner:!!store.database().prepare('SELECT id FROM accounts WHERE username=?').get('owner')})));`;
    const existing = spawnSync(process.execPath, ["-e", script], { cwd: process.cwd(), encoding: "utf8",
      env: { ...process.env, HOMEPAGE_AUTH_BOOTSTRAP_USERNAME: "replacement-user", HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD: randomBytes(24).toString("hex") } });
    expect(existing.status).toBe(0);
    expect(JSON.parse(existing.stdout.trim())).toEqual({ count: 1, owner: true });
    const empty = spawnSync(process.execPath, ["-e", script], { cwd: process.cwd(), encoding: "utf8",
      env: { ...process.env, HOMEPAGE_AUTH_DB: join(directory, "empty.sqlite"), HOMEPAGE_AUTH_BOOTSTRAP_USERNAME: "", HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD: "" } });
    expect(empty.status).toBe(0);
    expect(JSON.parse(empty.stdout.trim())).toEqual({ count: 0, owner: false });
  });
  it("rejects anonymous API requests before executing sensitive code", async () => {
    process.env.HOMEPAGE_AUTH_ENABLED = "false"; // Legacy switch cannot disable this boundary.
    const sensitive = vi.fn(() => {
      throw new Error("Private server data");
    });
    const res = response();
    await http.withAuth(sensitive)(req(), res);
    expect(res.code).toBe(401);
    expect(res.body).toEqual({ error: "Authentication required" });
    expect(sensitive).not.toHaveBeenCalled();
  });
  it("redirects anonymous dashboard requests without reading config", () => {
    expect(http.requirePageSession({ req: req("GET", "/"), res: response() })).toEqual({
      redirect: { destination: "/auth/signin", permanent: false },
    });
  });
  it("correct login creates a server session and secure production cookie", async () => {
    process.env.NODE_ENV = "production";
    const request = req("POST", "/api/auth/login", undefined, {
      host: "home.silasnet.win",
      origin: "https://home.silasnet.win",
    });
    request.body = { username, password };
    const res = response();
    await loginHandler(request, res);
    expect(res.code).toBe(200);
    const cookie = res.headers["set-cookie"];
    expect(cookie).not.toContain("Domain=");
    for (const part of ["__Host-silas-session=", "HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=43200"])
      expect(cookie).toContain(part);
    const token = cookie.split(";")[0].split("=")[1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(store.session(token).username).toBe(username);
    expect(store.database().prepare("SELECT id_hash FROM sessions").get().id_hash).not.toBe(token);
    expect(res.body).toEqual({ ok: true });
  });
  it("wrong password and unknown username return the same generic failure", async () => {
    const failures = [];
    for (const name of [username, "unknown"]) {
      const request = req("POST", "/api/auth/login");
      request.body = { username: name, password: "incorrect" };
      const res = response();
      await loginHandler(request, res);
      failures.push({ code: res.code, body: res.body });
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
    expect(failures[0]).toEqual(failures[1]);
    expect(failures[0]).toEqual({ code: 401, body: { error: "Invalid username or password" } });
  });
  it.each([
    ["", ""], [null, null], ["owner".repeat(100), password], [username, "x".repeat(1025)],
  ])("rejects empty, invalid and overlong credentials generically (%s)", async (name, inputPassword) => {
    const request = req("POST", "/api/auth/login");
    request.body = { username: name, password: inputPassword };
    const res = response();
    await loginHandler(request, res);
    expect(res.code).toBe(401);
    expect(res.body).toEqual({ error: "Invalid username or password" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
  it("does not truncate long usernames into valid 64-character accounts", async () => {
    const name = "x".repeat(64);
    const row = store.database().prepare("INSERT INTO accounts(username,password_hash,created_at) VALUES(?,?,?)").run(name, originalHash, Date.now());
    try {
      expect(await store.login(name + "suffix", password)).toEqual({ invalid: true });
      expect((await store.login(name, password)).token).toBeTruthy();
    } finally {
      store.database().prepare("DELETE FROM accounts WHERE id=?").run(row.lastInsertRowid);
    }
  });
  it("backs up committed WAL data online and restores without resurrecting sessions", async () => {
    const loggedIn = await store.login(username, password);
    const snapshot = join(directory, "snapshot.sqlite");
    const run = (args, target = process.env.HOMEPAGE_AUTH_DB) => spawnSync(process.execPath, ["scripts/auth-backup.cjs", ...args], {
      cwd: process.cwd(), env: { ...process.env, HOMEPAGE_AUTH_DB: target }, encoding: "utf8",
    });
    expect(run(["backup", snapshot]).status).toBe(0);
    const saved = new DatabaseSync(snapshot, { readOnly: true });
    expect(saved.prepare("PRAGMA journal_mode").get().journal_mode).toBe("delete");
    expect(saved.prepare("SELECT COUNT(*) AS count FROM sessions").get().count).toBe(1);
    expect(saved.prepare("SELECT password_hash FROM accounts").get().password_hash).toBe(originalHash);
    saved.close();
    expect(run(["backup", snapshot]).status).toBe(1); // Never overwrite an earlier backup.
    const restored = join(directory, "restored.sqlite");
    expect(run(["restore", snapshot], restored).status).toBe(1);
    expect(run(["restore", snapshot, "--homepage-stopped"], restored).status).toBe(0);
    const verified = new DatabaseSync(restored, { readOnly: true });
    expect(verified.prepare("SELECT password_hash FROM accounts").get().password_hash).toBe(originalHash);
    expect(verified.prepare("SELECT COUNT(*) AS count FROM sessions").get().count).toBe(0);
    expect(verified.prepare("SELECT COUNT(*) AS count FROM attempts").get().count).toBe(0);
    verified.close();
    expect(store.session(loggedIn.token)).toBeTruthy(); // Online backup does not invalidate the live session.
  });
  it("session grants dashboard/API access; logout invalidates it", async () => {
    const loggedIn = await store.login(username, password);
    const request = req("GET", "/", loggedIn.token);
    expect(http.requirePageSession({ req: request, res: response() })).toBeNull();
    const sensitive = vi.fn((r, res) => res.json({ private: true }));
    const res = response();
    await http.withAuth(sensitive)(request, res);
    expect(sensitive).toHaveBeenCalledOnce();
    const logout = response();
    await logoutHandler(req("POST", "/api/auth/logout", loggedIn.token, { "x-silas-csrf": loggedIn.csrf }), logout);
    expect(logout.code).toBe(200);
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");
    expect(store.session(loggedIn.token)).toBeNull();
    const denied = response();
    await http.withAuth(sensitive)(request, denied);
    expect(denied.code).toBe(401);
  });
  it("rotates sessions on login and rejects fixed, invalid and expired tokens", async () => {
    const first = await store.login(username, password);
    const second = await store.login(username, password, first.token);
    expect(second.token).not.toBe(first.token);
    expect(store.session(first.token)).toBeNull();
    expect(store.session("invalid")).toBeNull();
    expect(store.session(randomBytes(32).toString("hex"))).toBeNull();
    expect(store.session(second.token, second.expiresAt)).toBeNull();
    store.database().exec("UPDATE sessions SET expires_at=0");
    const res = response();
    await http.withAuth((r, response) => response.json({ private: true }))(req("GET", "/api/services", second.token), res);
    expect(res.code).toBe(401);
  });
  it("disabled accounts cannot login or use old sessions", async () => {
    const first = await store.login(username, password);
    store.database().exec("UPDATE accounts SET enabled=0");
    expect(await store.login(username, password)).toEqual({ invalid: true });
    expect(store.session(first.token)).toBeNull();
  });
  it("throttles repeated failures before hashing and recovers after expiry", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) expect(await store.login(username, "wrong", undefined, now)).toEqual({ invalid: true });
    expect((await store.login(username, password, undefined, now)).retryAfter).toBe(900);
    expect((await store.login(username, password, undefined, now + 900001)).token).toBeTruthy();
  });
  it("clears username failures after success but retains a global work budget", async () => {
    await store.login(username, "wrong");
    await store.login(username, password);
    expect(store.database().prepare("SELECT * FROM attempts WHERE key LIKE 'user:%'").all()).toHaveLength(0);
    store.database().prepare("UPDATE attempts SET count=20 WHERE key='global'").run();
    expect((await store.login("new-username", "wrong")).retryAfter).toBeGreaterThan(0);
  });
  it.each(["POST", "PUT", "PATCH", "DELETE"])("protects %s with origin AND session-bound CSRF", async (method) => {
    const loggedIn = await store.login(username, password);
    const guarded = http.withAuth((r, res) => res.json({ ok: true }));
    for (const headers of [
      {},
      { "x-silas-csrf": randomBytes(32).toString("hex") },
      { origin: "https://evil.test", "x-silas-csrf": loggedIn.csrf },
      { origin: undefined, "x-silas-csrf": loggedIn.csrf },
      { origin: "null", "x-silas-csrf": loggedIn.csrf },
      { "sec-fetch-site": "cross-site", "x-silas-csrf": loggedIn.csrf },
    ]) {
      const res = response();
      await guarded(req(method, "/api/private", loggedIn.token, headers), res);
      expect(res.code).toBe(403);
    }
    const res = response();
    await guarded(req(method, "/api/private", loggedIn.token, { "x-silas-csrf": loggedIn.csrf }), res);
    expect(res.code).toBe(200);
  });
  it("rejects malformed cookies and all anonymous methods before invoking handlers", async () => {
    const handler = vi.fn((r, res) => res.json({ private: true }));
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      for (const token of ["broken", "%00", "a".repeat(64), "b".repeat(65)]) {
        const res = response();
        await http.withAuth(handler)(req(method, "/api/services?authenticated=true", token), res);
        expect(res.code).toBe(401);
      }
    }
    expect(handler).not.toHaveBeenCalled();
  });
  it("rejects login CSRF and forwarded-header attempts to change host/origin", async () => {
    const request = req("POST", "/api/auth/login", undefined, {
      host: "evil.test",
      origin: "https://home.silasnet.win",
      "x-forwarded-host": "home.silasnet.win",
      "x-forwarded-proto": "https",
    });
    request.body = { username, password };
    const res = response();
    await loginHandler(request, res);
    expect(res.code).toBe(400);
    expect(http.sameOrigin(req("POST", "/api/auth/login", undefined, { origin: undefined }))).toBe(false);
    process.env.HOMEPAGE_ALLOWED_HOSTS = "*";
    expect(http.allowedHost(req())).toBe(false);
  });
  it("works with expected tunnel headers without trusting them", async () => {
    process.env.NODE_ENV = "production";
    const request = req("POST", "/api/auth/login", undefined, {
      host: "home.silasnet.win",
      origin: "https://home.silasnet.win",
      "x-forwarded-host": "home.silasnet.win",
      "x-forwarded-proto": "https",
      "x-forwarded-for": "192.0.2.10",
      "cf-connecting-ip": "192.0.2.10",
    });
    request.body = { username, password };
    const res = response();
    await loginHandler(request, res);
    expect(res.code).toBe(200);
    request.headers.origin = "https://evil.test";
    const rejected = response();
    await loginHandler(request, rejected);
    expect(rejected.code).toBe(403);
  });
  it("password reset revokes all sessions", async () => {
    const old = await store.login(username, password);
    const changed = randomBytes(24).toString("hex");
    await store.resetPassword(username, changed);
    expect(store.session(old.token)).toBeNull();
    expect(await store.login(username, password)).toEqual({ invalid: true });
    expect((await store.login(username, changed)).token).toBeTruthy();
  });
  it("sensitive handlers and config-reading pages contain independent guards", () => {
    const directory = join(process.cwd(), "src/pages/api");
    for (const file of readdirSync(directory, { recursive: true }).filter((name) => name.endsWith(".js"))) {
      if (["auth/login.js", "healthcheck.js"].includes(file.replaceAll("\\", "/"))) continue;
      expect(readFileSync(join(directory, file), "utf8"), file).toContain("withAuth(");
    }
    for (const file of ["index.jsx", "robots.txt.js", "site.webmanifest.jsx", "browserconfig.xml.jsx"]) {
      expect(readFileSync(join(process.cwd(), "src/pages", file), "utf8")).toContain("requirePageSession(context)");
    }
  });
});
