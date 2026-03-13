import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

// Helper: render App at a specific route using MemoryRouter
// We can't use BrowserRouter inside App for testing different routes,
// so we test the route config by rendering the full App and checking content.
function renderApp() {
  return render(<App />);
}

describe("App routing", () => {
  it("renders Dashboard at /", () => {
    renderApp();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders History at /history", () => {
    window.history.pushState({}, "", "/history");
    renderApp();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("renders Calendar at /calendar", () => {
    window.history.pushState({}, "", "/calendar");
    renderApp();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  it("renders Admin at /admin", () => {
    window.history.pushState({}, "", "/admin");
    renderApp();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders Settings at /settings", () => {
    window.history.pushState({}, "", "/settings");
    renderApp();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders nothing meaningful for an unknown route", () => {
    window.history.pushState({}, "", "/nonexistent");
    renderApp();
    // None of the page components should render
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});

describe("App context providers", () => {
  it("wraps the app in PersonaProvider, BabyProvider, and SettingsProvider without errors", () => {
    // If providers are missing or misconfigured, this would throw
    window.history.pushState({}, "", "/");
    const { container } = renderApp();
    expect(container).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
