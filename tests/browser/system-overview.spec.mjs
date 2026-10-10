import { expect, test } from "@playwright/test";

async function overviewFixture(page, request, { raspiError = false } = {}) {
  const groups = await (await request.get("/api/services")).json();
  for (const service of groups.find((group) => group.name === "Server").services) {
    if (["Proxmox", "debian-docker", "raspi"].includes(service.name)) {
      service.silas.beszelSystemId = service.name === "Proxmox" ? "proxmox" : service.name;
      service.widgets = [];
    }
  }
  const management = groups.find((group) => group.name === "Verwaltung & Netzwerk");
  management.services.find((service) => service.name === "Beszel").widgets = [
    { type: "beszel", service_name: "Beszel", service_group: management.name },
  ];
  const portainer = management.services.find((service) => service.name === "Portainer");
  const cloudflare = management.services.find((service) => service.name === "Cloudflare Tunnel");
  portainer.widgets = [{ type: "portainer", index: 0, service_group: management.name, service_name: portainer.name }];
  cloudflare.widgets = [
    { type: "cloudflared", index: 0, service_group: management.name, service_name: cloudflare.name },
  ];
  await page.route("**/api/services", (route) => route.fulfill({ json: groups }));
  await page.route("**/api/services/proxy?*", (route) => {
    const requestUrl = new URL(route.request().url());
    const endpoint = requestUrl.searchParams.get("endpoint");
    const service = requestUrl.searchParams.get("service");
    const data =
      endpoint === "docker/containers"
        ? [{ State: "running" }, { State: "running" }, { State: "exited" }]
        : endpoint === "cfd_tunnel"
          ? { result: { status: "healthy" } }
          : endpoint === "systems"
            ? {
                items: [
                  {
                    id: "debian-docker",
                    name: "debian-docker",
                    status: "up",
                    info: { cpu: 1.6, mp: 29.9, dp: 22.6, u: 286320, dt: 42.4 },
                  },
                  {
                    id: "raspi",
                    name: "raspi",
                    status: raspiError ? "down" : "up",
                    info: { cpu: 1.6, mp: 29.9, dp: 22.6, u: 286320 },
                  },
                  { id: "proxmox", name: "proxmox", status: "up", info: {} },
                ],
              }
            : { error: "Unexpected browser fixture endpoint" };
    return route.fulfill({ json: data });
  });
}

for (const [width, height] of [
  [1920, 1080],
  [768, 1024],
  [390, 844],
  [320, 640],
]) {
  test(`system overview and server health at ${width}x${height}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height });
    await overviewFixture(page, request);
    await page.goto("/", { waitUntil: "networkidle" });

    const overview = page.getByLabel("Systemübersicht");
    await expect(overview).toContainText("3 / 3 Hosts");
    await expect(overview).toContainText("2 Container aktiv");
    await expect(overview).toContainText("Tunnel Healthy");
    const overviewStyles = await overview.evaluate((element) => {
      const item = element.querySelector(".silas-overview-item");
      const dot = element.querySelector(".silas-overview-dot");
      return {
        display: getComputedStyle(element).display,
        borderTopWidth: getComputedStyle(element).borderTopWidth,
        backgroundColor: getComputedStyle(element).backgroundColor,
        itemDisplay: getComputedStyle(item).display,
        dotWidth: getComputedStyle(dot).width,
        dotHeight: getComputedStyle(dot).height,
      };
    });
    expect(overviewStyles.display).toBe(width <= 600 ? "grid" : "flex");
    expect(overviewStyles.borderTopWidth).toBe("1px");
    expect(overviewStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(overviewStyles.itemDisplay).toBe("flex");
    expect(overviewStyles.dotWidth).toBe("7px");
    expect(overviewStyles.dotHeight).toBe("7px");
    expect(await overview.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1920) await page.screenshot({ path: "artifacts/system-overview-1920x1080.png" });

    const card = page.locator('.service[data-name="debian-docker"] .service-card');
    await card.click({ position: { x: 12, y: 80 } });
    const dialog = page.getByRole("dialog", { name: "debian-docker" });
    await expect(dialog.getByText("42,4 °C")).toBeVisible();
    await expect(dialog.getByText("3 Tage 7 Std.")).toBeVisible();
    await expect(dialog.getByText("1,6 %")).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: "artifacts/server-health-390x844.png" });
  });
}

test("system overview gives a textual host warning when one Beszel host is down", async ({ page, request }) => {
  await overviewFixture(page, request, { raspiError: true });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByLabel("Hosts: 2 / 3 Hosts")).toBeVisible();
});
