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
  it("renders Dashboard at /", async () => {
    window.history.pushState({}, "", "/");
    await renderApp();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders History at /history", async () => {
    window.history.pushState({}, "", "/history");
    await renderApp();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("renders Calendar at /calendar", async () => {
    window.history.pushState({}, "", "/calendar");
    await renderApp();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  it("renders Admin at /admin", async () => {
    window.history.pushState({}, "", "/admin");
    await renderApp();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders Settings at /settings", async () => {
    window.history.pushState({}, "", "/settings");
    await renderApp();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders nothing meaningful for an unknown route", async () => {
    window.history.pushState({}, "", "/nonexistent");
    await renderApp();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});

describe("App context providers", () => {
  it("wraps the app in PersonaProvider, BabyProvider, and SettingsProvider without errors", async () => {
    window.history.pushState({}, "", "/");
    const { container } = await renderApp();
    expect(container).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
