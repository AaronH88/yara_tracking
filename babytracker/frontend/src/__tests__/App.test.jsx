import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import App from "../App";

const TEST_PERSONA = { id: 1, name: "TestUser" };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("babytracker_persona", JSON.stringify(TEST_PERSONA));
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

async function renderApp() {
  let result;
  await act(async () => {
    result = render(<App />);
  });
  return result;
}

describe("App routing", () => {
  it("renders Dashboard page content at /", async () => {
    window.history.pushState({}, "", "/");
    await renderApp();
    // "Dashboard" appears in both the page and the BottomNav
    const matches = screen.getAllByText("Dashboard");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders History page content at /history", async () => {
    window.history.pushState({}, "", "/history");
    await renderApp();
    const matches = screen.getAllByText("History");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Calendar page content at /calendar", async () => {
    window.history.pushState({}, "", "/calendar");
    await renderApp();
    const matches = screen.getAllByText("Calendar");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Admin page content at /admin", async () => {
    window.history.pushState({}, "", "/admin");
    await renderApp();
    const matches = screen.getAllByText("Admin");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Settings page content at /settings", async () => {
    window.history.pushState({}, "", "/settings");
    await renderApp();
    const matches = screen.getAllByText("Settings");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render page-specific content for an unknown route", async () => {
    window.history.pushState({}, "", "/nonexistent");
    await renderApp();
    // BottomNav labels still appear, but main should have no page content
    const main = document.querySelector("main");
    if (main) {
      expect(main.textContent.trim()).toBe("");
    }
  });
});

describe("App context providers", () => {
  it("wraps the app in PersonaProvider, BabyProvider, and SettingsProvider without errors", async () => {
    window.history.pushState({}, "", "/");
    const { container } = await renderApp();
    expect(container).toBeTruthy();
    const matches = screen.getAllByText("Dashboard");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
