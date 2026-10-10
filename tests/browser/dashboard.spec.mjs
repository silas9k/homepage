import { expect, test } from "./fixtures.mjs";

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
    await expect(page.locator(".service-card")).toHaveCount(20);
    await expect(page.getByRole("heading", { name: "Server", exact: true })).toBeVisible();
    await expect(page.locator('.service[data-name="Paperless-ngx"]')).toHaveCount(0);
    await expect(page.locator('.service[data-name="Resticwatch"]')).toHaveCount(1);
    await expect(page.locator('.service[data-name="Playit.gg"]')).toHaveCount(0);
    await expect(page.locator('.service[data-name="Homebridge · Papa"]')).toContainText("PAPA");
    await expect(page.locator('.service[data-name="Homebridge · Mama"]')).toContainText("MAMA");
    await expect(page.locator('.service[data-name="Homebridge · Papa"]')).toContainText("Geplant");
    await expect(page.locator('.service[data-name="Backup-HDD · Raspberry Pi"]')).toContainText("Geplant");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator("#inner_wrapper").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await expect
      .poll(() =>
        page.locator(".service-icon img").evaluateAll((images) => {
          const visible = images.filter((image) => {
            const bounds = image.getBoundingClientRect();
            return bounds.bottom > 0 && bounds.top < window.innerHeight;
          });
          return visible.length > 0 && visible.every((image) => image.complete && image.naturalWidth > 0);
        }),
      )
      .toBe(true);
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
      page.getByRole("dialog", { name: "Dienste suchen" }).getByRole("option", { name: /Tailscale/ }),
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

test("configured service cards launch their configured destination from the complete card", async ({
  page,
  request,
  baseURL,
}) => {
  const groups = await (await request.get("/api/services")).json();
  const destinations = Object.fromEntries(
    [
      "Nextcloud",
      "Memos",
      "Vaultwarden",
      "SilasSend",
      "Immich",
      "Jellyfin",
      "Home Assistant",
      "Homebridge · Papa",
      "Homebridge · Mama",
      "Crafty Controller",
      "Portainer",
      "Tailscale",
      "Cloudflare Tunnel",
      "Resticwatch",
    ].map((name) => [name, `${baseURL}/launcher/${encodeURIComponent(name)}`]),
  );
  for (const group of groups) {
    for (const service of group.services) {
      if (destinations[service.name]) service.href = destinations[service.name];
    }
  }
  for (const [name, sshUrl] of [
    ["Proxmox", "ssh://silas@100.70.7.74"],
    ["debian-docker", "ssh://USER@100.76.36.117"],
    ["raspi", "ssh://silas@100.70.7.74"],
  ]) {
    const service = groups.flatMap((group) => group.services).find((item) => item.name === name);
    service.silas = { ...(service.silas ?? {}), sshUrl };
  }
  await page.route("**/api/services", (route) => route.fulfill({ json: groups }));
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("link", { name: "SSH öffnen" })).toHaveCount(0);

  for (const name of ["debian-docker", "raspi"]) {
    const card = page.locator(`.service[data-name="${name}"] .service-card`);
    await expect(card).not.toHaveAttribute("data-href");
    await expect(card).toHaveAttribute("tabindex", "0");
    await card.click({ position: { x: 12, y: 12 } });
    await expect(page.getByRole("dialog", { name: name })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: name })).not.toBeVisible();
  }

  for (const [name, url] of Object.entries(destinations)) {
    const card = page.locator(`.service[data-name="${name}"] .service-card`);
    await expect(card).toHaveAttribute("data-href", url);
    await expect(card).toHaveAttribute("tabindex", "0");
    const popup = page.waitForEvent("popup");
    await card.click({ position: { x: 12, y: 12 } });
    const launched = await popup;
    await expect.poll(() => launched.url()).toBe(url);
    await launched.close();
  }

  const keyboardCard = page.locator('.service[data-name="Memos"] .service-card');
  await keyboardCard.focus();
  const enterPopup = page.waitForEvent("popup");
  await keyboardCard.press("Enter");
  const launchedEnter = await enterPopup;
  await expect.poll(() => launchedEnter.url()).toBe(destinations.Memos);
  await launchedEnter.close();
  const spacePopup = page.waitForEvent("popup");
  await keyboardCard.press("Space");
  const launchedSpace = await spacePopup;
  await expect.poll(() => launchedSpace.url()).toBe(destinations.Memos);
  await launchedSpace.close();
});
