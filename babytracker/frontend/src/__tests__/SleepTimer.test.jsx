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

import SleepTimer from "../components/timers/SleepTimer";
import { useBaby } from "../context/BabyContext";
import { usePersona } from "../context/PersonaContext";
import { useActiveEvents } from "../hooks/useActiveEvents";
import { useTimer } from "../hooks/useTimer";

const BABY = { id: 42, name: "TestBaby" };
const PERSONA = { id: 7, name: "Mom" };

function setupDefaults({ activeFeed = null, activeSleep = null, elapsed = null } = {}) {
  const refetch = vi.fn(() => Promise.resolve());
  useBaby.mockReturnValue({ selectedBaby: BABY });
  usePersona.mockReturnValue({ persona: PERSONA });
  useActiveEvents.mockReturnValue({ activeFeed, activeSleep, refetch });
  useTimer.mockReturnValue({ elapsed, isRunning: elapsed !== null });
  return { refetch };
}

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 200, type: "nap" }) })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Idle state (no active sleep) ----

describe("SleepTimer — idle state (no active sleep)", () => {
  it("shows Nap and Night Sleep buttons", () => {
    setupDefaults();
    render(<SleepTimer />);

    expect(screen.getByRole("button", { name: /nap/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /night sleep/i })).toBeInTheDocument();
  });

  it("does not show 'Wake Up' button when idle", () => {
    setupDefaults();
    render(<SleepTimer />);
    expect(screen.queryByRole("button", { name: /wake up/i })).not.toBeInTheDocument();
  });

  it("does not show the notes form when idle", () => {
    setupDefaults();
    render(<SleepTimer />);
    expect(screen.queryByText(/sleep details/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
  });
});

// ---- Starting a sleep ----

describe("SleepTimer — starting a sleep", () => {
  it("POSTs to the correct API endpoint when Nap is clicked", async () => {
    const { refetch } = setupDefaults();
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/sleeps`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe("nap");
    expect(body.user_id).toBe(PERSONA.id);
    expect(body.started_at).toBeDefined();
  });

  it("sends the correct type for Night Sleep", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /night sleep/i }));

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe("night");
  });

  it("calls refetch after successful POST", async () => {
    const { refetch } = setupDefaults();
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });

  it("does not call refetch when POST fails", async () => {
    const { refetch } = setupDefaults();
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    await waitFor(() => {
      expect(refetch).not.toHaveBeenCalled();
    });
  });

  it("includes started_at as a valid ISO string in the POST body", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(() => new Date(body.started_at).toISOString()).not.toThrow();
  });
});

// ---- Active sleep state ----

describe("SleepTimer — active sleep", () => {
  it("shows the sleep type label when a nap is active", () => {
    setupDefaults({
      activeSleep: { id: 20, type: "nap", started_at: "2026-03-14T22:00:00Z" },
      elapsed: "15m 30s",
    });
    render(<SleepTimer />);

    expect(screen.getByText(/nap/i)).toBeInTheDocument();
  });

  it("shows the sleep type label for night sleep", () => {
    setupDefaults({
      activeSleep: { id: 20, type: "night", started_at: "2026-03-14T22:00:00Z" },
      elapsed: "1h 30m",
    });
    render(<SleepTimer />);

    expect(screen.getByText(/night sleep/i)).toBeInTheDocument();
  });

  it("displays the elapsed time from useTimer", () => {
    setupDefaults({
      activeSleep: { id: 20, type: "nap", started_at: "2026-03-14T22:00:00Z" },
      elapsed: "42m 10s",
    });
    render(<SleepTimer />);

    expect(screen.getByText("42m 10s")).toBeInTheDocument();
  });

  it("shows 'Wake Up' button when a sleep is active", () => {
    setupDefaults({
      activeSleep: { id: 20, type: "nap", started_at: "2026-03-14T22:00:00Z" },
      elapsed: "5m",
    });
    render(<SleepTimer />);

    expect(screen.getByRole("button", { name: /wake up/i })).toBeInTheDocument();
  });

  it("does not show the Nap/Night Sleep start buttons when a sleep is active", () => {
    setupDefaults({
      activeSleep: { id: 20, type: "nap", started_at: "2026-03-14T22:00:00Z" },
      elapsed: "5m",
    });
    render(<SleepTimer />);

    expect(screen.queryByRole("button", { name: /^nap$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /night sleep/i })).not.toBeInTheDocument();
  });

  it("passes activeSleep.started_at to useTimer", () => {
    const startedAt = "2026-03-14T22:00:00Z";
    setupDefaults({
      activeSleep: { id: 20, type: "nap", started_at: startedAt },
      elapsed: "1m",
    });
    render(<SleepTimer />);

    expect(useTimer).toHaveBeenCalledWith(startedAt);
  });

  it("shows fallback 0s when elapsed is null during active sleep", () => {
    setupDefaults({
      activeSleep: { id: 20, type: "nap", started_at: "2026-03-14T22:00:00Z" },
      elapsed: null,
    });
    render(<SleepTimer />);

    expect(screen.getByText("0s")).toBeInTheDocument();
  });
});

// ---- Waking up (stopping a sleep) ----

describe("SleepTimer — waking up", () => {
  it("PATCHes with ended_at when Wake Up is clicked", async () => {
    const activeSleep = { id: 20, type: "nap", started_at: "2026-03-14T22:00:00Z" };
    setupDefaults({ activeSleep, elapsed: "30m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ...activeSleep, ended_at: "2026-03-14T22:30:00Z" }) })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /wake up/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/sleeps/${activeSleep.id}`,
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.ended_at).toBeDefined();
    expect(() => new Date(body.ended_at).toISOString()).not.toThrow();
  });

  it("shows sleep details form after waking up", async () => {
    const activeSleep = { id: 20, type: "nap", started_at: "2026-03-14T22:00:00Z" };
    setupDefaults({ activeSleep, elapsed: "30m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...activeSleep, ended_at: "2026-03-14T22:30:00Z" }),
      })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /wake up/i }));

    await waitFor(() => {
      expect(screen.getByText(/sleep details/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });
});

// ---- Sleep details form ----

describe("SleepTimer — sleep details form", () => {
  function renderWithForm() {
    const activeSleep = { id: 20, type: "nap", started_at: "2026-03-14T22:00:00Z" };
    const stoppedSleep = { ...activeSleep, ended_at: "2026-03-14T22:30:00Z" };
    const { refetch } = setupDefaults({ activeSleep, elapsed: "30m" });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(stoppedSleep),
      })
    );

    const utils = render(<SleepTimer />);
    return { ...utils, stoppedSleep, refetch };
  }

  it("PATCHes with notes when Save is clicked", async () => {
    const { stoppedSleep } = renderWithForm();
    const user = userEvent.setup();

    // Wake up first
    await user.click(screen.getByRole("button", { name: /wake up/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    // Reset fetch mock to track the save call
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

    await user.type(screen.getByLabelText(/notes/i), "Slept well");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/v1/babies/${BABY.id}/sleeps/${stoppedSleep.id}`,
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.notes).toBe("Slept well");
  });

  it("does not PATCH when Save is clicked with empty notes", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /wake up/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    await user.click(screen.getByRole("button", { name: /save/i }));

    // Should dismiss form without calling fetch since notes are empty
    await waitFor(() => {
      expect(screen.queryByText(/sleep details/i)).not.toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dismisses the form when Skip is clicked", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /wake up/i }));
    await waitFor(() => {
      expect(screen.getByText(/sleep details/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /skip/i }));

    expect(screen.queryByText(/sleep details/i)).not.toBeInTheDocument();
  });

  it("shows the sleep type in the form", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /wake up/i }));

    await waitFor(() => {
      expect(screen.getByText(/nap/i)).toBeInTheDocument();
    });
  });

  it("trims whitespace-only notes and skips the PATCH", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /wake up/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    await user.type(screen.getByLabelText(/notes/i), "   ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.queryByText(/sleep details/i)).not.toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ---- Auto-close toast notification ----

describe("SleepTimer — auto-close toast notification", () => {
  it("shows toast when POST response contains non-empty auto_closed", async () => {
    setupDefaults();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 200,
            type: "nap",
            auto_closed: [{ id: 50, type: "feed" }],
          }),
      })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByText(/feed timer automatically stopped/i)).toBeInTheDocument();
  });

  it("shows correct message when a sleep timer was auto-closed", async () => {
    setupDefaults();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 200,
            type: "night",
            auto_closed: [{ id: 51, type: "sleep" }],
          }),
      })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /night sleep/i }));

    await waitFor(() => {
      expect(screen.getByText(/sleep timer automatically stopped/i)).toBeInTheDocument();
    });
  });

  it("shows plural message when multiple timer types were auto-closed", async () => {
    setupDefaults();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 200,
            type: "nap",
            auto_closed: [
              { id: 50, type: "feed" },
              { id: 51, type: "sleep" },
            ],
          }),
      })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    await waitFor(() => {
      expect(screen.getByText(/timers automatically stopped/i)).toBeInTheDocument();
    });
  });

  it("does not show toast when auto_closed is empty array", async () => {
    setupDefaults();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 200,
            type: "nap",
            auto_closed: [],
          }),
      })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show toast when auto_closed is missing from response", async () => {
    setupDefaults();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 200, type: "nap" }),
      })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("toast is dismissable by clicking", async () => {
    setupDefaults();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 200,
            type: "nap",
            auto_closed: [{ id: 50, type: "feed" }],
          }),
      })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /nap/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("status"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

// ---- Edge cases ----

describe("SleepTimer — edge cases", () => {
  it("does not show Wake Up button when there is no active sleep", () => {
    setupDefaults();
    render(<SleepTimer />);

    expect(screen.queryByRole("button", { name: /wake up/i })).not.toBeInTheDocument();
  });

  it("handles unknown sleep type gracefully in active view", () => {
    setupDefaults({
      activeSleep: { id: 20, type: "unknown_type", started_at: "2026-03-14T22:00:00Z" },
      elapsed: "10m",
    });
    render(<SleepTimer />);

    // Should fall back to showing the raw type
    expect(screen.getByText("unknown_type")).toBeInTheDocument();
  });

  it("handles unknown sleep type in the details form", async () => {
    const activeSleep = { id: 20, type: "unknown_type", started_at: "2026-03-14T22:00:00Z" };
    setupDefaults({ activeSleep, elapsed: "10m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...activeSleep, ended_at: "2026-03-14T22:10:00Z" }),
      })
    );
    const user = userEvent.setup();
    render(<SleepTimer />);

    await user.click(screen.getByRole("button", { name: /wake up/i }));

    await waitFor(() => {
      expect(screen.getByText("unknown_type")).toBeInTheDocument();
    });
  });

  it("passes selectedBaby.id to useActiveEvents", () => {
    setupDefaults();
    render(<SleepTimer />);
    expect(useActiveEvents).toHaveBeenCalledWith(BABY.id);
  });
});
