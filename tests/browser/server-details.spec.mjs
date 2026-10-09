import { expect, test } from "@playwright/test";

// Synthetic UI fixtures only: no backend credentials or live service calls.
for (const [width, height] of [
  [1920, 1080],
  [768, 1024],
  [390, 844],
  [320, 640],
]) {
  test(`server details polish at ${width}x${height}`, async ({ page, request, context }) => {
    await page.setViewportSize({ width, height });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const groups = await (await request.get("/api/services")).json();
    for (const [index, name] of ["debian-docker", "raspi"].entries()) {
      const service = groups.flatMap((group) => group.services).find((item) => item.name === name);
      service.statusStyle = "dot";
      service.siteMonitor = "https://health.example.test";
      service.silas.sshUrl = "ssh://user@host.example.test";
      service.silas.site = index === 0 ? "a" : "b";
      service.silas.details = {
        lanIp: "192.0.2.10",
        tailscaleIp: "fd7a:115c:a1e0:ab12:1234:5678:90ab:cdef",
        sshCommand: "ssh user@host.example.test",
        links: (index === 0 ? ["Portainer", "Crafty Controller"] : ["Homebridge"]).map((label) => ({
          label,
          href: `http://127.0.0.1:3100/test-link/${encodeURIComponent(label)}`,
        })),
      };
      service.widgets = [
        {
          type: "glances",
          metric: "summary:/",
          version: 4,
          index: 0,
          silas: true,
          service_group: "Server",
          service_name: name,
        },
      ];
    }
    await page.route("**/api/services", (route) => route.fulfill({ json: groups }));
    await page.route("**/api/siteMonitor?*", (route) =>
      route.fulfill({ json: { status: route.request().url().includes("debian-docker") ? 200 : 503, latency: 10 } }),
    );
    await page.route("**/api/services/proxy?*", (route) => {
      const endpoint = new URL(route.request().url()).searchParams.get("endpoint");
      return route.fulfill({
        json: endpoint.endsWith("cpu")
          ? { total: 21.1 }
          : endpoint.endsWith("mem")
            ? { percent: 29.9 }
            : [{ mnt_point: "/", percent: 22.6 }],
      });
    });
    await context.route("**/test-link/**", (route) => route.fulfill({ body: "Test destination" }));
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "SSH öffnen" })).toHaveCount(0);
    for (const [index, name] of ["debian-docker", "raspi"].entries()) {
      const card = page.locator(`.service[data-name="${name}"] .service-card`);
      await expect(card.locator(".silas-site")).toHaveText(index === 0 ? "HOME A" : "HOME B");
      await expect(card.locator(".site-monitor-status > div")).toHaveClass(
        index === 0 ? /bg-emerald-500/ : /bg-rose-500/,
      );
      const aligned = await card.evaluate((element) => {
        const label = element.querySelector(".silas-site").getBoundingClientRect();
        const dot = element.querySelector(".site-monitor-status > div").getBoundingClientRect();
        return Math.abs(label.top + label.height / 2 - (dot.top + dot.height / 2)) < 1;
      });
      expect(aligned).toBe(true);
      await card.click({ position: { x: 12, y: 80 } });
      const dialog = page.getByRole("dialog", { name, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("21,1 %")).toBeVisible();
      expect(await dialog.getByText("Disk", { exact: true }).evaluate((el) => getComputedStyle(el).textTransform)).toBe(
        "none",
      );
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const before = await dialog.boundingBox();
      for (const [label, value] of [
        ["SSH-Befehl kopieren", "ssh user@host.example.test"],
        ["IP kopieren", "192.0.2.10"],
        ["LAN IP kopieren", "192.0.2.10"],
        ["Tailscale IP kopieren", "fd7a:115c:a1e0:ab12:1234:5678:90ab:cdef"],
      ]) {
        await dialog.getByRole("button", { name: label, exact: true }).click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(value);
        await expect(dialog.getByRole("status")).toContainText("kopiert");
        expect((await dialog.boundingBox()).height).toBe(before.height);
      }
      await expect(dialog.getByRole("status")).toHaveText("");
      const close = dialog.getByRole("button", { name: "Details schließen" });
      await close.focus();
      await page.keyboard.press("Shift+Tab");
      await expect(dialog.getByRole("link").last()).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      for (const link of await dialog.getByRole("link").all()) {
        const href = await link.getAttribute("href");
        const popupPromise = page.waitForEvent("popup");
        await link.click();
        const popup = await popupPromise;
        await expect(popup).toHaveURL(href);
        await popup.close();
        await expect(dialog).toBeVisible();
      }
      if (index === 0) await page.screenshot({ path: `artifacts/server-details-${width}x${height}.png` });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await card.focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await page.mouse.click(2, 2);
      await expect(dialog).toHaveCount(0);
      await expect(card).toBeFocused();
      await page.keyboard.press("Space");
      await expect(dialog).toBeVisible();
      await close.click();
    }
    if (width === 1920) await page.screenshot({ path: "artifacts/server-cards-polish-1920x1080.png" });
  });
}

