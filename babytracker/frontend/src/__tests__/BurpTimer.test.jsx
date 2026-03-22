import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));
vi.mock("../context/PersonaContext", () => ({
  usePersona: vi.fn(),
}));
vi.mock("../hooks/useActiveEvents", () => ({
  useActiveEvents: vi.fn(),
}));
vi.mock("../hooks/useTimer", () => ({
  useTimer: vi.fn(),
}));

import BurpTimer from "../components/timers/BurpTimer";
import { useBaby } from "../context/BabyContext";
import { usePersona } from "../context/PersonaContext";
import { useActiveEvents } from "../hooks/useActiveEvents";
import { useTimer } from "../hooks/useTimer";

const BABY = { id: 42, name: "TestBaby" };
const PERSONA = { id: 7, name: "Mom" };

function setupDefaults({ activeBurp = null, elapsed = null } = {}) {
  const refetch = vi.fn(() => Promise.resolve());
  useBaby.mockReturnValue({ selectedBaby: BABY });
  usePersona.mockReturnValue({ persona: PERSONA });
  useActiveEvents.mockReturnValue({ activeFeed: null, activeSleep: null, activeBurp, refetch });
  useTimer.mockReturnValue({ elapsed, isRunning: elapsed !== null });
  return { refetch };
}

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 300 }) })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Idle state (no active burp) ----

