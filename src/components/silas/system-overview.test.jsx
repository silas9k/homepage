// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import { BeszelHostProvider } from "./beszel-host-data";
import SystemOverview from "./system-overview";

const services = [
  {
    name: "Server",
    services: [
      { name: "Proxmox", silas: { beszelSystemId: "proxmox" }, widgets: [] },
      { name: "debian-docker", silas: { beszelSystemId: "debian-docker" }, widgets: [] },
      { name: "raspi", silas: { beszelSystemId: "raspi" }, widgets: [] },
    ],
  },
  {
    name: "Verwaltung & Netzwerk",
    services: [
      {
        name: "Beszel",
        href: "https://beszel.example.test",
        widgets: [{ type: "beszel", service_name: "Beszel" }],
      },
      { name: "Portainer", href: "https://portainer.example.test", widgets: [{ type: "portainer" }] },
      {
        name: "Cloudflare Tunnel",
        href: "https://cloudflare.example.test",
        widgets: [{ type: "cloudflared" }],
      },
    ],
  },
];

function renderOverview() {
  return render(
    <BeszelHostProvider services={services}>
      <SystemOverview services={services} />
    </BeszelHostProvider>,
  );
}

describe("components/silas/system-overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "systems")
        return {
          data: {
            items: [
              { id: "debian-docker", name: "debian-docker", status: "up", info: {} },
              { id: "raspi", name: "raspi", status: "up", info: {} },
              { id: "proxmox", name: "proxmox", status: "up", info: {} },
            ],
          },
        };
      if (endpoint === "docker/containers") return { data: [{ State: "running" }, { State: "running" }] };
      if (endpoint === "cfd_tunnel") return { data: { result: { status: "healthy" } } };
      return {};
    });
  });

  it("renders all Beszel hosts and preserves shortcuts", () => {
    const { container } = renderOverview();

    expect(screen.getByLabelText("Hosts: 3 / 3 Hosts")).toHaveAttribute("href", "https://beszel.example.test");
    expect(screen.getByLabelText("Container: 2 Container aktiv")).toHaveAttribute(
      "href",
      "https://portainer.example.test",
    );
    expect(screen.getByLabelText("Cloudflare Tunnel: Tunnel Healthy")).toBeVisible();
    expect(container.querySelectorAll(".silas-overview-item")).toHaveLength(3);
    expect(useWidgetAPI).toHaveBeenCalledWith(expect.objectContaining({ type: "beszel" }), "systems", {
      refreshInterval: 60000,
    });
  });

  it("reports one offline Beszel host", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "systems")
        return {
          data: {
            items: [
              { id: "debian-docker", name: "debian-docker", status: "up", info: {} },
              { id: "raspi", name: "raspi", status: "down", info: {} },
              { id: "proxmox", name: "proxmox", status: "up", info: {} },
            ],
          },
        };
      if (endpoint === "docker/containers") return { data: [] };
      if (endpoint === "cfd_tunnel") return { data: { result: { status: "healthy" } } };
      return {};
    });

    renderOverview();
    expect(screen.getByLabelText("Hosts: 2 / 3 Hosts")).toBeVisible();
  });

  it("does not count loading as offline", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "systems") return {};
      if (endpoint === "docker/containers") return { data: [] };
      if (endpoint === "cfd_tunnel") return { data: { result: { status: "healthy" } } };
      return {};
    });

    renderOverview();
    expect(screen.getByText("Hosts werden geprüft")).toBeVisible();
    expect(screen.queryByText("0 / 3 Hosts")).not.toBeInTheDocument();
  });
});
