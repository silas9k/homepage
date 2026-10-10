import { expect, it } from "vitest";
import createMockRes from "test-utils/create-mock-res";
import handler from "pages/api/auth/[...nextauth]";

it("retires all legacy authentication provider routes", async () => {
  const res = createMockRes();
  await handler({ method: "POST" }, res);
  expect(res.statusCode).toBe(404);
});
