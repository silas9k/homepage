import { expect, test } from "@playwright/test";

for (const [width, height] of [
  [1920, 1080],
  [390, 844],
  [320, 640],
]) {
  test(`service search at ${width}x${height}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height });
    const groups = await (await request.get("/api/services")).json();
    const proxmox = groups.flatMap((group) => group.services ?? []).find((service) => service.name === "Proxmox");
    proxmox.silas = {
      ...(proxmox.silas ?? {}),
      details: {
        lanIp: "192.0.2.20",
        sshCommand: "ssh root@192.0.2.20",
        links: [{ label: "Proxmox öffnen", href: "https://proxmox.example.test" }],
      },
    };
    await page.route("**/api/services", (route) => route.fulfill({ json: groups }));
    await page.goto("/", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /Dienste suchen/ }).click();
    const dialog = page.getByRole("dialog", { name: "Dienste suchen" });
    const input = dialog.getByRole("textbox", { name: "Dienste suchen" });
    await expect(input).toBeFocused();
    await input.fill("proxmox");
    await expect(dialog.getByRole("option", { name: /Proxmox/ })).toBeVisible();
    await input.press("Enter");

    await expect(page.getByRole("dialog", { name: "Dienste suchen" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Proxmox", exact: true })).toBeVisible();
    expect(await page.locator('[role="dialog"], [aria-modal="true"]').count()).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Proxmox", exact: true })).toHaveCount(0);
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog", { name: "Dienste suchen" })).toBeVisible();
  });
}

test("modal services activate alone from the palette", async ({ page, request }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const groups = await (await request.get("/api/services")).json();
  const services = groups.flatMap((group) => group.services ?? []);
  for (const name of ["debian-docker", "raspi"]) {
    const service = services.find((item) => item.name === name);
    service.silas = {
      ...(service.silas ?? {}),
      details: { host: name, lanIp: "192.0.2.30", sshCommand: `ssh user@${name}` },
    };
  }
  await page.route("**/api/services", (route) => route.fulfill({ json: groups }));
  await page.goto("/", { waitUntil: "networkidle" });

  for (const name of ["debian-docker", "raspi"]) {
    await page.keyboard.press("Control+K");
    const palette = page.getByRole("dialog", { name: "Dienste suchen" });
    await palette.getByRole("textbox").fill(name);
    await palette.getByRole("textbox").press("Enter");
    await expect(palette).toHaveCount(0);
    await expect(page.getByRole("dialog", { name, exact: true })).toBeVisible();
    expect(await page.locator('[role="dialog"], [aria-modal="true"]').count()).toBe(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name, exact: true })).toHaveCount(0);
  }
});
