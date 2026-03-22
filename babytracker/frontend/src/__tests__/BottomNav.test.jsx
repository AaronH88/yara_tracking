import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BottomNav from "../components/BottomNav";

function renderNav(initialRoute = "/") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe("BottomNav — renders all navigation items", () => {
  beforeEach(() => {
    renderNav("/");
  });

  it("renders 5 navigation links", () => {
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
  });

  it("renders Dashboard link pointing to /", () => {
    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders History link pointing to /history", () => {
    const link = screen.getByRole("link", { name: /history/i });
    expect(link).toHaveAttribute("href", "/history");
  });

  it("renders Calendar link pointing to /calendar", () => {
    const link = screen.getByRole("link", { name: /calendar/i });
    expect(link).toHaveAttribute("href", "/calendar");
  });

  it("renders Admin link pointing to /admin", () => {
    const link = screen.getByRole("link", { name: /admin/i });
    expect(link).toHaveAttribute("href", "/admin");
  });

  it("renders Settings link pointing to /settings", () => {
    const link = screen.getByRole("link", { name: /settings/i });
    expect(link).toHaveAttribute("href", "/settings");
  });
});

describe("BottomNav — active state highlighting", () => {
  it("highlights Dashboard when on /", () => {
    renderNav("/");
    const dashLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashLink.className).toMatch(/text-purple-600/);
  });

  it("does not highlight History when on /", () => {
    renderNav("/");
    const histLink = screen.getByRole("link", { name: /history/i });
    expect(histLink.className).not.toMatch(/text-purple-600/);
  });

  it("highlights History when on /history", () => {
    renderNav("/history");
    const histLink = screen.getByRole("link", { name: /history/i });
    expect(histLink.className).toMatch(/text-purple-600/);
  });

  it("highlights Calendar when on /calendar", () => {
    renderNav("/calendar");
    const calLink = screen.getByRole("link", { name: /calendar/i });
    expect(calLink.className).toMatch(/text-purple-600/);
  });

  it("highlights Admin when on /admin", () => {
    renderNav("/admin");
    const adminLink = screen.getByRole("link", { name: /admin/i });
    expect(adminLink.className).toMatch(/text-purple-600/);
  });

  it("highlights Settings when on /settings", () => {
    renderNav("/settings");
    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink.className).toMatch(/text-purple-600/);
  });

  it("does not highlight Dashboard when on /history (exact match)", () => {
    renderNav("/history");
    const dashLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashLink.className).not.toMatch(/text-purple-600/);
  });
});

describe("BottomNav — structure", () => {
  it("renders a nav element", () => {
    renderNav("/");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("each link contains both an icon and a text label", () => {
    renderNav("/");
    const links = screen.getAllByRole("link");
    for (const link of links) {
      const svg = link.querySelector("svg");
      const span = link.querySelector("span");
      expect(svg).toBeTruthy();
      expect(span).toBeTruthy();
      expect(span.textContent).not.toBe("");
    }
  });
});
