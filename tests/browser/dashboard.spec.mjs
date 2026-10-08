import { expect, test } from "@playwright/test";

for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [768, 1024],
  [390, 844],
]) {
  test(`dashboard at ${width}x${height}`, async ({ page }) => {
    const errors = [];
    const widgetRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/api/services/proxy")) widgetRequests.push(request.url());
    });
    await page.setViewportSize({ width, height });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".silas-wordmark")).toHaveText("silasnet.");
    await expect(page.locator(".service-card")).toHaveCount(19);
    await expect(page.getByRole("heading", { name: "Server", exact: true })).toBeVisible();
    await expect(page.locator('.service[data-name="Paperless-ngx"]')).toHaveCount(0);
    await expect(page.locator('.service[data-name="Resticwatch"]')).toHaveCount(1);
    await expect(page.locator('.service[data-name="Playit.gg"]')).toHaveCount(0);
    await expect(page.locator('.service[data-name="Homebridge · Standort A"]')).toContainText("HOME A");
    await expect(page.locator('.service[data-name="Homebridge · Standort B"]')).toContainText("HOME B");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator("#inner_wrapper").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(
      await page
        .locator(".service-icon img")
        .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
    ).toBe(true);
    expect(widgetRequests).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `artifacts/dashboard-${width}x${height}.png`, fullPage: width < 1000 });
    if (width === 1920) {
      await page.screenshot({
        path: "artifacts/dashboard-full-page.png",
        fullPage: true,
        style: "html, body, #page_wrapper, #inner_wrapper { height: auto !important; overflow: visible !important; }",
      });
    }
    const backup = page.locator('.service[data-name="Backup-HDD · Raspberry Pi"]');
    await backup.scrollIntoViewIfNeeded();
    await expect(backup).toBeInViewport();
    await page.screenshot({ path: `artifacts/dashboard-bottom-${width}x${height}.png` });
    const search = page.getByRole("button", { name: "Dienste suchen" });
    await search.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Dienste suchen" })).toBeFocused();
    await page.getByRole("textbox", { name: "Dienste suchen" }).fill("Tailscale");
    await expect(
      page.getByRole("dialog", { name: "Dienste suchen" }).getByRole("button", { name: /Tailscale/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("textbox", { name: "Dienste suchen" })).not.toBeVisible();
    await expect(search).toBeFocused();
  });
}

test("health, config privacy and host validation", async ({ request }) => {
  expect((await request.get("/api/healthcheck")).ok()).toBe(true);
  const response = await request.get("/api/services");
  const text = await response.text();
  expect(text).not.toContain("HOMEPAGE_VAR");
  expect(text).not.toMatch(/"(password|key|username)":/);
  const rejected = await request.get("/api/services", { headers: { Host: "untrusted.example" } });
  expect(rejected.status()).toBe(400);
  for (const path of ["/api/services/proxy.test", "/api/mcp/index.test"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

for (const fail of [false, true]) {
  test(`configured Glances ${fail ? "error" : "zero and mount"} state (test fixtures only)`, async ({
    page,
    request,
  }) => {
    const groups = await (await request.get("/api/services")).json();
    const host = groups
      .find((group) => group.name === "Server")
      .services.find((service) => service.name === "debian-docker");
    host.widgets = [
      {
        type: "glances",
        metric: "summary:/",
        version: 4,
        index: 0,
        silas: true,
        service_group: "Server",
        service_name: "debian-docker",
      },
    ];
    await page.route("**/api/services", (route) => route.fulfill({ json: groups }));
    await page.route("**/api/services/proxy?*", (route) => {
      const endpoint = new URL(route.request().url()).searchParams.get("endpoint");
      const json = fail
        ? { error: { message: "test-secret-never-render" } }
        : endpoint.endsWith("cpu")
          ? { total: 0 }
          : endpoint.endsWith("mem")
            ? { percent: 20 }
            : [
                { mnt_point: "/boot", percent: 90 },
                { mnt_point: "/", percent: 30 },
              ];
      return route.fulfill({ json });
    });
    await page.goto("/", { waitUntil: "networkidle" });
    const card = page.locator('.service[data-name="debian-docker"]');
    if (fail) {
      await expect(card).toContainText("Daten nicht verfügbar");
      await expect(card).not.toContainText("test-secret-never-render");
    } else {
      await expect(card).toContainText("0 %");
      await expect(card).toContainText("30 %");
      await expect(card).not.toContainText("90 %");
    }
  });
}
