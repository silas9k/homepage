import { describe, expect, it } from "vitest";

import { prepareSilasGroups, substituteSilasValues } from "./silas";

function prepare(service) {
  return prepareSilasGroups([{ name: "Test", services: [service] }])[0].services;
}

describe("silas configuration", () => {
  it("does not change upstream services without opt-in metadata", () => {
    const service = { name: "Native", href: "#", widget: { type: "proxmox" } };
    expect(prepare(service)).toEqual([service]);
  });
  it("keeps cards but removes unconfigured API widgets and monitor URLs", () => {
    const [service] = prepare({
      name: "Proxmox",
      silas: {},
      href: "{{MISSING}}",
      siteMonitor: "",
      widget: {
        type: "proxmox",
        url: "https://pve.example",
        password: "{{MISSING}}",
        silasRequired: ["url", "password"],
      },
    });
    expect(service.widgets).toEqual([]);
    expect(service.href).toBeUndefined();
    expect(service.siteMonitor).toBeUndefined();
  });
  it("omits optional services until their URL is valid", () => {
    expect(prepare({ name: "Resticwatch", silas: { optional: true }, href: "" })).toEqual([]);
    expect(prepare({ name: "Resticwatch", silas: { optional: true }, href: "https://backup.example" })).toHaveLength(1);
  });
  it("rejects credential-bearing and unsafe links", () => {
    for (const href of ["javascript:alert(1)", "https://user:secret@example.com", "{{MISSING}}/api"]) {
      expect(prepare({ name: "Service", silas: {}, href })[0].href).toBeUndefined();
    }
  });
  it("keeps SSH launchers with usernames but rejects passwords and unsafe schemes", () => {
    const [service] = prepare({
      name: "Proxmox",
      silas: { sshUrl: "ssh://silas@100.70.7.74" },
    });
    expect(service.silas.sshUrl).toBe("ssh://silas@100.70.7.74");

    for (const sshUrl of ["ssh://silas:password@host", "https://host", "javascript:alert(1)"]) {
      expect(prepare({ name: "Service", silas: { sshUrl } })[0].silas.sshUrl).toBeUndefined();
    }
  });

  it("preserves API credentials on the server and removes activation metadata", () => {
    const [service] = prepare({
      name: "Nextcloud",
      silas: {},
      widget: { type: "nextcloud", url: "https://cloud.example", key: "test-only", silasRequired: ["url", "key"] },
    });
    expect(service.widgets).toEqual([{ type: "nextcloud", url: "https://cloud.example", key: "test-only" }]);
  });
  it("treats quotes and newlines in substituted secrets as data", () => {
    const secret = 'a"\nnewField: injected';
    expect(
      substituteSilasValues({ password: "{{SECRET}}", widgets: [{ key: "{{SECRET}}" }] }, (value) =>
        value.replace("{{SECRET}}", secret),
      ),
    ).toEqual({ password: secret, widgets: [{ key: secret }] });
  });
  it("allows the native Minecraft status scheme only for Minecraft widgets", () => {
    const widget = { type: "minecraft", url: "udp://minecraft.internal:25565", silasRequired: ["url"] };
    expect(prepare({ silas: {}, widget })[0].widgets).toHaveLength(1);
    expect(prepare({ silas: {}, widget: { ...widget, type: "immich" } })[0].widgets).toEqual([]);
    expect(prepare({ silas: {}, widget: { ...widget, url: "udp://user:secret@host:25565" } })[0].widgets).toEqual([]);
    expect(prepare({ silas: {}, href: widget.url })[0].href).toBeUndefined();
  });
  it("keeps the two Homebridge integrations independent", () => {
    const services = prepareSilasGroups([
      {
        services: [
          {
            name: "Homebridge A",
            silas: { site: "a" },
            widget: {
              type: "homebridge",
              url: "https://bridge-a.internal",
              username: "reader",
              password: "test-only",
              silasRequired: ["url", "username", "password"],
            },
          },
          {
            name: "Homebridge B",
            silas: { site: "b" },
            widget: {
              type: "homebridge",
              url: "https://bridge-b.internal",
              username: "",
              password: "",
              silasRequired: ["url", "username", "password"],
            },
          },
        ],
      },
    ])[0].services;
    expect(services[0].widgets).toHaveLength(1);
    expect(services[1].widgets).toEqual([]);
    expect(services[1].silas.site).toBe("b");
  });

  it("preserves optional per-card site label overrides", () => {
    const services = prepareSilasGroups([
      {
        services: [
          { name: "Homebridge · Papa", silas: { site: "a", siteLabel: "PAPA" } },
          { name: "Homebridge · Mama", silas: { site: "b", siteLabel: "MAMA" } },
          { name: "Proxmox", silas: { site: "a" } },
        ],
      },
    ])[0].services;

    expect(services.map((service) => service.silas)).toEqual([
      { site: "a", siteLabel: "PAPA" },
      { site: "b", siteLabel: "MAMA" },
      { site: "a" },
    ]);
  });
});
