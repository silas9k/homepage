// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));

vi.mock("swr", () => ({
  default: useSWR,
}));

import SilasStatus from "./status";

describe("components/silas/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows missing configuration without polling", () => {
    useSWR.mockReturnValue({ data: undefined, error: undefined });

    renderStatus({});

    expect(screen.getByText("Nicht konfiguriert")).toBeInTheDocument();
    expect(useSWR).toHaveBeenCalledWith(null, { refreshInterval: 30000 });
  });

  it("shows Online for a successful health response", () => {
    useSWR.mockReturnValue({ data: { status: 200 }, error: undefined });

    renderStatus({ siteMonitor: "https://service.example/health" });

    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("shows Offline for an unhealthy HTTP response", () => {
    useSWR.mockReturnValue({ data: { status: 503 }, error: undefined });

    renderStatus({ siteMonitor: "https://service.example/health" });

    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("shows Nicht erreichbar when the health request fails", () => {
    useSWR.mockReturnValue({ data: undefined, error: new Error("unavailable") });

    renderStatus({ siteMonitor: "https://service.example/health" });

    expect(screen.getByText("Nicht erreichbar")).toBeInTheDocument();
  });

  it("shows an explicit planned state without polling", () => {
    useSWR.mockReturnValue({ data: undefined, error: undefined });

    renderStatus({ silas: { state: "planned", stateLabel: "Geplant", stateNote: "Einrichtung folgt" } });

    expect(screen.getByText("Geplant")).toBeInTheDocument();
    expect(screen.getByText("Einrichtung folgt")).toBeInTheDocument();
    expect(useSWR).toHaveBeenCalledWith(null, { refreshInterval: 30000 });
  });

  it("shows an explicit stopped state without polling", () => {
    useSWR.mockReturnValue({ data: undefined, error: undefined });

    renderStatus({ silas: { state: "stopped", stateLabel: "Gestoppt" } });

    expect(screen.getByText("Gestoppt")).toBeInTheDocument();
    expect(useSWR).toHaveBeenCalledWith(null, { refreshInterval: 30000 });
  });
});

function renderStatus(service) {
  return render(<SilasStatus groupName="Server" service={{ name: "Memos", ...service }} />);
}
