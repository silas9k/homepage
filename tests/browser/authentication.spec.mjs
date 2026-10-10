import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { expect, test } from "@playwright/test";

const origin = "https://localhost:3443";
const credentials = () => JSON.parse(readFileSync("artifacts/auth-e2e/runtime.json", "utf8"));

test("production privacy, login, cookies, CSRF, proxy headers and logout", async ({ page, request }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const anonymous = await request.get("/", { maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers().location).toBe(origin + "/auth/signin");
  expect(await anonymous.text()).not.toMatch(/Proxmox|192\.168\.|debian-docker/);
  expect(anonymous.headers()["cache-control"]).toContain("no-store");
  for (const path of ["/dashboard", "/servers/debian-docker", "/browserconfig.xml", "/site.webmanifest", "/robots.txt", "/silas/icons/silassend.svg", "/_next/image?url=%2Fsilas%2Ficons%2Fsilassend.svg&w=64&q=75", "/data/auth/auth.sqlite"]) {
    for (const method of ["GET", "HEAD", "POST"]) {
      const denied = await request.fetch(path, { method, maxRedirects: 0 });
      expect(denied.status(), `${method} ${path}`).toBe(307);
      expect(await denied.text()).not.toMatch(/Proxmox|192\.168\.|debian-docker|argon2id/);
    }
  }
  const bypass = await request.get("/api/services", { headers: { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" } });
  expect(bypass.status()).toBe(401);
  for (const file of readdirSync("src/pages/api", { recursive: true }).filter((file) => file.endsWith(".js"))) {
    let path =
      "/api/" +
      file
        .replaceAll("\\", "/")
        .replace(/\.js$/, "")
        .replace(/\/index$/, "")
        .replace(/\[\.\.\.[^\]]+\]/g, "test")
        .replace(/\[[^\]]+\]/g, "test");
    if (["/api/auth/login", "/api/healthcheck"].includes(path)) continue;
    for (const method of ["GET", "HEAD", "POST"]) {
      const response = await request.fetch(path + "?authenticated=true&token=invalid", { method, maxRedirects: 0 });
      expect(response.status(), `${method} ${path}`).toBe(401);
      if (method === "HEAD") expect(await response.text()).toBe("");
      else expect(await response.json()).toEqual({ error: "Authentication required" });
    }
  }
  for (const path of [
    "/api/silas/hosts",
    "/api/config/custom.css",
    "/api/config/custom.js",
    "/api/healthcheck/private",
  ]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  const health = await request.get("/api/healthcheck");
  expect(await health.text()).toBe("up");
  expect((await request.get("/silas/favicon.svg")).status()).toBe(200);
  const loginPage = await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/signin$/);
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  const html = await page.content();
  expect(html).not.toMatch(/Proxmox|debian-docker|HOMEPAGE_VAR|bootstrap_password/i);
  expect(html).not.toContain("/api/config/custom.css");
  expect(loginPage.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(loginPage.headers()["content-security-policy"]).not.toContain("unsafe-eval");
  expect(loginPage.headers()["content-security-policy"]).not.toMatch(/(?:^|\s)https:(?:\s|;|$)/);
  expect(loginPage.headers()["x-content-type-options"]).toBe("nosniff");
  expect(loginPage.headers()["referrer-policy"]).toBe("no-referrer");
  expect(loginPage.headers()["permissions-policy"]).toContain("camera=()");
  expect(loginPage.headers()["x-frame-options"]).toBe("DENY");
  await page.screenshot({ path: "artifacts/auth-e2e/login-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/auth-e2e/login-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const account = credentials();
  const missingOrigin = await request.post("/api/auth/login", { data: account });
  expect(missingOrigin.status()).toBe(403);
  const form = await request.post("/api/auth/login", { form: account, headers: { Origin: origin } });
  expect(form.status()).toBe(403);
  const failures = [];
  for (const username of [account.username, "unknown-account"]) {
    const response = await request.post("/api/auth/login", {
      data: { username, password: "incorrect" },
      headers: { Origin: origin },
    });
    failures.push({ status: response.status(), body: await response.json() });
  }
  expect(failures[0]).toEqual(failures[1]);
  expect(failures[0].status).toBe(401);
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dienste suchen" })).toBeVisible();
  await expect(page).toHaveURL(origin + "/");
  const cookies = await page.context().cookies();
  const cookie = cookies.find((cookie) => cookie.name === "__Host-silas-session");
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
  expect(cookie.domain).toBe("localhost");
  expect(await page.context().cookies("https://unrelated.silasnet.win")).toEqual([]);
  expect(cookie.value).toMatch(/^[a-f0-9]{64}$/);
  expect(await page.evaluate(() => document.cookie)).not.toContain("silas-session");
  const privateResponse = await page.request.get("/api/services");
  expect(privateResponse.status()).toBe(200);
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
  const session = await (await page.request.get("/api/auth/session")).json();
  const noCsrf = await page.request.post("/api/revalidate", { headers: { Origin: origin } });
  expect(noCsrf.status()).toBe(403);
  const crossSite = await page.request.post("/api/revalidate", {
    headers: { Origin: "https://evil.test", "x-silas-csrf": session.csrf },
  });
  expect(crossSite.status()).toBe(403);
  for (const headers of [
    { Origin: origin, "x-silas-csrf": "a".repeat(64) },
    { Origin: "null", "x-silas-csrf": session.csrf },
    { "x-silas-csrf": session.csrf },
  ]) expect((await page.request.post("/api/revalidate", { headers })).status()).toBe(403);
  const csrf = await page.request.post("/api/revalidate", {
    headers: { Origin: origin, "x-silas-csrf": session.csrf },
  });
  expect(csrf.status()).toBe(200);
  const buildId = await page.evaluate(() => JSON.parse(document.getElementById("__NEXT_DATA__").textContent).buildId);
  const dataResponse = await request.get(`/_next/data/${buildId}/index.json`, { maxRedirects: 0 });
  expect([307, 401]).toContain(dataResponse.status());
  expect(await dataResponse.text()).not.toMatch(/Proxmox|debian-docker/);
  const manifest = JSON.parse(readFileSync(".next/build-manifest.json", "utf8"));
  const loginFiles = new Set([...manifest.pages["/_app"], ...manifest.pages["/auth/signin"]]);
  for (const file of manifest.pages["/"].filter((file) => !loginFiles.has(file))) {
    const denied = await request.get(`/_next/${file}`, { maxRedirects: 0 });
    expect(denied.status(), `${file}: ${JSON.stringify(denied.headers())}`).toBe(307);
    expect(await denied.text()).not.toMatch(/debian-docker|raspi/);
  }
  const badHost = await request.get("/api/services", {
    headers: { Host: "evil.test", "x-forwarded-host": "localhost:3443" },
  });
  expect(badHost.status()).toBe(400);
  for (const host of ["home.silasnet.win", "debian-docker.tail277de6.ts.net"]) {
    const proxyLogin = await request.post("/api/auth/login", {
      data: account,
      headers: {
        Host: host,
        Origin: `https://${host}`,
        "x-forwarded-host": "evil.test",
        "x-forwarded-proto": "http",
        "cf-connecting-ip": "192.0.2.10",
      },
    });
    expect(proxyLogin.status()).toBe(200);
    expect(proxyLogin.headers()["set-cookie"]).toContain("Secure");
  }
  const previousCookie = `${cookie.name}=${cookie.value}`;
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/signin$/);
  expect((await page.request.get("/api/services")).status()).toBe(401);
  expect((await request.get("/api/services", { headers: { Cookie: previousCookie } })).status()).toBe(401);
  const storage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  expect(JSON.stringify(storage)).not.toContain(cookie.value);
  expect(errors.filter((text) => /content security|violates|refused to|uncaught/i.test(text))).toEqual([]);
  for (let i = 0; i < 5; i++) {
    expect(
      (
        await request.post("/api/auth/login", {
          data: { username: "throttle-check", password: "wrong" },
          headers: { Origin: origin, "x-forwarded-for": `192.0.2.${i + 1}` },
        })
      ).status(),
    ).toBe(401);
  }
  const throttled = await request.post("/api/auth/login", {
    data: { username: "throttle-check", password: "wrong" },
    headers: { Origin: origin, "x-forwarded-for": "192.0.2.99" },
  });
  expect(throttled.status()).toBe(429);
  expect(Number(throttled.headers()["retry-after"])).toBeGreaterThan(0);
  expect(await throttled.json()).toEqual({ error: "Invalid username or password" });
});

test("production malformed credentials, fixation, expiration, disabled account and throttle recovery", async ({ request }) => {
  const account = credentials();
  // This test also provisions its own store when run in isolation.
  expect((await request.post("/api/auth/login", { data: account, headers: { Origin: origin } })).status()).toBe(200);
  const db = new DatabaseSync(account.databasePath);
  const login = (data = account, extra = {}) => request.post("/api/auth/login", { data, headers: { Origin: origin, ...extra } });
  db.exec("DELETE FROM attempts");
  try {
    for (const data of [
      { username: "", password: "" },
      { username: "x".repeat(1000), password: account.password },
      { username: account.username, password: "x".repeat(1025) },
    ]) {
      const response = await login(data);
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: "Invalid username or password" });
    }
    db.exec("DELETE FROM attempts");
    const fixed = "b".repeat(64);
    const first = await login(account, { Cookie: `__Host-silas-session=${fixed}` });
    expect(first.status()).toBe(200);
    const token = first.headers()["set-cookie"].split(";")[0];
    expect(token).not.toContain(fixed);
    expect(first.headers()["set-cookie"]).not.toContain("Domain=");
    for (const value of [fixed, "broken", "%00", "a".repeat(65), token.split("=")[1].slice(0, -1) + "z"]) {
      for (const method of ["GET", "HEAD", "POST"]) {
        expect((await request.fetch("/api/services?session=valid", { method, headers: { Cookie: `__Host-silas-session=${value}` } })).status()).toBe(401);
      }
    }
    const rotated = await login(account, { Cookie: token });
    expect(rotated.status()).toBe(200);
    expect(rotated.headers()["set-cookie"].split(";")[0]).not.toBe(token);
    expect((await request.get("/api/services", { headers: { Cookie: token } })).status()).toBe(401);
    const rotatedCookie = rotated.headers()["set-cookie"].split(";")[0];
    db.exec("UPDATE sessions SET expires_at=0");
    expect((await request.get("/api/services", { headers: { Cookie: rotatedCookie } })).status()).toBe(401);
    db.exec("UPDATE accounts SET enabled=0");
    const disabled = await login();
    expect(disabled.status()).toBe(401);
    expect(await disabled.json()).toEqual({ error: "Invalid username or password" });
    db.exec("UPDATE accounts SET enabled=1; DELETE FROM attempts");
    for (let i = 0; i < 5; i++) expect((await login({ username: account.username, password: "wrong" })).status()).toBe(401);
    expect((await login()).status()).toBe(429);
    // Advance only the isolated fixture's persistent window, avoiding a 15 minute wait.
    db.exec("UPDATE attempts SET expires_at=0");
    expect((await login()).status()).toBe(200);
  } finally {
    db.exec("UPDATE accounts SET enabled=1; DELETE FROM attempts");
    db.close();
  }
});
