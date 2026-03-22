import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import {
  WAKE_WINDOWS,
  getThresholdForAge,
  getWakeColour,
} from "../components/WakeWindow";

// ---- Pure function tests: getThresholdForAge ----

describe("getThresholdForAge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first bracket for a newborn (0 weeks)", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-22T12:00:00Z");
    vi.setSystemTime(now);

    // Born today — 0 weeks old
    const result = getThresholdForAge("2026-03-22T00:00:00Z");
    expect(result).toEqual(WAKE_WINDOWS[0]);
    expect(result.maxWeeks).toBe(2);
  });

  it("returns the correct bracket for a 3-week-old", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-22T12:00:00Z");
    vi.setSystemTime(now);

    // Born 3 weeks ago
    const birthdate = new Date(now.getTime() - 3 * 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = getThresholdForAge(birthdate);
    expect(result.maxWeeks).toBe(4);
  });

  it("returns the correct bracket for a 6-week-old", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-22T12:00:00Z");
    vi.setSystemTime(now);

    const birthdate = new Date(now.getTime() - 6 * 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = getThresholdForAge(birthdate);
    expect(result.maxWeeks).toBe(8);
  });

  it("returns the correct bracket for a 10-week-old", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-22T12:00:00Z");
    vi.setSystemTime(now);

    const birthdate = new Date(now.getTime() - 10 * 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = getThresholdForAge(birthdate);
    expect(result.maxWeeks).toBe(13);
  });

  it("returns the last bracket for a very old baby (52+ weeks)", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-22T12:00:00Z");
    vi.setSystemTime(now);

    const birthdate = new Date(now.getTime() - 52 * 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = getThresholdForAge(birthdate);
    expect(result.maxWeeks).toBe(999);
    expect(result.idealMin).toBe(180);
    expect(result.idealMax).toBe(240);
  });

  it("returns the boundary bracket when age is exactly at maxWeeks boundary", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-22T12:00:00Z");
    vi.setSystemTime(now);

    // Exactly 2 weeks old — ageWeeks === 2, so NOT < 2, falls through to next
    const birthdate = new Date(now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = getThresholdForAge(birthdate);
    expect(result.maxWeeks).toBe(4);
  });

  it("covers all WAKE_WINDOWS brackets", () => {
    expect(WAKE_WINDOWS).toHaveLength(9);
    // All entries must have required keys
    for (const entry of WAKE_WINDOWS) {
      expect(entry).toHaveProperty("maxWeeks");
      expect(entry).toHaveProperty("idealMin");
      expect(entry).toHaveProperty("idealMax");
      expect(entry).toHaveProperty("alertAt");
      expect(entry.idealMax).toBeGreaterThan(entry.idealMin);
      expect(entry.alertAt).toBeGreaterThan(entry.idealMax);
    }
  });
});

// ---- Pure function tests: getWakeColour ----

describe("getWakeColour", () => {
  const threshold = { maxWeeks: 13, idealMin: 75, idealMax: 120, alertAt: 135 };

  it("returns green when awake minutes are within ideal range", () => {
    expect(getWakeColour(90, threshold)).toBe("green");
  });

  it("returns green when awake minutes are below ideal range", () => {
    expect(getWakeColour(30, threshold)).toBe("green");
  });

  it("returns green when awake minutes are exactly at idealMax (still under amber)", () => {
    // alertAt - 15 = 120, so 119 is green
    expect(getWakeColour(119, threshold)).toBe("green");
  });

  it("returns amber when awake minutes are within 15 min of alertAt", () => {
    // alertAt = 135, so 120-134 is amber
    expect(getWakeColour(120, threshold)).toBe("amber");
    expect(getWakeColour(130, threshold)).toBe("amber");
    expect(getWakeColour(134, threshold)).toBe("amber");
  });

  it("returns red when awake minutes are at alertAt", () => {
    expect(getWakeColour(135, threshold)).toBe("red");
  });

  it("returns red when awake minutes exceed alertAt", () => {
    expect(getWakeColour(200, threshold)).toBe("red");
  });

  it("returns green for 0 awake minutes", () => {
    expect(getWakeColour(0, threshold)).toBe("green");
  });

  it("returns amber exactly at alertAt - 15", () => {
    expect(getWakeColour(threshold.alertAt - 15, threshold)).toBe("amber");
  });

  it("returns green at alertAt - 16", () => {
    expect(getWakeColour(threshold.alertAt - 16, threshold)).toBe("green");
  });
});

// ---- Component rendering tests ----

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));

import WakeWindow from "../components/WakeWindow";
import { useBaby } from "../context/BabyContext";

const BABY = { id: 42, name: "TestBaby", birthdate: "2026-01-01T00:00:00Z" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-22T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("WakeWindow — sleeping state", () => {
  it("displays 'Sleeping' when the baby is asleep", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: true,
            sleep_started_at: "2026-03-22T10:37:00Z",
            awake_since: null,
            awake_minutes: 0,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(screen.getByText(/sleeping/i)).toBeInTheDocument();
  });

  it("shows correct sleep duration", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    // Sleep started 1h 23m ago from 2026-03-22T12:00:00Z
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: true,
            sleep_started_at: "2026-03-22T10:37:00Z",
            awake_since: null,
            awake_minutes: 0,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(screen.getByText("1h 23m")).toBeInTheDocument();
  });

  it("does not show awake state when sleeping", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: true,
            sleep_started_at: "2026-03-22T11:00:00Z",
            awake_since: null,
            awake_minutes: 0,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(screen.queryByText(/awake for/i)).not.toBeInTheDocument();
  });
});