describe("BurpTimer — idle state (no active burp)", () => {
  it("shows 'Start Burp' button", () => {
    setupDefaults();
    render(<BurpTimer />);

    expect(screen.getByRole("button", { name: /start burp/i })).toBeInTheDocument();
  });

  it("does not show 'Done' button when idle", () => {
    setupDefaults();
    render(<BurpTimer />);
    expect(screen.queryByRole("button", { name: /done/i })).not.toBeInTheDocument();
  });

  it("does not show the notes form when idle", () => {
    setupDefaults();
    render(<BurpTimer />);
    expect(screen.queryByText(/burp details/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
  });
});

// ---- Starting a burp ----

describe("BurpTimer — starting a burp", () => {
  it("POSTs to the correct API endpoint when Start Burp is clicked", async () => {
    const { refetch } = setupDefaults();
    const user = userEvent.setup();
    render(<BurpTimer />);

    await user.click(screen.getByRole("button", { name: /start burp/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/burps`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.user_id).toBe(PERSONA.id);
    expect(body.started_at).toBeDefined();
  });

  it("includes started_at as a valid ISO string in the POST body", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<BurpTimer />);

    await user.click(screen.getByRole("button", { name: /start burp/i }));

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(() => new Date(body.started_at).toISOString()).not.toThrow();
  });

  it("calls refetch after successful POST", async () => {
    const { refetch } = setupDefaults();
    const user = userEvent.setup();
    render(<BurpTimer />);

    await user.click(screen.getByRole("button", { name: /start burp/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });

  it("does not call refetch when POST fails", async () => {
    const { refetch } = setupDefaults();
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const user = userEvent.setup();
    render(<BurpTimer />);

    await user.click(screen.getByRole("button", { name: /start burp/i }));

    await waitFor(() => {
      expect(refetch).not.toHaveBeenCalled();
    });
  });
});

// ---- Active burp state ----

describe("BurpTimer — active burp", () => {
  it("displays the elapsed time from useTimer", () => {
    setupDefaults({
      activeBurp: { id: 30, started_at: "2026-03-14T22:00:00Z" },
      elapsed: "2m 15s",
    });
    render(<BurpTimer />);

    expect(screen.getByText("2m 15s")).toBeInTheDocument();
  });

  it("shows 'Done' button when a burp is active", () => {
    setupDefaults({
      activeBurp: { id: 30, started_at: "2026-03-14T22:00:00Z" },
      elapsed: "1m",
    });
    render(<BurpTimer />);

    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("does not show 'Start Burp' button when a burp is active", () => {
    setupDefaults({
      activeBurp: { id: 30, started_at: "2026-03-14T22:00:00Z" },
      elapsed: "1m",
    });
    render(<BurpTimer />);

    expect(screen.queryByRole("button", { name: /start burp/i })).not.toBeInTheDocument();
  });

  it("passes activeBurp.started_at to useTimer", () => {
    const startedAt = "2026-03-14T22:00:00Z";
    setupDefaults({
      activeBurp: { id: 30, started_at: startedAt },
      elapsed: "1m",
    });
    render(<BurpTimer />);

    expect(useTimer).toHaveBeenCalledWith(startedAt);
  });

  it("shows fallback 0s when elapsed is null during active burp", () => {
    setupDefaults({
      activeBurp: { id: 30, started_at: "2026-03-14T22:00:00Z" },
      elapsed: null,
    });
    render(<BurpTimer />);

    expect(screen.getByText("0s")).toBeInTheDocument();
  });

  it("shows 'Burping' label when active", () => {
    setupDefaults({
      activeBurp: { id: 30, started_at: "2026-03-14T22:00:00Z" },
      elapsed: "1m",
    });
    render(<BurpTimer />);

    expect(screen.getByText(/burping/i)).toBeInTheDocument();
  });
});

// ---- Stopping a burp ----

describe("BurpTimer — stopping a burp", () => {
  it("PATCHes with ended_at when Done is clicked", async () => {
    const activeBurp = { id: 30, started_at: "2026-03-14T22:00:00Z" };
    setupDefaults({ activeBurp, elapsed: "3m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ...activeBurp, ended_at: "2026-03-14T22:03:00Z" }) })
    );
    const user = userEvent.setup();
    render(<BurpTimer />);

    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/burps/${activeBurp.id}`,
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.ended_at).toBeDefined();
    expect(() => new Date(body.ended_at).toISOString()).not.toThrow();
  });

  it("shows burp details form after stopping", async () => {
    const activeBurp = { id: 30, started_at: "2026-03-14T22:00:00Z" };
    setupDefaults({ activeBurp, elapsed: "3m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...activeBurp, ended_at: "2026-03-14T22:03:00Z" }),
      })
    );
    const user = userEvent.setup();
    render(<BurpTimer />);

    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => {
      expect(screen.getByText(/burp details/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("calls refetch after successful PATCH", async () => {
    const activeBurp = { id: 30, started_at: "2026-03-14T22:00:00Z" };
    const { refetch } = setupDefaults({ activeBurp, elapsed: "3m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...activeBurp, ended_at: "2026-03-14T22:03:00Z" }),
      })
    );
    const user = userEvent.setup();
    render(<BurpTimer />);

    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });
});

// ---- Burp details form ----

describe("BurpTimer — burp details form", () => {
  function renderWithForm() {
    const activeBurp = { id: 30, started_at: "2026-03-14T22:00:00Z" };
    const stoppedBurp = { ...activeBurp, ended_at: "2026-03-14T22:03:00Z" };
    const { refetch } = setupDefaults({ activeBurp, elapsed: "3m" });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(stoppedBurp),
      })
    );

    const utils = render(<BurpTimer />);
    return { ...utils, stoppedBurp, refetch };
  }

  it("PATCHes with notes when Save is clicked", async () => {
    const { stoppedBurp } = renderWithForm();
    const user = userEvent.setup();

    // Stop burp first
    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    // Reset fetch mock to track the save call
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

    await user.type(screen.getByLabelText(/notes/i), "Good burp");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/v1/babies/${BABY.id}/burps/${stoppedBurp.id}`,
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.notes).toBe("Good burp");
  });

  it("does not PATCH when Save is clicked with empty notes", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    await user.click(screen.getByRole("button", { name: /save/i }));

    // Should dismiss form without calling fetch since notes are empty
    await waitFor(() => {
      expect(screen.queryByText(/burp details/i)).not.toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dismisses the form when Skip is clicked", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => {
      expect(screen.getByText(/burp details/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /skip/i }));

    expect(screen.queryByText(/burp details/i)).not.toBeInTheDocument();
  });

  it("trims whitespace-only notes and skips the PATCH", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    await user.type(screen.getByLabelText(/notes/i), "   ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.queryByText(/burp details/i)).not.toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ---- Edge cases ----

describe("BurpTimer — edge cases", () => {
  it("does not show Done button when there is no active burp", () => {
    setupDefaults();
    render(<BurpTimer />);

    expect(screen.queryByRole("button", { name: /done/i })).not.toBeInTheDocument();
  });

  it("passes selectedBaby.id to useActiveEvents", () => {
    setupDefaults();
    render(<BurpTimer />);
    expect(useActiveEvents).toHaveBeenCalledWith(BABY.id);
  });
});
