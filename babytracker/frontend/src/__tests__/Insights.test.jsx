import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));

import Insights from "../components/Insights";
import { useBaby } from "../context/BabyContext";

const BABY = { id: 42, name: "TestBaby", birthdate: "2026-01-01T00:00:00Z" };

function makeInsightsData(overrides = {}) {
  return {
    has_enough_data: true,
    feeds: {
      count_since_midnight: 6,
      average_per_day_this_week: 11,
    },
    sleep: {
      total_last_24h_minutes: 847, // 14h 7m
      nap_count_today: 3,
      longest_night_stretch_minutes: 185, // 3h 5m
    },
    nappies: {
      wet_count_today: 4,
      average_wet_per_day_7day: 6,
      days_since_dirty: 0,
    },
    alerts: [],
    ...overrides,
  };
}

function mockFetch(data) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-22T12:00:00Z"));
  useBaby.mockReturnValue({ selectedBaby: BABY });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---- Loading state ----

describe("Insights - skeleton loading state", () => {
  it("shows skeleton cards while loading", async () => {
    // Never resolve to keep loading state
    global.fetch = vi.fn(() => new Promise(() => {}));

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText("Insights")).toBeInTheDocument();
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(3);
  });

  it("removes skeleton after data loads", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(0);
  });
});

// ---- No render when has_enough_data=false ----

describe("Insights - insufficient data", () => {
  it("renders nothing when has_enough_data is false", async () => {
    mockFetch(makeInsightsData({ has_enough_data: false }));

    const { container } = await act(async () => {
      return render(<Insights />);
    });

    // Should render null — no section, no headings
    expect(screen.queryByText("Insights")).not.toBeInTheDocument();
    expect(container.querySelector("section")).toBeNull();
  });
});

// ---- Feeds card ----

describe("Insights - feeds card", () => {
  it("displays feeds since midnight count", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText(/Feeds since midnight: 6/)).toBeInTheDocument();
  });

  it("displays weekly average per day", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText(/This week avg: 11\/day/)).toBeInTheDocument();
  });

  it("renders different feed values correctly", async () => {
    mockFetch(
      makeInsightsData({
        feeds: { count_since_midnight: 0, average_per_day_this_week: 8 },
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText(/Feeds since midnight: 0/)).toBeInTheDocument();
    expect(screen.getByText(/This week avg: 8\/day/)).toBeInTheDocument();
  });
});

// ---- Sleep card ----

