import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PersonaProvider } from "../context/PersonaContext";
import { BabyProvider } from "../context/BabyContext";
import Layout from "../components/Layout";

const TEST_PERSONA = { id: 1, name: "Mom" };
const TEST_BABY = { id: 1, name: "Alice", birthdate: "2025-12-01" };

function mockFetchSuccess() {
  global.fetch = vi.fn((url) => {
    if (url === "/api/v1/babies") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([TEST_BABY]),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });
}

async function renderLayout(initialRoute = "/") {
  localStorage.setItem("babytracker_persona", JSON.stringify(TEST_PERSONA));
  mockFetchSuccess();
  let result;
  await act(async () => {
    result = render(
      <PersonaProvider>
        <BabyProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
                <Route path="/history" element={<div data-testid="history">History</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </BabyProvider>
      </PersonaProvider>,
    );
  });
  return result;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Layout — structure", () => {
  it("renders header with BabySwitcher and PersonaBadge", async () => {
    await renderLayout();
    // BabySwitcher shows baby name
    expect(screen.getByText("Alice")).toBeInTheDocument();
    // PersonaBadge shows persona
    expect(screen.getByText("You: Mom")).toBeInTheDocument();
  });

  it("renders bottom navigation", async () => {
    await renderLayout();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("renders the routed page content via Outlet", async () => {
    await renderLayout("/");
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });

  it("renders different page content based on route", async () => {
    await renderLayout("/history");
    expect(screen.getByTestId("history")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });
});

describe("Layout — header positioning", () => {
  it("header has sticky positioning class", async () => {
    await renderLayout();
    const header = screen.getByText("Alice").closest("header");
    expect(header).toBeTruthy();
    expect(header.className).toMatch(/sticky/);
    expect(header.className).toMatch(/top-0/);
  });
});

describe("Layout — main content area", () => {
  it("main has bottom padding to avoid overlap with bottom nav", async () => {
    await renderLayout();
    const main = screen.getByTestId("dashboard").closest("main");
    expect(main).toBeTruthy();
    expect(main.className).toMatch(/pb-20/);
  });
});
