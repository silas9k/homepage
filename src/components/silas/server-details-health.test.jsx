// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import ServerDetails, { formatTemperature, formatUptime } from "./server-details";

const service = {
  name: "raspi",
  silas: { host: "raspi", beszelSystemId: "raspi", details: {} },
  widgets: [{ type: "beszel" }],
};

describe("components/silas/server-details Beszel metrics", () => {
  beforeEach(() => {
    useWidgetAPI.mockReturnValue({
      data: {
        items: [
          {
            id: "raspi",
            name: "raspi",
            status: "up",
            info: { cpu: 1.6, mp: 29.9, dp: 22.6, u: 270720, dt: 51 },
          },
        ],
      },
    });
  });

  it("formats Beszel uptime and temperature values", () => {
    expect(formatUptime(270720)).toBe("3 Tage 3 Std.");
    expect(formatTemperature(51)).toBe("51 °C");
    expect(formatTemperature(undefined)).toBeUndefined();
  });

  it("renders CPU, RAM, disk, temperature, and uptime from Beszel", () => {
    render(<ServerDetails service={service} onClose={vi.fn()} />);

    for (const value of ["1,6 %", "29,9 %", "22,6 %", "51 °C", "3 Tage 3 Std."]) {
      expect(screen.getByText(value)).toBeVisible();
    }
    expect(useWidgetAPI).toHaveBeenCalledWith(expect.objectContaining({ type: "beszel" }), "systems", {
      refreshInterval: 60000,
    });
  });

  it("hides temperature when Beszel does not provide one", () => {
    useWidgetAPI.mockReturnValue({
      data: { items: [{ id: "raspi", name: "raspi", status: "up", info: { u: 60 } }] },
    });

    render(<ServerDetails service={service} onClose={vi.fn()} />);

    expect(screen.queryByText("Temperatur")).not.toBeInTheDocument();
    expect(screen.getByText("1 Min.")).toBeVisible();
  });
});
