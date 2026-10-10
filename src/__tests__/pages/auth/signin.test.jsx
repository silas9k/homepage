// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/head", () => ({ default: ({ children }) => <>{children}</> }));
import SignIn from "pages/auth/signin";
afterEach(() => vi.unstubAllGlobals());
it("renders only private-dashboard login with proper autocomplete", () => {
  render(<SignIn />);
  expect(screen.getByLabelText("Username")).toHaveAttribute("autocomplete", "username");
  expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  expect(screen.queryByText(/register|forgot password/i)).toBeNull();
});
it("submits JSON credentials and displays the generic error", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401 }); vi.stubGlobal("fetch", fetcher);
  render(<SignIn />);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "owner" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "incorrect" } });
  fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form"));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid username or password"));
  expect(fetcher).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
});
