// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import ServerDetails, { formatUptime, getTemperature } from "./server-details";

const widget = { type: "glances", version: 4, metric: "summary:/" };

function service(name, cpuSensorLabel) {
  return { name, widgets: [widget], silas: { host: name, details: { cpuSensorLabel } } };
}

describe("components/silas/server-details health details", () => {
  beforeEach(() => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint.endsWith("/cpu")) return { data: { total: 1.6 } };
      if (endpoint.endsWith("/mem")) return { data: { percent: 29.9 } };
      if (endpoint.endsWith("/fs")) return { data: [{ mnt_point: "/", percent: 22.6 }] };
      if (endpoint.endsWith("/uptime")) return { data: "3 days, 07:12:00" };
      return { data: [] };
    });
  });

  it.each([
    ["0 days, 00:12:59", "12 Min."],
    ["0 days, 12:24:00", "12 Std. 24 Min."],
    ["3 days, 07:12:00", "3 Tage 7 Std."],
    [5400, "1 Std. 30 Min."],
  ])("formats Glances uptime %s as %s", (value, expected) => {
    expect(formatUptime(value)).toBe(expected);
  });

  it("selects a preferred sensor first and retains a safe fallback", () => {
    const sensors = [
      { label: "Core 0", type: "temperature_core", value: 41 },
      { label: "Package id 0", type: "temperature_core", value: 47.4 },
    ];
    expect(getTemperature(sensors, "Package id")).toBe(47.4);
    expect(getTemperature(sensors)).toBe(41);
    expect(getTemperature([{ label: "Fan", type: "temperature_fan", value: 900 }])).toBeUndefined();
  });

  it.each([
    ["debian-docker", "Package id", { label: "Package id 0", type: "temperature_core", value: 42.4 }, "42,4 °C"],
    ["raspi", "cpu_thermal", { label: "cpu_thermal-0", type: "temperature_core", value: 51 }, "51 °C"],
  ])("renders %s primary metrics, temperature, and uptime", (name, sensorLabel, sensor, temperature) => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint.endsWith("/sensors")) return { data: [sensor] };
      if (endpoint.endsWith("/uptime")) return { data: "3 days, 07:12:00" };
      if (endpoint.endsWith("/cpu")) return { data: { total: 1.6 } };
      if (endpoint.endsWith("/mem")) return { data: { percent: 29.9 } };
      return { data: [{ mnt_point: "/", percent: 22.6 }] };
    });

    render(<ServerDetails service={service(name, sensorLabel)} onClose={vi.fn()} />);

    for (const value of ["1,6 %", "29,9 %", "22,6 %", temperature, "3 Tage 7 Std."]) {
      expect(screen.getByText(value)).toBeVisible();
    }
  });

  it("hides temperature when Glances has no unambiguous supported sensor", () => {
    render(<ServerDetails service={service("raspi", "cpu_thermal")} onClose={vi.fn()} />);

    expect(screen.queryByText("Temperatur")).not.toBeInTheDocument();
    expect(screen.getByText("Uptime")).toBeVisible();
    expect(useWidgetAPI).toHaveBeenCalledWith(widget, "4/sensors", { refreshInterval: 60000 });
    expect(useWidgetAPI).toHaveBeenCalledWith(widget, "4/uptime", { refreshInterval: 60000 });
  });
});
