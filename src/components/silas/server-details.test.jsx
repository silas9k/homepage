// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import ServerDetails from "./server-details";

const service = {
  name: "debian-docker",
  silas: {
    host: "debian-docker",
    details: {
      lanIp: "192.0.2.10",
      tailscaleIp: "100.64.0.10",
      sshCommand: "ssh user@host",
      links: [{ label: "Portainer", href: "https://portainer.example.test" }],
    },
  },
  widgets: [{ type: "glances", version: 4, metric: "summary:/" }],
};

const proxmoxService = {
  name: "Proxmox",
  silas: {
    host: "ThinkCentre M920q",
    details: {
      lanIp: "192.0.2.20",
      sshCommand: "ssh://root@192.0.2.20",
      links: [{ label: "Proxmox öffnen", href: "https://proxmox.example.test" }],
    },
  },
  widgets: [{ type: "proxmox", node: "pve", url: "https://proxmox.example.test" }],
};

describe("components/silas/server-details", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useWidgetAPI.mockImplementation((_widget, path) => {
      if (path.endsWith("/cpu")) return { data: { total: 12.5 } };
      if (path.endsWith("/mem")) return { data: { percent: 44.2 } };
      return {
        data: [
          { mnt_point: "/boot", percent: 90 },
          { mnt_point: "/", percent: 31.1 },
        ],
      };
    });
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => vi.useRealTimers());

  it("keeps live metrics and minimal, consistently cased labels", () => {
    render(<ServerDetails service={service} onClose={vi.fn()} />);
    for (const value of ["12,5 %", "44,2 %", "31,1 %"]) expect(screen.getByText(value)).toBeVisible();
    expect(screen.queryByText("90 %")).not.toBeInTheDocument();
    for (const label of ["CPU", "RAM", "Disk"]) {
      const metric = screen.getByText(label);
      expect(metric).not.toHaveClass("uppercase");
      expect(metric.parentElement.querySelector("svg")).toBeNull();
    }
    expect(screen.getByText("100.64.0.10")).toHaveClass("font-mono");
  });

  it.each([
    ["SSH-Befehl kopieren", "ssh user@host", "SSH-Befehl kopiert"],
    ["IP kopieren", "192.0.2.10", "IP kopiert"],
    ["LAN IP kopieren", "192.0.2.10", "IP kopiert"],
    ["Tailscale IP kopieren", "100.64.0.10", "IP kopiert"],
  ])("copies through %s with temporary feedback in a persistent region", async (name, value, feedback) => {
    render(<ServerDetails service={service} onClose={vi.fn()} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    await act(async () => fireEvent.click(screen.getByRole("button", { name, exact: true })));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);
    expect(region).toHaveTextContent(feedback);
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toBeEmptyDOMElement();
  });

  it("resets the feedback timeout after a second copy and handles clipboard denial", async () => {
    render(<ServerDetails service={service} onClose={vi.fn()} />);
    const button = screen.getByRole("button", { name: "IP kopieren", exact: true });
    await act(async () => fireEvent.click(button));
    act(() => vi.advanceTimersByTime(1000));
    await act(async () => fireEvent.click(button));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("status")).toHaveTextContent("IP kopiert");
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("denied"));
    await act(async () => fireEvent.click(button));
    expect(screen.getByRole("status")).toHaveTextContent("Kopieren nicht möglich");
  });

  it("keeps quick links independent and closes only on Escape, close, or the backdrop", () => {
    const onClose = vi.fn();
    render(<ServerDetails service={service} onClose={onClose} />);
    const link = screen.getByRole("link", { name: "Portainer" });
    expect(link).toHaveAttribute("href", "https://portainer.example.test");
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog.parentElement);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Details schließen" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("contains keyboard focus and restores it to the opener", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(<ServerDetails service={service} onClose={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Details schließen" });
    const last = screen.getByRole("link", { name: "Portainer" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(close).toHaveFocus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("renders Proxmox metrics, actions, and mapped API requests", async () => {
    useWidgetAPI.mockImplementation((_widget, path) => {
      if (path === "cluster/resources") {
        return {
          data: {
            data: [
              { type: "node", node: "pve", status: "online", cpu: 0.25, mem: 50, maxmem: 100 },
              { type: "qemu", node: "pve", template: 0, status: "running" },
              { type: "lxc", node: "pve", template: 0, status: "stopped" },
            ],
          },
        };
      }
      if (path === "node/status") return { data: { data: { cpu: 0.25, mem: 50, maxmem: 100, uptime: 90061 } } };
      if (path === "node/storage") return { data: { data: [{ total: 1000, used: 250 }] } };
      return {};
    });

    const onClose = vi.fn();
    render(<ServerDetails service={proxmoxService} onClose={onClose} />);

    expect(screen.getByRole("heading", { name: "Proxmox" })).toBeVisible();
    expect(screen.getByText("ThinkCentre M920q")).toBeVisible();
    expect(screen.getAllByText("25 %")).toHaveLength(2);
    expect(screen.getByText("50 %")).toBeVisible();
    expect(screen.getByText("1 Tag 1 Std.")).toBeVisible();
    expect(screen.getAllByText("1")).toHaveLength(2);
    expect(screen.getByText("192.0.2.20")).toBeVisible();
    expect(screen.getByText("Storage")).toBeVisible();
    expect(screen.getByRole("link", { name: "Proxmox öffnen" })).toHaveAttribute(
      "href",
      "https://proxmox.example.test",
    );
    expect(useWidgetAPI).toHaveBeenCalledWith(expect.objectContaining({ type: "proxmox", node: "pve" }), "node/status");
    expect(useWidgetAPI).toHaveBeenCalledWith(
      expect.objectContaining({ type: "proxmox", node: "pve" }),
      "node/storage",
    );

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "SSH-Befehl kopieren" })));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ssh://root@192.0.2.20");
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
