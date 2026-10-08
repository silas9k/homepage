// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import useWidgetAPI from "utils/proxy/use-widget-api";

import Summary, { percent } from "./summary";

vi.mock("utils/proxy/use-widget-api", () => ({ default: vi.fn() }));

const service = { widget: { type: "glances", version: 4, metric: "summary:/" } };
describe("Glances compact host summary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("preserves real zeroes and never substitutes zero for unavailable data", () => {
    expect(percent(0)).toBe("0 %");
    expect(percent(undefined)).toBe("—");
    expect(percent(NaN)).toBe("—");
    expect(percent(12.34)).toBe("12,3 %");
  });
  it("selects the configured mount rather than the first filesystem", () => {
    useWidgetAPI.mockImplementation((_, endpoint) => ({
      data: endpoint.endsWith("/cpu")
        ? { total: 0 }
        : endpoint.endsWith("/mem")
          ? { percent: 20 }
          : [
              { mnt_point: "/boot", percent: 80 },
              { mnt_point: "/", percent: 30 },
            ],
    }));
    renderWithProviders(<Summary service={service} />, { settings: { silasTheme: true } });
    expect(screen.getByText("0 %")).toBeInTheDocument();
    expect(screen.getByText("30 %")).toBeInTheDocument();
    expect(screen.queryByText("80 %")).not.toBeInTheDocument();
  });
  it("shows a safe error without reflecting backend responses", () => {
    useWidgetAPI.mockReturnValue({ error: { message: "private-token-in-response" } });
    renderWithProviders(<Summary service={service} />, { settings: { silasTheme: true } });
    expect(screen.getByRole("status")).toHaveTextContent("Daten nicht verfügbar");
    expect(screen.queryByText(/private-token/)).not.toBeInTheDocument();
  });
  it("keeps three loading cells while data is pending", () => {
    useWidgetAPI.mockReturnValue({});
    const { container } = renderWithProviders(<Summary service={service} />);
    expect(container.querySelectorAll(".service-block.animate-pulse")).toHaveLength(3);
  });
});
