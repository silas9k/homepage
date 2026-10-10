import { beforeEach, expect, it, vi } from "vitest";
import { proxy, config } from "./proxy";
import { publicLoginAsset } from "./utils/auth/public-assets";

const { authenticated } = vi.hoisted(() => ({ authenticated: vi.fn() }));
vi.mock("utils/auth/http", async (importOriginal) => ({ ...(await importOriginal()), authenticated }));
vi.mock("utils/auth/public-assets", () => ({ publicLoginAsset: vi.fn() }));

function req(path, host = "localhost:3000", extras = {}) {
  return { nextUrl: { pathname: path }, headers: new Headers({ host, ...extras }) };
}
beforeEach(() => {
  process.env.PORT = "3000";
  process.env.HOMEPAGE_ALLOWED_HOSTS = "home.silasnet.win";
  authenticated.mockReset().mockReturnValue(null);
  publicLoginAsset.mockReset().mockImplementation((path) => path === "/_next/static/chunks/login.js");
});
it("redirects anonymous dashboard requests and denies APIs", () => {
  expect(config.matcher).toEqual([{ source: "/:path*", locale: false }]);
  expect(proxy(req("/")).headers.get("location")).toBe("http://localhost:3000/auth/signin");
  expect(proxy(req("/api/services")).status).toBe(401);
});
it.each([
  "/api/mcp",
  "/api/config/custom.css",
  "/api/config/custom.js",
  "/api/auth/providers",
  "/api/healthcheck/private",
  "/api/silas/hosts",
])("does not exempt %s", (path) => {
  expect(proxy(req(path)).status).toBe(401);
});
it.each(["/auth/signin", "/api/auth/login", "/api/healthcheck", "/silas/favicon.svg", "/_next/static/chunks/login.js"])(
  "allows login dependency %s",
  (path) => {
    expect(proxy(req(path)).headers.get("x-middleware-next")).toBe("1");
  },
);
it("allows session requests and sets private cache and browser protection headers", () => {
  authenticated.mockReturnValue({ username: "owner" });
  const response = proxy(req("/"));
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  expect(response.headers.get("content-security-policy")).toContain("'nonce-");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
it("fails closed on wildcard hosts and ignores forwarded hosts", () => {
  expect(proxy(req("/", "evil.test", { "x-forwarded-host": "home.silasnet.win" })).status).toBe(400);
  process.env.HOMEPAGE_ALLOWED_HOSTS = "*";
  expect(proxy(req("/")).status).toBe(400);
});
it("denies service icon/config/data routes anonymously", () => {
  for (const path of ["/silas/icons/proxmox.svg", "/site.webmanifest", "/_next/data/build/index.json", "/_next/static/chunks/pages/index-private.js"]) {
    expect(proxy(req(path)).headers.get("location")).toBe("http://localhost:3000/auth/signin");
  }
});
it("fails closed on store errors without exposing details", () => {
  authenticated.mockImplementation(() => {
    throw new Error("secret SQLite path");
  });
  expect(proxy(req("/api/services")).status).toBe(503);
});
