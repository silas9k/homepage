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

    await expect(page.getByRole("dialog", { name: "Proxmox", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
