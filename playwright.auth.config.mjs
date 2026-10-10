import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "artifacts/auth-browser-results",
  workers: 1,
  timeout: 60000,
  globalTeardown: "./scripts/auth-e2e-teardown.mjs",
  use: { baseURL: "https://localhost:3443", browserName: "chromium", ignoreHTTPSErrors: true, locale: "de-DE" },
  webServer: {
    command: "node scripts/auth-e2e-server.mjs",
    url: "https://localhost:3443/api/healthcheck",
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
