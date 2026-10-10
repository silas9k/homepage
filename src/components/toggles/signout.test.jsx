// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SignOut from "./signout";
afterEach(() => vi.unstubAllGlobals());
it("discreet sign out uses POST and exposes retry on failure", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false }); vi.stubGlobal("fetch", fetcher);
  render(<SignOut />); fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry sign out" })).toBeEnabled());
  expect(fetcher).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
});
