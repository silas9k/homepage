// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));

vi.mock("utils/proxy/use-widget-api", () => ({
  default: useWidgetAPI,
}));

import ServerDetails from "./server-details";

describe("components/silas/server-details", () => {
  it("renders live Glances metrics, links, copy actions and closes on Escape", () => {
    useWidgetAPI.mockImplementation((_widget, path) => {
      if (path.endsWith("/cpu")) return { data: { total: 12.5 } };
      if (path.endsWith("/mem")) return { data: { percent: 44.2 } };
      return { data: [{ mnt_point: "/", percent: 31.1 }] };
    });
    const onClose = vi.fn();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    render(
      <ServerDetails
        service={{
          name: "debian-docker",
          silas: { host: "debian-docker", details: { lanIp: "192.168.1.10", sshCommand: "ssh user@host", links: [] } },
          widgets: [{ type: "glances", version: 4, metric: "summary:/" }],
        }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("12,5 %")).toBeInTheDocument();
    expect(screen.getByText("44,2 %")).toBeInTheDocument();
    expect(screen.getByText("31,1 %")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "IP kopieren" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("192.168.1.10");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
