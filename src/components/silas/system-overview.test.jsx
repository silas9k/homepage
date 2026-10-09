// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import SystemOverview from "./system-overview";

const services = [
  {
    name: "Server",
    services: [
      {
        name: "Proxmox",
        widgets: [{ type: "proxmox", node: "pve", service_name: "Proxmox" }],
      },
      { name: "debian-docker", widgets: [{ type: "glances", version: 4, service_name: "debian-docker" }] },
      { name: "raspi", widgets: [{ type: "glances", version: 4, service_name: "raspi" }] },
    ],
  },
  {
    name: "Verwaltung & Netzwerk",
    services: [
      {
        name: "Portainer",
        widgets: [{ type: "portainer", service_name: "Portainer", service_group: "Verwaltung & Netzwerk", index: 0 }],
      },
      {
        name: "Cloudflare Tunnel",
        widgets: [
          { type: "cloudflared", service_name: "Cloudflare Tunnel", service_group: "Verwaltung & Netzwerk", index: 0 },
        ],
      },
    ],
  },
];

describe("components/silas/system-overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWidgetAPI.mockImplementation((widget, endpoint) => {
      if (endpoint.endsWith("/cpu")) return { data: { total: widget.service_name === "raspi" ? 3.2 : 1.6 } };
      if (endpoint === "cluster/resources")
        return { data: { data: [{ type: "node", node: "pve", status: "online" }] } };
      if (endpoint === "docker/containers")
        return { data: [{ State: "running" }, { State: "running" }, { State: "exited" }] };
      if (endpoint === "cfd_tunnel") return { data: { result: { status: "healthy" } } };
      return {};
    });
  });

  it("renders a compact, accessible healthy summary from existing service requests", () => {
    const { container } = render(<SystemOverview services={services} />);

    expect(screen.getByLabelText("Systemübersicht")).toHaveClass("silas-system-overview");
    expect(screen.getByLabelText("Hosts: 3 / 3 Hosts")).toBeVisible();
    expect(screen.getByLabelText("Container: 2 Container aktiv")).toBeVisible();
    expect(screen.getByLabelText("Cloudflare Tunnel: Tunnel Healthy")).toBeVisible();
    expect(container.querySelectorAll(".silas-overview-item")).toHaveLength(3);
    expect(useWidgetAPI).toHaveBeenCalledWith(
      expect.objectContaining({ type: "glances", service_name: "debian-docker", version: 4 }),
      "4/cpu",
      { refreshInterval: 60000 },
    );
    expect(useWidgetAPI).toHaveBeenCalledWith(
      expect.objectContaining({ type: "glances", service_name: "raspi", version: 4 }),
      "4/cpu",
      { refreshInterval: 60000 },
    );
    expect(useWidgetAPI).toHaveBeenCalledWith(
      expect.objectContaining({ type: "proxmox", node: "pve" }),
      "cluster/resources",
    );
    expect(useWidgetAPI).toHaveBeenCalledWith(expect.objectContaining({ type: "portainer" }), "docker/containers", {
      all: 1,
    });
    expect(useWidgetAPI).toHaveBeenCalledWith(expect.objectContaining({ type: "cloudflared" }), "cfd_tunnel");
  });

  it("reports one failed Glances host with a textual warning, not only a colored dot", () => {
    useWidgetAPI.mockImplementation((widget, endpoint) => {
      if (endpoint.endsWith("/cpu"))
        return widget.service_name === "raspi" ? { error: new Error("offline") } : { data: { total: 1.6 } };
      if (endpoint === "cluster/resources")
        return { data: { data: [{ type: "node", node: "pve", status: "online" }] } };
      if (endpoint === "docker/containers") return { data: [] };
      return { data: { result: { status: "healthy" } } };
    });

    render(<SystemOverview services={services} />);

    expect(screen.getByLabelText("Hosts: 2 / 3 Hosts")).toBeVisible();
    expect(screen.getByLabelText("Hosts: 2 / 3 Hosts").querySelector(".silas-overview-dot-warning")).toBeTruthy();
  });

  it("reports zero hosts when both Glances CPU requests fail", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint.endsWith("/cpu")) return { error: new Error("offline") };
      if (endpoint === "cluster/resources") return { error: new Error("offline") };
      if (endpoint === "docker/containers") return { data: [] };
      return { data: { result: { status: "healthy" } } };
    });

    render(<SystemOverview services={services} />);

    expect(screen.getByLabelText("Hosts: 0 / 3 Hosts")).toBeVisible();
  });

  it("uses clear unavailable fallbacks when configured widget data cannot be used", () => {
    useWidgetAPI.mockImplementation(() => ({ error: new Error("unavailable") }));

    render(<SystemOverview services={services} />);

    expect(screen.getByText("Container nicht verfügbar")).toBeVisible();
    expect(screen.getByText("Tunnel nicht verfügbar")).toBeVisible();
  });

  it("keeps a neutral host state while Glances CPU data is loading", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint.endsWith("/cpu") || endpoint === "cluster/resources") return {};
      if (endpoint === "docker/containers") return { data: [] };
      return { data: { result: { status: "healthy" } } };
    });

    render(<SystemOverview services={services} />);

    expect(screen.getByText("Hosts werden geprüft")).toBeVisible();
    expect(screen.queryByText("0 / 3 Hosts")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Systemübersicht")).toHaveAttribute("aria-live", "polite");
  });
});