describe("WakeWindow — awake state", () => {
  it("displays 'Awake for' with correct duration", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    // awake_since 47 minutes ago
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: "2026-03-22T11:13:00Z",
            awake_minutes: 47,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(screen.getByText(/awake for 47m/i)).toBeInTheDocument();
  });

  it("falls back to awake_minutes when awake_since is null", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: null,
            awake_minutes: 30,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(screen.getByText(/awake for 30m/i)).toBeInTheDocument();
  });

  it("does not show sleeping state when awake", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: "2026-03-22T11:30:00Z",
            awake_minutes: 30,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(screen.queryByText(/sleeping/i)).not.toBeInTheDocument();
  });
});

describe("WakeWindow — colour dot", () => {
  it("shows green dot when within ideal range", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    // Baby is ~11.5 weeks old, bracket maxWeeks=13, alertAt=135
    // Awake for 30 min — well under alert
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: "2026-03-22T11:30:00Z",
            awake_minutes: 30,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    const dot = screen.getByRole("button", { name: /wake window status/i });
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveTextContent("\u{1F7E2}"); // green circle
  });

  it("shows red dot when past alert threshold", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    // Baby ~11.5 weeks, alertAt=135. Awake for 140 minutes.
    const awakeSince = new Date("2026-03-22T12:00:00Z");
    awakeSince.setMinutes(awakeSince.getMinutes() - 140);

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: awakeSince.toISOString(),
            awake_minutes: 140,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    const dot = screen.getByRole("button", { name: /wake window status/i });
    expect(dot).toHaveTextContent("\u{1F534}"); // red circle
  });

  it("shows amber dot when within 15 min of alert threshold", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    // Baby ~11.5 weeks, alertAt=135. Awake for 125 minutes (135-15=120, 125 is amber).
    const awakeSince = new Date("2026-03-22T12:00:00Z");
    awakeSince.setMinutes(awakeSince.getMinutes() - 125);

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: awakeSince.toISOString(),
            awake_minutes: 125,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    const dot = screen.getByRole("button", { name: /wake window status/i });
    expect(dot).toHaveTextContent("\u{1F7E1}"); // yellow/amber circle
  });
});

describe("WakeWindow — tooltip", () => {
  it("shows tooltip with ideal range on click", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: null,
            awake_minutes: 30,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    const dot = screen.getByRole("button", { name: /wake window status/i });
    fireEvent.click(dot);

    // Baby is ~11.5 weeks → bracket maxWeeks=13, idealMin=75, idealMax=120
    expect(screen.getByText(/ideal wake window for age/i)).toBeInTheDocument();
    expect(screen.getByText(/75/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });
});

describe("WakeWindow — polling and updates", () => {
  it("fetches wake window data on mount", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: null,
            awake_minutes: 10,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/wake-window`
    );
  });

  it("polls every 60 seconds", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: null,
            awake_minutes: 10,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe("WakeWindow — edge cases", () => {
  it("renders nothing when no baby is selected", async () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    global.fetch = vi.fn();

    const { container } = render(<WakeWindow />);
    expect(container.innerHTML).toBe("");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders nothing when baby has no birthdate", async () => {
    useBaby.mockReturnValue({ selectedBaby: { id: 42, name: "TestBaby" } });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: null,
            awake_minutes: 10,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    // Component returns null when no birthdate
    expect(screen.queryByText(/sleeping/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/awake/i)).not.toBeInTheDocument();
  });

  it("keeps current state when API returns non-ok response", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    );

    const { container } = await act(async () => {
      return render(<WakeWindow />);
    });

    // No data fetched, should render nothing
    expect(container.querySelector("[class*='rounded']")).not.toBeInTheDocument();
  });

  it("keeps current state when fetch throws a network error", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    const { container } = await act(async () => {
      return render(<WakeWindow />);
    });

    // Should not crash
    expect(container).toBeTruthy();
  });

  it("formats duration as hours and minutes when over 60 minutes", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    // Awake for 90 minutes
    const awakeSince = new Date("2026-03-22T12:00:00Z");
    awakeSince.setMinutes(awakeSince.getMinutes() - 90);

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: false,
            sleep_started_at: null,
            awake_since: awakeSince.toISOString(),
            awake_minutes: 90,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(screen.getByText(/1h 30m/)).toBeInTheDocument();
  });

  it("formats sleep duration in hours and minutes for long sleeps", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    // Sleeping for 2h 15m
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            is_sleeping: true,
            sleep_started_at: "2026-03-22T09:45:00Z",
            awake_since: null,
            awake_minutes: 0,
          }),
      })
    );

    await act(async () => {
      render(<WakeWindow />);
    });

    expect(screen.getByText("2h 15m")).toBeInTheDocument();
  });
});
