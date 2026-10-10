import { beforeEach, expect, it, vi } from "vitest";
import createMockRes from "test-utils/create-mock-res";

const { enabled, handle } = vi.hoisted(() => ({ enabled: vi.fn(), handle: vi.fn() }));
vi.mock("utils/mcp/homepage-mcp", () => ({ mcpEnabled: enabled, handleMcpRequest: handle }));
import handler from "pages/api/mcp/index";

beforeEach(() => { vi.clearAllMocks(); enabled.mockReturnValue(true); });
it("returns 404 when disabled", async () => {
  enabled.mockReturnValue(false);
  const res = createMockRes(); await handler({ method: "POST" }, res);
  expect(res.statusCode).toBe(404);
});
it("allows only POST behind the independent session and CSRF guard", async () => {
  const res = createMockRes(); await handler({ method: "GET" }, res);
  expect(res.statusCode).toBe(405); expect(handle).not.toHaveBeenCalled();
});
it("returns authenticated RPC data", async () => {
  handle.mockReturnValue({ result: {} });
  const res = createMockRes(); await handler({ method: "POST", body: {} }, res);
  expect(res.body).toEqual({ result: {} });
});
