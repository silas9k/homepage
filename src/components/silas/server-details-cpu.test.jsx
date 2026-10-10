import { describe, expect, it } from "vitest";

import { normalizeBeszelSystem } from "./beszel-host-data";

describe("Beszel host metric normalization", () => {
  it("maps the authenticated systems response into shared host metrics", () => {
    expect(
      normalizeBeszelSystem({
        id: "debian-docker",
        name: "debian-docker",
        status: "up",
        updated: 123,
        info: { cpu: 21.1, mp: 44.2, dp: 31.1, bb: 14.5, u: 5400, dt: 42.4 },
      }),
    ).toEqual({
      id: "debian-docker",
      name: "debian-docker",
      status: "up",
      online: true,
      cpuPercent: 21.1,
      memoryPercent: 44.2,
      diskPercent: 31.1,
      networkBandwidth: 14.5,
      uptime: 5400,
      temperature: 42.4,
      updatedAt: 123,
    });
  });

  it("degrades unsupported numeric metrics to undefined", () => {
    expect(normalizeBeszelSystem({ status: "up", info: { dt: null, u: "unknown" } })).toMatchObject({
      online: true,
      temperature: undefined,
      uptime: undefined,
    });
  });
});
