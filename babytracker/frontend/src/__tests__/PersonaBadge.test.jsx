import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaProvider } from "../context/PersonaContext";
import PersonaBadge from "../components/PersonaBadge";

const PERSONA = { id: 1, name: "Mom" };

function setPersona(persona) {
  localStorage.setItem("babytracker_persona", JSON.stringify(persona));
}

async function renderBadge(persona = PERSONA) {
  setPersona(persona);
  let result;
  await act(async () => {
    result = render(
      <PersonaProvider>
        <PersonaBadge />
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

describe("PersonaBadge — display", () => {
  it("shows the current persona name as 'You: Name'", async () => {
    await renderBadge();
    expect(screen.getByText("Mom")).toBeInTheDocument();
  });

  it("renders as a button", async () => {
    await renderBadge();
    const btn = screen.getByRole("button", { name: /mom/i });
    expect(btn).toBeInTheDocument();
  });

  it("renders nothing when no persona is set", async () => {
    localStorage.clear();
    const { container } = await act(async () =>
      render(
        <PersonaProvider>
          <PersonaBadge />
        </PersonaProvider>,
      ),
    );
    expect(container.textContent).toBe("");
  });
});

describe("PersonaBadge — persona switcher sheet", () => {
  it("opens a dropdown with other users on click", async () => {
    const user = userEvent.setup();
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

    await renderBadge();
    await user.click(screen.getByRole("button", { name: /mom/i }));

    // Should fetch users
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/users");

    // Should show other users (not current persona)
    await waitFor(() => {
      expect(screen.getByText(/switch to dad/i)).toBeInTheDocument();
      expect(screen.getByText(/switch to grandma/i)).toBeInTheDocument();
    });

    // Should NOT show current user as a switch option
    expect(screen.queryByText(/switch to mom/i)).not.toBeInTheDocument();
  });

  it("shows a sign out button in the dropdown", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: "Mom" }]),
      }),
    );

    await renderBadge();
    await user.click(screen.getByRole("button", { name: /mom/i }));

    await waitFor(() => {
      expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    });
  });

  it("switches persona when clicking another user", async () => {
    const user = userEvent.setup();
    const mockUsers = [
      { id: 1, name: "Mom" },
      { id: 2, name: "Dad" },
    ];
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      }),
    );

    await renderBadge();
    await user.click(screen.getByRole("button", { name: /mom/i }));

    await waitFor(() => {
      expect(screen.getByText(/switch to dad/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/switch to dad/i));

    // Badge should now show Dad
    expect(screen.getByText("Dad")).toBeInTheDocument();
    // Dropdown should close
    expect(screen.queryByText(/switch to/i)).not.toBeInTheDocument();
  });

  it("persists switched persona to localStorage", async () => {
    const user = userEvent.setup();
    const mockUsers = [
      { id: 1, name: "Mom" },
      { id: 2, name: "Dad" },
    ];
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      }),
    );

    await renderBadge();
    await user.click(screen.getByRole("button", { name: /mom/i }));

    await waitFor(() => {
      expect(screen.getByText(/switch to dad/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/switch to dad/i));

    const stored = JSON.parse(localStorage.getItem("babytracker_persona"));
    expect(stored).toEqual({ id: 2, name: "Dad" });
  });

  it("clears persona and localStorage on sign out", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: "Mom" }]),
      }),
    );

    await renderBadge();
    await user.click(screen.getByRole("button", { name: /mom/i }));

    await waitFor(() => {
      expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/sign out/i));

    // Badge should disappear (persona is null)
    expect(screen.queryByText(/mom/i)).not.toBeInTheDocument();
    expect(localStorage.getItem("babytracker_persona")).toBeNull();
  });
});

describe("PersonaBadge — fetch error handling", () => {
  it("handles fetch failure gracefully with empty user list", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    await renderBadge();
    await user.click(screen.getByRole("button", { name: /mom/i }));

    // Should still show sign out even if fetch fails
    await waitFor(() => {
      expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    });
  });

  it("handles non-ok response by showing empty user list", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      }),
    );

    await renderBadge();
    await user.click(screen.getByRole("button", { name: /mom/i }));

    // Should not crash, sign out should still be available
    await waitFor(() => {
      expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/switch to/i)).not.toBeInTheDocument();
  });
});
