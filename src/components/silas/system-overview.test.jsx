// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSWR, useWidgetAPI } = vi.hoisted(() => ({ useSWR: vi.fn(), useWidgetAPI: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import SystemOverview from "./system-overview";

const services = [
  { name: "Server", services: [{ name: "debian-docker" }, { name: "raspi" }] },
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
    useSWR.mockReturnValue({ data: { status: 200, latency: 4 } });
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "docker/containers")
        return { data: [{ State: "running" }, { State: "running" }, { State: "exited" }] };
      if (endpoint === "cfd_tunnel") return { data: { result: { status: "healthy" } } };
      return {};
    });
  });

  it("renders a compact, accessible healthy summary from existing service requests", () => {
    const { container } = render(<SystemOverview services={services} />);

    expect(screen.getByLabelText("Systemübersicht")).toHaveClass("silas-system-overview");
    expect(screen.getByLabelText("Hosts: 2 / 2 Hosts")).toBeVisible();
    expect(screen.getByLabelText("Container: 2 Container aktiv")).toBeVisible();
    expect(screen.getByLabelText("Cloudflare Tunnel: Tunnel Healthy")).toBeVisible();
    expect(container.querySelectorAll(".silas-overview-item")).toHaveLength(3);
    expect(useSWR).toHaveBeenCalledWith("/api/siteMonitor?groupName=Server&serviceName=debian-docker", {
      refreshInterval: 30000,
    });
    expect(useWidgetAPI).toHaveBeenCalledWith(expect.objectContaining({ type: "portainer" }), "docker/containers", {
      all: 1,
    });
    expect(useWidgetAPI).toHaveBeenCalledWith(expect.objectContaining({ type: "cloudflared" }), "cfd_tunnel");
  });

  it("reports an unavailable host with a textual warning, not only a colored dot", () => {
    useSWR.mockReturnValueOnce({ data: { status: 200 } }).mockReturnValueOnce({ data: { status: 503 } });

    render(<SystemOverview services={services} />);

    expect(screen.getByLabelText("Hosts: 1 / 2 Hosts")).toBeVisible();
    expect(screen.getByLabelText("Hosts: 1 / 2 Hosts").querySelector(".silas-overview-dot-warning")).toBeTruthy();
  });

  it("uses clear unavailable fallbacks when configured widget data cannot be used", () => {
    useWidgetAPI.mockImplementation(() => ({ error: new Error("unavailable") }));

    render(<SystemOverview services={services} />);

    expect(screen.getByText("Container nicht verfügbar")).toBeVisible();
    expect(screen.getByText("Tunnel nicht verfügbar")).toBeVisible();
  });

  it("keeps a safe structure while host data is loading", () => {
    useSWR.mockReturnValue({});

    render(<SystemOverview services={services} />);

    expect(screen.getByText("Hosts werden geprüft")).toBeVisible();
    expect(screen.getByLabelText("Systemübersicht")).toHaveAttribute("aria-live", "polite");
  });
});
