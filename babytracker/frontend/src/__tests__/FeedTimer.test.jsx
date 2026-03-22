import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the hooks used by FeedTimer
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

import FeedTimer from "../components/timers/FeedTimer";
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
  localStorage.clear();
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 100, type: "bottle" }) })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Idle state (no active feed) ----

describe("FeedTimer — idle state (no active feed)", () => {
  it("shows all four feed type buttons", () => {
    setupDefaults();
    render(<FeedTimer />);

    expect(screen.getByRole("button", { name: /breast l/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /breast r/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /both sides/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bottle/i })).toBeInTheDocument();
  });

  it("does not show 'Stop Feed' button when idle", () => {
    setupDefaults();
    render(<FeedTimer />);
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  it("does not show the form when idle", () => {
    setupDefaults();
    render(<FeedTimer />);
    expect(screen.queryByText(/feed details/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/amount/i)).not.toBeInTheDocument();
  });
});

// ---- Starting a feed ----

describe("FeedTimer — starting a feed", () => {
  it("POSTs to the correct API endpoint when a feed type is clicked", async () => {
    const { refetch } = setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /bottle/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/feeds`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    // Verify body contains correct type and user_id
    const callArgs = global.fetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.type).toBe("bottle");
    expect(body.user_id).toBe(PERSONA.id);
    expect(body.started_at).toBeDefined();
  });

  it("sends the correct feed type for Breast L", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /breast l/i }));

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe("breast_left");
  });

  it("sends the correct feed type for Breast R", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /breast r/i }));

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe("breast_right");
  });

  it("sends the correct feed type for Both Sides", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /both sides/i }));

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe("both_sides");
  });

  it("calls refetch after successful POST", async () => {
    const { refetch } = setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /bottle/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });

  it("does not call refetch when POST fails", async () => {
    const { refetch } = setupDefaults();
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /bottle/i }));

    await waitFor(() => {
      expect(refetch).not.toHaveBeenCalled();
    });
  });

  it("includes started_at as a valid ISO string in the POST body", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /bottle/i }));

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(() => new Date(body.started_at).toISOString()).not.toThrow();
  });
});

// ---- Active feed state ----

describe("FeedTimer — active feed", () => {
  it("shows the feed type label when a feed is active", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "5m 30s",
    });
    render(<FeedTimer />);

    expect(screen.getByText(/breast — left/i)).toBeInTheDocument();
  });

  it("displays the elapsed time from useTimer", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m 15s",
    });
    render(<FeedTimer />);

    expect(screen.getByText("2m 15s")).toBeInTheDocument();
  });

  it("shows 'Stop Feed' button when a feed is active", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "1m 0s",
    });
    render(<FeedTimer />);

    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("does not show the four start buttons when a feed is active", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "1m 0s",
    });
    render(<FeedTimer />);

    expect(screen.queryByRole("button", { name: /breast l$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bottle/i })).not.toBeInTheDocument();
  });

  it("passes activeFeed.started_at and pause options to useTimer", () => {
    const startedAt = "2026-03-14T10:00:00Z";
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: startedAt },
      elapsed: "1m",
    });
    render(<FeedTimer />);

    expect(useTimer).toHaveBeenCalledWith(startedAt, {
      pausedSeconds: 0,
      pausedAt: null,
    });
  });

  it("shows correct label for both_sides type", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "both_sides", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "0s",
    });
    render(<FeedTimer />);

    expect(screen.getByText(/breast — both sides/i)).toBeInTheDocument();
  });

  it("shows correct label for breast_right type", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "breast_right", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "0s",
    });
    render(<FeedTimer />);

    expect(screen.getByText(/breast — right/i)).toBeInTheDocument();
  });

  it("shows fallback 0s when elapsed is null during active feed", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: null,
    });
    render(<FeedTimer />);

    expect(screen.getByText("0s")).toBeInTheDocument();
  });
});

// ---- Stopping a feed ----

describe("FeedTimer — stopping a feed", () => {
  it("PATCHes with ended_at when Stop Feed is clicked", async () => {
    const activeFeed = { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" };
    setupDefaults({ activeFeed, elapsed: "5m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ...activeFeed, ended_at: "2026-03-14T10:05:00Z" }) })
    );
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /stop/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/feeds/${activeFeed.id}`,
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.ended_at).toBeDefined();
    expect(() => new Date(body.ended_at).toISOString()).not.toThrow();
  });

  it("shows feed details form after stopping a feed", async () => {
    const activeFeed = { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" };
    const { refetch } = setupDefaults({ activeFeed, elapsed: "5m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...activeFeed, ended_at: "2026-03-14T10:05:00Z" }),
      })
    );
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /stop/i }));

    await waitFor(() => {
      expect(screen.getByText(/feed details/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });
});

// ---- Feed details form ----

describe("FeedTimer — feed details form", () => {
  function renderWithForm() {
    const activeFeed = { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" };
    const stoppedFeed = { ...activeFeed, ended_at: "2026-03-14T10:05:00Z" };
    const { refetch } = setupDefaults({ activeFeed, elapsed: "5m" });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(stoppedFeed),
      })
    );

    const utils = render(<FeedTimer />);
    return { ...utils, stoppedFeed, refetch };
  }

  it("PATCHes with amount and notes when Save is clicked", async () => {
    const { stoppedFeed } = renderWithForm();
    const user = userEvent.setup();

    // Stop the feed first
    await user.click(screen.getByRole("button", { name: /stop/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    });

    // Reset fetch mock to track the save call
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

    await user.type(screen.getByLabelText(/amount/i), "4.5");
    await user.type(screen.getByLabelText(/notes/i), "Fed well");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/v1/babies/${BABY.id}/feeds/${stoppedFeed.id}`,
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.amount_oz).toBe(4.5);
    expect(body.notes).toBe("Fed well");
  });

  it("does not PATCH when Save is clicked with empty fields", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /stop/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    });

    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    await user.click(screen.getByRole("button", { name: /save/i }));

    // Should not have called fetch since no data was entered
    await waitFor(() => {
      expect(screen.queryByText(/feed details/i)).not.toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dismisses the form when Skip is clicked", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /stop/i }));
    await waitFor(() => {
      expect(screen.getByText(/feed details/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /skip/i }));

    expect(screen.queryByText(/feed details/i)).not.toBeInTheDocument();
  });

  it("shows the feed type label in the form", async () => {
    renderWithForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /stop/i }));

    await waitFor(() => {
      expect(screen.getByText(/breast — left/i)).toBeInTheDocument();
    });
  });
});

// ---- Last side tracking ----

describe("FeedTimer — last side tracking", () => {
  it("shows 'last used' label under the button matching localStorage", () => {
    localStorage.setItem(`feedTimer_lastSide_${BABY.id}`, "breast_left");
    setupDefaults();
    render(<FeedTimer />);

    expect(screen.getByText(/last used/i)).toBeInTheDocument();
  });

  it("does not show 'last used' when no side is stored", () => {
    setupDefaults();
    render(<FeedTimer />);

    expect(screen.queryByText(/last used/i)).not.toBeInTheDocument();
  });

  it("saves last side to localStorage when a breast feed is started", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /breast r/i }));

    await waitFor(() => {
      expect(localStorage.getItem(`feedTimer_lastSide_${BABY.id}`)).toBe("breast_right");
    });
  });

  it("saves last side for both_sides type", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /both sides/i }));

    await waitFor(() => {
      expect(localStorage.getItem(`feedTimer_lastSide_${BABY.id}`)).toBe("both_sides");
    });
  });

  it("does not update last side when bottle is started", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /bottle/i }));

    await waitFor(() => {
      expect(localStorage.getItem(`feedTimer_lastSide_${BABY.id}`)).toBeNull();
    });
  });

  it("shows 'last used' only on the matching button, not others", () => {
    localStorage.setItem(`feedTimer_lastSide_${BABY.id}`, "breast_right");
    setupDefaults();
    render(<FeedTimer />);

    const lastUsedLabels = screen.getAllByText(/last used/i);
    expect(lastUsedLabels).toHaveLength(1);
  });
});

// ---- Pause/Resume buttons ----

describe("FeedTimer — pause/resume buttons", () => {
  it("shows Pause button when feed is active and running", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    render(<FeedTimer />);

    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
  });

  it("shows Resume button when feed is paused", () => {
    setupDefaults({
      activeFeed: {
        id: 10,
        type: "bottle",
        started_at: "2026-03-14T10:00:00Z",
        is_paused: true,
        paused_seconds: 30,
        paused_at: "2026-03-14T10:02:00Z",
      },
      elapsed: "1m 30s",
    });
    render(<FeedTimer />);

    expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
  });

  it("shows Stop button in both running and paused states", () => {
    // Running
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "1m",
    });
    const { unmount } = render(<FeedTimer />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    unmount();

    // Paused
    setupDefaults({
      activeFeed: {
        id: 10,
        type: "bottle",
        started_at: "2026-03-14T10:00:00Z",
        is_paused: true,
        paused_seconds: 10,
        paused_at: "2026-03-14T10:01:00Z",
      },
      elapsed: "50s",
    });
    render(<FeedTimer />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("calls POST pause endpoint when Pause is clicked", async () => {
    const { refetch } = setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /pause/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/feeds/10/pause`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("calls refetch after successful pause", async () => {
    const { refetch } = setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /pause/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });

  it("does not call refetch when pause POST fails", async () => {
    const { refetch } = setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 409 }));
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /pause/i }));

    await waitFor(() => {
      expect(refetch).not.toHaveBeenCalled();
    });
  });

  it("calls POST resume endpoint when Resume is clicked", async () => {
    const { refetch } = setupDefaults({
      activeFeed: {
        id: 10,
        type: "bottle",
        started_at: "2026-03-14T10:00:00Z",
        is_paused: true,
        paused_seconds: 30,
        paused_at: "2026-03-14T10:02:00Z",
      },
      elapsed: "1m 30s",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /resume/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/feeds/10/resume`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("calls refetch after successful resume", async () => {
    const { refetch } = setupDefaults({
      activeFeed: {
        id: 10,
        type: "bottle",
        started_at: "2026-03-14T10:00:00Z",
        is_paused: true,
        paused_seconds: 30,
        paused_at: "2026-03-14T10:02:00Z",
      },
      elapsed: "1m 30s",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /resume/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });

  it("does not call refetch when resume POST fails", async () => {
    const { refetch } = setupDefaults({
      activeFeed: {
        id: 10,
        type: "bottle",
        started_at: "2026-03-14T10:00:00Z",
        is_paused: true,
        paused_seconds: 30,
        paused_at: "2026-03-14T10:02:00Z",
      },
      elapsed: "1m 30s",
    });
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /resume/i }));

    await waitFor(() => {
      expect(refetch).not.toHaveBeenCalled();
    });
  });

  it("passes paused_seconds and paused_at from activeFeed to useTimer", () => {
    setupDefaults({
      activeFeed: {
        id: 10,
        type: "bottle",
        started_at: "2026-03-14T10:00:00Z",
        paused_seconds: 45,
        paused_at: "2026-03-14T10:03:00Z",
        is_paused: true,
      },
      elapsed: "2m 15s",
    });
    render(<FeedTimer />);

    expect(useTimer).toHaveBeenCalledWith("2026-03-14T10:00:00Z", {
      pausedSeconds: 45,
      pausedAt: "2026-03-14T10:03:00Z",
    });
  });
});

// ---- Switch button visibility ----

describe("FeedTimer — switch button visibility", () => {
  it("shows '→ Right' button for breast_left when running", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    render(<FeedTimer />);

    expect(screen.getByRole("button", { name: /→ Right/i })).toBeInTheDocument();
  });

  it("shows '→ Left' button for breast_right when running", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "breast_right", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "1m",
    });
    render(<FeedTimer />);

    expect(screen.getByRole("button", { name: /→ Left/i })).toBeInTheDocument();
  });

  it("does not show switch button for both_sides", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "both_sides", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "1m",
    });
    render(<FeedTimer />);

    expect(screen.queryByRole("button", { name: /→ Right/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /→ Left/i })).not.toBeInTheDocument();
  });

  it("does not show switch button for bottle feed", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    render(<FeedTimer />);

    expect(screen.queryByRole("button", { name: /→ Right/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /→ Left/i })).not.toBeInTheDocument();
  });

  it("hides switch button for breast_left when paused", () => {
    setupDefaults({
      activeFeed: {
        id: 10,
        type: "breast_left",
        started_at: "2026-03-14T10:00:00Z",
        is_paused: true,
        paused_seconds: 10,
        paused_at: "2026-03-14T10:01:00Z",
      },
      elapsed: "50s",
    });
    render(<FeedTimer />);

    expect(screen.queryByRole("button", { name: /→ Right/i })).not.toBeInTheDocument();
  });

  it("hides switch button for breast_right when paused", () => {
    setupDefaults({
      activeFeed: {
        id: 10,
        type: "breast_right",
        started_at: "2026-03-14T10:00:00Z",
        is_paused: true,
        paused_seconds: 10,
        paused_at: "2026-03-14T10:01:00Z",
      },
      elapsed: "50s",
    });
    render(<FeedTimer />);

    expect(screen.queryByRole("button", { name: /→ Left/i })).not.toBeInTheDocument();
  });
});

// ---- Switch breast two-step API flow ----

describe("FeedTimer — switch breast API flow", () => {
  it("PATCHes ended_at on current feed then POSTs new feed with opposite type (left → right)", async () => {
    const newFeed = { id: 200, type: "breast_right" };
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })   // PATCH stop
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(newFeed) }); // POST start
    const { refetch } = setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /→ Right/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // First call: PATCH to stop current feed
    const [patchUrl, patchOpts] = global.fetch.mock.calls[0];
    expect(patchUrl).toBe(`/api/v1/babies/${BABY.id}/feeds/10`);
    expect(patchOpts.method).toBe("PATCH");
    const patchBody = JSON.parse(patchOpts.body);
    expect(patchBody.ended_at).toBeDefined();
    expect(() => new Date(patchBody.ended_at).toISOString()).not.toThrow();

    // Second call: POST to start new feed
    const [postUrl, postOpts] = global.fetch.mock.calls[1];
    expect(postUrl).toBe(`/api/v1/babies/${BABY.id}/feeds`);
    expect(postOpts.method).toBe("POST");
    const postBody = JSON.parse(postOpts.body);
    expect(postBody.type).toBe("breast_right");
    expect(postBody.user_id).toBe(PERSONA.id);
    expect(postBody.started_at).toBeDefined();
  });

  it("PATCHes ended_at then POSTs with opposite type (right → left)", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 201, type: "breast_left" }) });
    setupDefaults({
      activeFeed: { id: 10, type: "breast_right", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /→ Left/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    const postBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(postBody.type).toBe("breast_left");
  });

  it("uses the same timestamp for ended_at (PATCH) and started_at (POST)", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 202 }) });
    setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /→ Right/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    const patchBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    const postBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(patchBody.ended_at).toBe(postBody.started_at);
  });

  it("calls refetch after successful switch", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 203 }) });
    const { refetch } = setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /→ Right/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });

  it("saves new breast side to localStorage after successful switch", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 204 }) });
    setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /→ Right/i }));

    await waitFor(() => {
      expect(localStorage.getItem(`feedTimer_lastSide_${BABY.id}`)).toBe("breast_right");
    });
  });

  it("does not POST if PATCH to stop current feed fails", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 });
    const { refetch } = setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /→ Right/i }));

    // Wait for the PATCH to be called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Should not have made the POST call
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
    expect(localStorage.getItem(`feedTimer_lastSide_${BABY.id}`)).toBeNull();
  });

  it("does not update localStorage if POST for new feed fails", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    const { refetch } = setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /→ Right/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(refetch).not.toHaveBeenCalled();
    expect(localStorage.getItem(`feedTimer_lastSide_${BABY.id}`)).toBeNull();
  });

  it("disables switch button while submitting", async () => {
    let resolvePatch;
    global.fetch = vi.fn(() => new Promise((resolve) => { resolvePatch = resolve; }));
    setupDefaults({
      activeFeed: { id: 10, type: "breast_left", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    const user = userEvent.setup();
    render(<FeedTimer />);

    const switchBtn = screen.getByRole("button", { name: /→ Right/i });
    await user.click(switchBtn);

    // Button should be disabled while the request is in flight
    expect(switchBtn).toBeDisabled();

    // Resolve the request to clean up
    resolvePatch({ ok: true, json: () => Promise.resolve({}) });
  });
});

// ---- PAUSED badge in FeedTimer ----

describe("FeedTimer — PAUSED badge display", () => {
  it("shows PAUSED badge when feed is paused", () => {
    setupDefaults({
      activeFeed: {
        id: 10,
        type: "bottle",
        started_at: "2026-03-14T10:00:00Z",
        is_paused: true,
        paused_seconds: 10,
        paused_at: "2026-03-14T10:01:00Z",
      },
      elapsed: "50s",
    });
    render(<FeedTimer />);

    expect(screen.getByText("PAUSED")).toBeInTheDocument();
  });

  it("does not show PAUSED badge when feed is running", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "2m",
    });
    render(<FeedTimer />);

    expect(screen.queryByText("PAUSED")).not.toBeInTheDocument();
  });

  it("does not show PAUSED badge when there is no active feed", () => {
    setupDefaults();
    render(<FeedTimer />);

    expect(screen.queryByText("PAUSED")).not.toBeInTheDocument();
  });
});

// ---- Edge cases ----

describe("FeedTimer — edge cases", () => {
  it("does not call stopFeed when there is no activeFeed", async () => {
    // Render in idle state, verify no stop button at all
    setupDefaults();
    render(<FeedTimer />);

    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  it("handles unknown feed type gracefully in active view", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "unknown_type", started_at: "2026-03-14T10:00:00Z" },
      elapsed: "1m",
    });
    render(<FeedTimer />);

    // Should fall back to showing the raw type
    expect(screen.getByText("unknown_type")).toBeInTheDocument();
  });

  it("handles unknown feed type in the details form", async () => {
    const activeFeed = { id: 10, type: "unknown_type", started_at: "2026-03-14T10:00:00Z" };
    setupDefaults({ activeFeed, elapsed: "1m" });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...activeFeed, ended_at: "2026-03-14T10:01:00Z" }),
      })
    );
    const user = userEvent.setup();
    render(<FeedTimer />);

    await user.click(screen.getByRole("button", { name: /stop/i }));

    await waitFor(() => {
      expect(screen.getByText("unknown_type")).toBeInTheDocument();
    });
  });

  it("passes selectedBaby.id to useActiveEvents", () => {
    setupDefaults();
    render(<FeedTimer />);
    expect(useActiveEvents).toHaveBeenCalledWith(BABY.id);
  });
});
