import { readFileSync } from "node:fs";

import { test as base, expect } from "@playwright/test";

let cachedState;
export const test = base.extend({
  storageState: async ({ playwright, baseURL }, provideState) => {
    if (!cachedState) {
      const credentials = JSON.parse(readFileSync("artifacts/auth-e2e/runtime.json", "utf8"));
      const request = await playwright.request.newContext({ baseURL, ignoreHTTPSErrors: true });
      const response = await request.post("/api/auth/login", { data: credentials, headers: { Origin: baseURL } });
      expect(response.status()).toBe(200);
      cachedState = await request.storageState();
      await request.dispose();
    }
    await provideState(cachedState);
  },
});
export { expect };
