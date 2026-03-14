import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PersonaProvider } from "../context/PersonaContext";
import { BabyProvider } from "../context/BabyContext";
import Layout from "../components/Layout";
import BottomNav from "../components/BottomNav";
import DayTimeline from "../components/DayTimeline";

const TEST_PERSONA = { id: 1, name: "Mom" };
const TEST_BABY = { id: 1, name: "Alice", birthdate: "2025-12-01" };

function makeFetchFn({ headOk = true } = {}) {
  return vi.fn((url, opts) => {
    if (url === "/api/v1/babies" && opts?.method === "HEAD") {
      if (!headOk) return Promise.reject(new Error("Network error"));
      return Promise.resolve({ ok: true });
    }
    if (url === "/api/v1/babies") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([TEST_BABY]),
      });
    }
    if (url === "/api/v1/users") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([TEST_PERSONA]),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });
}

async function renderLayout(opts = {}) {
  localStorage.setItem("babytracker_persona", JSON.stringify(TEST_PERSONA));
  global.fetch = makeFetchFn(opts);
  let result;
  await act(async () => {
    result = render(
      <PersonaProvider>
        <BabyProvider>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<div>Dashboard</div>} />
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

// ---- BottomNav tap targets ----

describe("BottomNav -- 48px minimum tap targets", () => {
  it("each nav link has min-h-[48px] class for tap target compliance", () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(5);
    for (const link of links) {
      expect(link.className).toMatch(/min-h-\[48px\]/);
    }
  });

  it("nav links use flex-1 to fill available width", () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link.className).toMatch(/flex-1/);
    }
  });

  it("nav container uses items-stretch for equal height links", () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation");
    const container = nav.firstElementChild;
    expect(container.className).toMatch(/items-stretch/);
  });

  it("nav has pb-safe class for iPhone home bar inset", () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation");
    expect(nav.className).toMatch(/pb-safe/);
  });
});

// ---- Layout -- overflow-x-hidden ----

describe("Layout -- no horizontal overflow", () => {
  it("root container has overflow-x-hidden to prevent horizontal scrolling", async () => {
    await renderLayout();
    const root = document.querySelector(".min-h-screen");
    expect(root).toBeTruthy();
    expect(root.className).toMatch(/overflow-x-hidden/);
  });
});

// ---- ApiErrorBanner ----

describe("Layout -- API error banner", () => {
  it("does not show error banner when API is reachable", async () => {
    await renderLayout({ headOk: true });
    // Give time for the async check
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(
      screen.queryByText(/unable to reach server/i),
    ).not.toBeInTheDocument();
  });

  it("shows error banner when API fetch throws (network error)", async () => {
    await renderLayout({ headOk: false });
    await waitFor(() => {
      expect(
        screen.getByText(/unable to reach server/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error banner when API returns non-ok status", async () => {
    localStorage.setItem(
      "babytracker_persona",
      JSON.stringify(TEST_PERSONA),
    );
    global.fetch = vi.fn((url, opts) => {
      if (url === "/api/v1/babies" && opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, status: 500 });
      }
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
    await act(async () => {
      render(
        <PersonaProvider>
          <BabyProvider>
            <MemoryRouter initialEntries={["/"]}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<div>Dashboard</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </BabyProvider>
        </PersonaProvider>,
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/unable to reach server/i),
      ).toBeInTheDocument();
    });
  });

  it("error banner has red background for visibility", async () => {
    await renderLayout({ headOk: false });
    await waitFor(() => {
      const banner = screen.getByText(/unable to reach server/i);
      expect(banner.className).toMatch(/bg-red-600/);
    });
  });
});

// ---- DayTimeline -- loading spinner ----

describe("DayTimeline -- loading spinner state", () => {
  it("shows animated spinner when loading", () => {
    render(<DayTimeline events={[]} loading={true} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows 'Loading events...' text when loading", () => {
    render(<DayTimeline events={[]} loading={true} />);
    expect(screen.getByText("Loading events...")).toBeInTheDocument();
  });

  it("does not render events while loading", () => {
    render(
      <DayTimeline
        events={[
          {
            _type: "feed",
            id: 1,
            type: "bottle",
            started_at: "2026-01-01T10:00:00Z",
            ended_at: "2026-01-01T10:30:00Z",
          },
        ]}
        loading={true}
      />,
    );
    expect(screen.queryByText(/bottle/i)).not.toBeInTheDocument();
  });
});

// ---- DayTimeline -- empty state ----

describe("DayTimeline -- empty state with friendly message", () => {
  it("shows 'No events this day' when no events and not loading", () => {
    render(<DayTimeline events={[]} loading={false} />);
    expect(screen.getByText("No events this day")).toBeInTheDocument();
  });

  it("shows mailbox emoji in empty state", () => {
    render(<DayTimeline events={[]} loading={false} />);
    expect(screen.getByText(/\u{1F4ED}/u)).toBeInTheDocument();
  });

  it("does not show spinner in empty state", () => {
    render(<DayTimeline events={[]} loading={false} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeNull();
  });
});

// ---- CSS: iOS auto-zoom prevention and mobile utilities ----

describe("index.css -- mobile UX utilities", () => {
  it("sets input font-size to 16px to prevent iOS auto-zoom", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync(
      "/workspace/babytracker/frontend/src/index.css",
      "utf-8",
    );
    expect(css).toContain("font-size: 16px");
    expect(css).toMatch(/input[\s\S]*font-size:\s*16px/);
  });

  it("includes -webkit-text-size-adjust: 100%", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync(
      "/workspace/babytracker/frontend/src/index.css",
      "utf-8",
    );
    expect(css).toContain("-webkit-text-size-adjust: 100%");
  });

  it("defines pb-safe class with safe-area-inset for iPhone home bar", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync(
      "/workspace/babytracker/frontend/src/index.css",
      "utf-8",
    );
    expect(css).toContain("env(safe-area-inset-bottom");
  });

  it("defines animate-spin keyframes for loading spinners", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync(
      "/workspace/babytracker/frontend/src/index.css",
      "utf-8",
    );
    expect(css).toContain("@keyframes spin");
    expect(css).toContain("rotate(360deg)");
  });
});