for (const [width, height] of [
  [390, 844],
  [320, 640],
]) {
  test(`Proxmox details at ${width}x${height}`, async ({ page, request, context }) => {
    await page.setViewportSize({ width, height });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const groups = await (await request.get("/api/services")).json();
    const proxmox = groups
      .find((group) => group.name === "Server")
      .services.find((service) => service.name === "Proxmox");
    proxmox.href = "https://proxmox.example.test";
    proxmox.silas.details = {
      lanIp: "192.0.2.20",
      sshCommand: "ssh://root@192.0.2.20",
      links: [{ label: "Proxmox öffnen", href: proxmox.href }],
    };
    proxmox.widgets = [
      {
        type: "proxmox",
        node: "pve",
        index: 0,
        service_group: "Server",
        service_name: "Proxmox",
      },
    ];
    await page.route("**/api/services", (route) => route.fulfill({ json: groups }));
    await page.route("**/api/services/proxy?*", (route) => {
      const endpoint = new URL(route.request().url()).searchParams.get("endpoint");
      const data =
        endpoint === "cluster/resources"
          ? {
              data: [
                { type: "node", node: "pve", status: "online", cpu: 0.25, mem: 50, maxmem: 100 },
                { type: "qemu", node: "pve", template: 0, status: "running" },
                { type: "lxc", node: "pve", template: 0, status: "stopped" },
              ],
            }
          : endpoint === "node/status"
            ? { data: { cpu: 0.25, mem: 50, maxmem: 100, uptime: 90061 } }
            : { data: [{ total: 1000, used: 250 }] };
      return route.fulfill({ json: data });
    });
    await page.goto("/", { waitUntil: "networkidle" });

    const card = page.locator('.service[data-name="Proxmox"] .service-card');
    await expect(card).toHaveAttribute("role", "button");
    await card.click({ position: { x: 12, y: 80 } });
    const dialog = page.getByRole("dialog", { name: "Proxmox", exact: true });
    await expect(dialog).toBeVisible();
    for (const value of ["25 %", "50 %", "25 %", "1 Tag 1 Std.", "192.0.2.20"]) {
      await expect(dialog.getByText(value, { exact: true }).first()).toBeVisible();
    }
    await expect(dialog.getByText("VMs", { exact: true })).toBeVisible();
    await expect(dialog.getByText("LXC", { exact: true })).toBeVisible();
    await expect(dialog).toContainText("Proxmox öffnen");
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await dialog.getByRole("button", { name: "SSH-Befehl kopieren" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("ssh://root@192.0.2.20");
    const quickLink = dialog.getByRole("link", { name: "Proxmox öffnen" });
    await expect(quickLink).toHaveAttribute("href", proxmox.href);
    const popupPromise = page.waitForEvent("popup");
    await quickLink.click();
    const popup = await popupPromise;
    expect(await quickLink.getAttribute("href")).toBe(proxmox.href);
    await popup.close();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await card.click({ position: { x: 12, y: 80 } });
    await expect(page.getByRole("dialog", { name: "Proxmox", exact: true })).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(page.getByRole("dialog", { name: "Proxmox", exact: true })).toHaveCount(0);
  });
}
