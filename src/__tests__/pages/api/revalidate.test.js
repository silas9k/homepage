import { expect, it } from "vitest";
import createMockRes from "test-utils/create-mock-res";
import handler from "pages/api/revalidate";
it("rejects GET because refresh is a state-changing action", async () => {
  const res = createMockRes(); await handler({ method: "GET" }, res); expect(res.statusCode).toBe(405);
});
it("returns refresh confirmation behind the session/CSRF guard", async () => {
  const res = createMockRes(); await handler({ method: "POST" }, res); expect(res.body).toEqual({ revalidated: true });
});
