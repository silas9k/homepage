// @vitest-environment jsdom

import { act, screen, within } from "@testing-library/react";
import { SWRConfig, useSWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { formatProxyUrl } from "utils/proxy/api-helpers";
import Summary from "widgets/glances/metrics/summary";

import ServerDetails from "./server-details";

// Exercise the real useWidgetAPI/SWR cache; only backend responses are fixtures.
describe.each(["debian-docker", "raspi"])("%s shared card/modal CPU samples", (name) => {
  it.each([
    [21.1, "21,1 %"],
    [1.6, "1,6 %"],
    [0.4, "0,4 %"],
    [0.016, "0 %"],
    [0, "0 %"],
    [99.9, "99,9 %"],
    [100, "100 %"],
  ])("keeps total=%s in percentage units (%s) and shares live updates", async (total, expected) => {
    const widget = {
      type: "glances",
      version: 4,
      metric: "summary:/",
      silas: true,
      service_group: "Server",
      service_name: name,
      index: 0,
    };
    const cpuKey = formatProxyUrl(widget, "4/cpu", { refreshInterval: 60000 });
    const fetcher = vi.fn(async (url) => {
      const endpoint = new URL(url, "http://localhost").searchParams.get("endpoint");
      // An independent CPU request can observe a different sample: the original regression.
      if (endpoint === "4/cpu") return { total: url === cpuKey ? total : 100 };
      if (endpoint === "4/mem") return { percent: 44.2 };
      return [
        { mnt_point: "/boot", percent: 90 },
        { mnt_point: "/", percent: 31.1 },
      ];
    });
    let update;
    function CacheAccess() {
      update = useSWRConfig().mutate;
      return null;
    }
    const cache = new Map();
    const config = { provider: () => cache, fetcher };
    const onClose = vi.fn();
    const renderUI = (open) => (
      <SWRConfig value={config}>
        <CacheAccess />
        <div data-testid="summary">
          <Summary service={{ widget }} />
        </div>
        {open && <ServerDetails service={{ name, widgets: [widget], silas: { details: {} } }} onClose={onClose} />}
      </SWRConfig>
    );
    const { rerender } = renderWithProviders(renderUI(false), { settings: { silasTheme: true } });
    const card = within(screen.getByTestId("summary"));
    expect(await card.findByText(expected)).toBeVisible();
    rerender(renderUI(true));
    const modal = within(screen.getByRole("dialog", { name }));
    expect(await modal.findByText(expected)).toBeVisible();
    expect(await modal.findByText("44,2 %")).toBeVisible();
    expect(await modal.findByText("31,1 %")).toBeVisible();
    const cpuRequests = fetcher.mock.calls.map(([url]) => url).filter((url) => url.includes("endpoint=4%2Fcpu"));
    expect(cpuRequests).toEqual([cpuKey]);

    await act(async () => update(cpuKey, { total: 2.7 }, false));
    expect(card.getByText("2,7 %")).toBeVisible();
    expect(modal.getByText("2,7 %")).toBeVisible();
  });
});
