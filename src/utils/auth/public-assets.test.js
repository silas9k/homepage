import { beforeEach, expect, it, vi } from "vitest";

const { readFileSync } = vi.hoisted(() => ({ readFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  readFileSync.mockReset().mockImplementation((path) => path.endsWith(".css") ? 'src:url(../media/login.woff2)' : JSON.stringify({
    pages: { "/_app": ["static/app.js", "static/css/login.css"], "/auth/signin": ["static/login.js"], "/": ["static/private.js"] },
  }));
});
it("allows only login manifest dependencies and their fonts", async () => {
  const { publicLoginAsset } = await import("./public-assets");
  for (const path of ["/_next/static/app.js", "/_next/static/login.js", "/_next/static/css/login.css", "/_next/static/media/login.woff2"])
    expect(publicLoginAsset(path)).toBe(true);
  for (const path of ["/_next/static/private.js", "/_next/static/login.js.map", "/_next/static/media/private.png", "/api/services"])
    expect(publicLoginAsset(path)).toBe(false);
});
it("does not invent public assets when the manifest cannot be loaded", async () => {
  readFileSync.mockImplementation(() => { throw new Error("Missing manifest"); });
  const { publicLoginAsset } = await import("./public-assets");
  expect(() => publicLoginAsset("/_next/static/private.js")).toThrow();
});
