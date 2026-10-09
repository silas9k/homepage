// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import ServiceSearch from "./service-search";

vi.mock("components/resolvedicon", () => ({
  default: function ResolvedIconMock() {
    return <span data-testid="resolved-icon" />;
  },
}));

const services = [
  {
    name: "Infrastructure",
    services: [
      { name: "Proxmox", description: "Virtualization", silas: { details: {} } },
      { name: "Dashboard", href: "https://example.test", description: "Homepage" },
    ],
    groups: [],
  },
];

describe("ServiceSearch", () => {
  it("filters, ranks, navigates with the keyboard, and activates the existing card", async () => {
    const setSearching = vi.fn();
    const card = document.createElement("div");
    card.className = "service-card";
    card.click = vi.fn();
    const serviceElement = document.createElement("li");
    serviceElement.className = "service";
    serviceElement.dataset.name = "Proxmox";
    serviceElement.append(card);
    document.body.append(serviceElement);

    renderSearch({ setSearching });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "prox" } });

    expect(screen.getByRole("option", { name: /PProxmoxVirtualization/i })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    await waitFor(() => expect(card.click).toHaveBeenCalled());
    expect(setSearching).toHaveBeenCalledWith(false);
  });

  it("closes on Escape and backdrop click", () => {
    const setSearching = vi.fn();
    const setSearchString = vi.fn();
    const { container } = renderSearch({ setSearching, setSearchString });

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(setSearching).toHaveBeenCalledWith(false);

    fireEvent.mouseDown(container.firstChild);
    expect(setSearching).toHaveBeenCalledTimes(2);
  });

  it("restores focus for cancellation but not modal activation", async () => {
    document.body.innerHTML = "";
    const opener = document.createElement("button");
    opener.textContent = "Dienste suchen";
    document.body.append(opener);
    opener.focus();

    const card = document.createElement("div");
    card.className = "service-card";
    card.click = vi.fn();
    const serviceElement = document.createElement("li");
    serviceElement.className = "service";
    serviceElement.dataset.name = "Proxmox";
    serviceElement.append(card);
    document.body.append(serviceElement);

    const { rerender } = render(<ControlledSearch />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(document.activeElement).toBe(opener);

    rerender(<ControlledSearch isOpen key="reopened" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "prox" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => expect(card.click).toHaveBeenCalled());
    expect(document.activeElement).not.toBe(opener);
  });
});

function renderSearch(overrides = {}) {
  return render(<StatefulSearch setSearching={overrides.setSearching ?? vi.fn()} />);
}

function StatefulSearch({ setSearching }) {
  const [searchString, setSearchString] = useState("");
  return (
    <ServiceSearch
      services={services}
      isOpen
      setSearching={setSearching}
      searchString={searchString}
      setSearchString={setSearchString}
    />
  );
}

function ControlledSearch({ isOpen = true }) {
  const [open, setOpen] = useState(isOpen);
  const [searchString, setSearchString] = useState("");
  return (
    <ServiceSearch
      services={services}
      isOpen={open}
      setSearching={setOpen}
      searchString={searchString}
      setSearchString={setSearchString}
    />
  );
}
