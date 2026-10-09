import { describe, expect, it } from "vitest";

import { buildAttentionItems, getDiskSeverity, isExpectedRunning } from "./attention-center";

describe("attention center rules", () => {
  it("only warns at the configured disk thresholds", () => {
    expect(getDiskSeverity(84.9)).toBeNull();
    expect(getDiskSeverity(85)).toBe("warning");
    expect(getDiskSeverity(95)).toBe("critical");
  });

  it("excludes intentional, optional, and explicitly disabled services", () => {
    expect(isExpectedRunning({ siteMonitor: "https://health", silas: {} })).toBe(true);
    for (const state of ["planned", "stopped", "later", "not configured"]) {
      expect(isExpectedRunning({ siteMonitor: "https://health", silas: { state } })).toBe(false);
    }
    expect(isExpectedRunning({ siteMonitor: "https://health", optional: true, silas: {} })).toBe(false);
    expect(isExpectedRunning({ siteMonitor: "https://health", silas: { attention: false } })).toBe(false);
    expect(isExpectedRunning({ siteMonitor: "{{HOMEPAGE_VAR_HEALTH_URL}}", silas: {} })).toBe(false);
  });

  it("suppresses dependent service failures when their host is unavailable", () => {
    const issues = buildAttentionItems({
      host: { kind: "host", host: "debian-docker", title: "debian-docker", message: "Host nicht erreichbar" },
      nextcloud: { kind: "service", host: "debian-docker", title: "Nextcloud", message: "Dienst nicht erreichbar" },
      raspi: { kind: "host", host: "raspi", title: "raspi", message: "Host nicht erreichbar" },
      homebridge: { kind: "service", host: "Raspberry Pi 5", title: "Homebridge", message: "Dienst nicht erreichbar" },
    });

    expect(issues.map((issue) => issue.title)).toEqual(["debian-docker", "raspi"]);
  });
});