describe("Insights - sleep card", () => {
  it("displays total sleep in hours and minutes", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    // 847 min = 14h 7m
    expect(screen.getByText(/Sleep last 24h: 14h 7m/)).toBeInTheDocument();
  });

  it("displays naps today count", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText(/Naps today: 3/)).toBeInTheDocument();
  });

  it("displays longest night stretch", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    // 185 min = 3h 5m
    expect(
      screen.getByText(/Longest stretch last night: 3h 5m/)
    ).toBeInTheDocument();
  });

  it("formats sleep duration as minutes only when under 60", async () => {
    mockFetch(
      makeInsightsData({
        sleep: {
          total_last_24h_minutes: 45,
          nap_count_today: 1,
          longest_night_stretch_minutes: 30,
        },
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText(/Sleep last 24h: 45m/)).toBeInTheDocument();
    expect(
      screen.getByText(/Longest stretch last night: 30m/)
    ).toBeInTheDocument();
  });

  it("formats 0 minutes correctly", async () => {
    mockFetch(
      makeInsightsData({
        sleep: {
          total_last_24h_minutes: 0,
          nap_count_today: 0,
          longest_night_stretch_minutes: 0,
        },
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText(/Sleep last 24h: 0m/)).toBeInTheDocument();
    expect(screen.getByText(/Naps today: 0/)).toBeInTheDocument();
  });
});

// ---- Nappies card ----

describe("Insights - nappies card", () => {
  it("displays wet nappy count and average", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    expect(
      screen.getByText(/Wet nappies today: 4 \(avg: 6\)/)
    ).toBeInTheDocument();
  });

  it("displays 'today' for dirty nappy when days_since_dirty is 0", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText("today")).toBeInTheDocument();
  });

  it("displays '1 day ago' with amber colour when days_since_dirty is 1", async () => {
    mockFetch(
      makeInsightsData({
        nappies: {
          wet_count_today: 4,
          average_wet_per_day_7day: 6,
          days_since_dirty: 1,
        },
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    const label = screen.getByText("1 day ago");
    expect(label).toBeInTheDocument();
    expect(label.className).toMatch(/amber/);
  });

  it("displays red colour when days_since_dirty is 2", async () => {
    mockFetch(
      makeInsightsData({
        nappies: {
          wet_count_today: 4,
          average_wet_per_day_7day: 6,
          days_since_dirty: 2,
        },
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    const label = screen.getByText("2 days ago");
    expect(label).toBeInTheDocument();
    expect(label.className).toMatch(/red/);
  });

  it("displays red colour when days_since_dirty is 5", async () => {
    mockFetch(
      makeInsightsData({
        nappies: {
          wet_count_today: 2,
          average_wet_per_day_7day: 5,
          days_since_dirty: 5,
        },
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    const label = screen.getByText("5 days ago");
    expect(label).toBeInTheDocument();
    expect(label.className).toMatch(/red/);
  });

  it("displays 'never' when days_since_dirty is 999", async () => {
    mockFetch(
      makeInsightsData({
        nappies: {
          wet_count_today: 3,
          average_wet_per_day_7day: 5,
          days_since_dirty: 999,
        },
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("has no colour class when days_since_dirty is 0", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    const label = screen.getByText("today");
    expect(label.className).not.toMatch(/amber/);
    expect(label.className).not.toMatch(/red/);
  });
});

// ---- Alerts section ----

describe("Insights - alerts", () => {
  it("does not render alerts section when alerts array is empty", async () => {
    mockFetch(makeInsightsData({ alerts: [] }));

    await act(async () => {
      render(<Insights />);
    });

    // No alert chips should exist
    const chips = document.querySelectorAll(".rounded-full");
    expect(chips.length).toBe(0);
  });

  it("renders warning alerts with amber styling", async () => {
    mockFetch(
      makeInsightsData({
        alerts: [{ type: "warning", message: "Low wet nappy count" }],
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    const chip = screen.getByText(/Low wet nappy count/);
    expect(chip).toBeInTheDocument();
    expect(chip.className).toMatch(/amber/);
  });

  it("renders info alerts with blue styling", async () => {
    mockFetch(
      makeInsightsData({
        alerts: [{ type: "info", message: "Sleep improving" }],
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    const chip = screen.getByText(/Sleep improving/);
    expect(chip).toBeInTheDocument();
    expect(chip.className).toMatch(/blue/);
  });

  it("renders multiple alerts together", async () => {
    mockFetch(
      makeInsightsData({
        alerts: [
          { type: "warning", message: "Low wet nappy count" },
          { type: "info", message: "Great sleep stretch!" },
          { type: "warning", message: "No dirty nappy in 2 days" },
        ],
      })
    );

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.getByText(/Low wet nappy count/)).toBeInTheDocument();
    expect(screen.getByText(/Great sleep stretch!/)).toBeInTheDocument();
    expect(screen.getByText(/No dirty nappy in 2 days/)).toBeInTheDocument();
  });
});

// ---- Polling ----

describe("Insights - polling", () => {
  it("fetches insights on mount", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/v1/babies/${BABY.id}/insights`
    );
  });

  it("polls every 5 minutes", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("does not poll at shorter intervals", async () => {
    mockFetch(makeInsightsData());

    await act(async () => {
      render(<Insights />);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance 4 minutes — should not poll yet
    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ---- Edge cases ----

describe("Insights - edge cases", () => {
  it("renders nothing when no baby is selected", async () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    global.fetch = vi.fn();

    const { container } = await act(async () => {
      return render(<Insights />);
    });

    // fetch should not be called without a baby
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("keeps current state when API returns non-ok response", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    );

    const { container } = await act(async () => {
      return render(<Insights />);
    });

    // No data, should not render insight cards
    expect(screen.queryByText(/Feeds since midnight/)).not.toBeInTheDocument();
  });

  it("keeps current state when fetch throws a network error", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    const { container } = await act(async () => {
      return render(<Insights />);
    });

    // Should not crash
    expect(container).toBeTruthy();
  });

  it("renders nothing when insightsData is null after load", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 404 })
    );

    await act(async () => {
      render(<Insights />);
    });

    expect(screen.queryByText("Insights")).not.toBeInTheDocument();
  });

  it("re-fetches when selected baby changes", async () => {
    mockFetch(makeInsightsData());

    const { rerender } = await act(async () => {
      return render(<Insights />);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Change baby
    const BABY2 = { id: 99, name: "Baby2", birthdate: "2026-02-01T00:00:00Z" };
    useBaby.mockReturnValue({ selectedBaby: BABY2 });

    await act(async () => {
      rerender(<Insights />);
    });

    // Should have fetched for the new baby
    const calls = global.fetch.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBe(`/api/v1/babies/${BABY2.id}/insights`);
  });
});
