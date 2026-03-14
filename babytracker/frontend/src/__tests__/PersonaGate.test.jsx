import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaProvider } from "../context/PersonaContext";
import PersonaGate from "../components/PersonaGate";

function renderGate() {
  return render(
    <PersonaProvider>
      <PersonaGate>
        <div data-testid="app-content">App is visible</div>
      </PersonaGate>
    </PersonaProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PersonaGate — first visit (no persona)", () => {
  it("shows the welcome modal when persona is null", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: "Mom" }]),
      }),
    );

    await act(async () => {
      renderGate();
    });

    expect(
      screen.getByText(/welcome — who are you\?/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });

  it("does not render children while the modal is shown", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: "Mom" }]),
      }),
    );

    await act(async () => {
      renderGate();
    });

    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });
});

describe("PersonaGate — user list", () => {
  it("fetches users from /api/v1/users and displays a button for each", async () => {
    const mockUsers = [
      { id: 1, name: "Mom" },
      { id: 2, name: "Dad" },
      { id: 3, name: "Grandma" },
    ];
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      }),
    );

    await act(async () => {
      renderGate();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/users");
    expect(screen.getByRole("button", { name: "Mom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dad" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grandma" })).toBeInTheDocument();
  });

  it("shows loading state while fetching users", async () => {
    let resolvePromise;
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );

    await act(async () => {
      renderGate();
    });

    expect(screen.getByText(/loading users/i)).toBeInTheDocument();

    await act(async () => {
      resolvePromise({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: "Mom" }]),
      });
    });

    expect(screen.queryByText(/loading users/i)).not.toBeInTheDocument();
  });
});

describe("PersonaGate — selecting a user", () => {
  it("dismisses modal and shows children after clicking a user", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: "Mom" }]),
      }),
    );

    await act(async () => {
      renderGate();
    });

    await user.click(screen.getByRole("button", { name: "Mom" }));

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(
      screen.queryByText(/welcome — who are you\?/i),
    ).not.toBeInTheDocument();
  });

  it("persists the selected user to localStorage", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([{ id: 42, name: "Dad" }]),
      }),
    );

    await act(async () => {
      renderGate();
    });

    await user.click(screen.getByRole("button", { name: "Dad" }));

    const stored = JSON.parse(localStorage.getItem("babytracker_persona"));
    expect(stored).toEqual({ id: 42, name: "Dad" });
  });
});

describe("PersonaGate — returning visitor with persona", () => {
  it("skips the modal and renders children directly when persona exists in localStorage", async () => {
    localStorage.setItem(
      "babytracker_persona",
      JSON.stringify({ id: 1, name: "Mom" }),
    );

    global.fetch = vi.fn();

    await act(async () => {
      renderGate();
    });

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(
      screen.queryByText(/welcome — who are you\?/i),
    ).not.toBeInTheDocument();
    // Should not fetch users when persona is already set
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("PersonaGate — no users exist", () => {
  it("shows message and admin link when user list is empty", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    await act(async () => {
      renderGate();
    });

    expect(
      screen.getByText(/no users set up yet/i),
    ).toBeInTheDocument();
    const adminLink = screen.getByRole("link", { name: /admin/i });
    expect(adminLink).toBeInTheDocument();
    expect(adminLink).toHaveAttribute("href", "/admin");
  });

  it("does not show any user buttons when list is empty", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    await act(async () => {
      renderGate();
    });

    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });
});

describe("PersonaGate — fetch error", () => {
  it("shows error message when fetch fails with non-ok response", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }),
    );

    await act(async () => {
      renderGate();
    });

    expect(screen.getByText(/failed to fetch users/i)).toBeInTheDocument();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });

  it("shows error message when fetch throws a network error", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    await act(async () => {
      renderGate();
    });

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });
});
