import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));

vi.mock("../components/DayTimeline", () => ({
  default: ({ events, loading }) => (
    <div data-testid="day-timeline">
      {loading && <span>timeline-loading</span>}
      {!loading && events.length === 0 && <span>no-events</span>}
      {!loading &&
        events.map((ev) => (
          <span key={ev.id} data-testid={`event-${ev.id}`}>
            {ev.event_type}
          </span>
        ))}
    </div>
  ),
}));

import Calendar from "../pages/Calendar";
import { useBaby } from "../context/BabyContext";

const BABY = { id: 7, name: "TestBaby" };

function monthDataWith(entries) {
  const data = {};
  for (const [key, val] of Object.entries(entries)) {
    data[key] = val;
  }
  return data;
}

function mockFetch({ monthData = {}, dayEvents = [], monthOk = true, dayOk = true } = {}) {
  return vi.fn((url) => {
    if (url.includes("/calendar/month")) {
      return Promise.resolve({
        ok: monthOk,
        json: () => Promise.resolve(monthData),
      });
    }
    if (url.includes("/calendar/day")) {
      return Promise.resolve({
        ok: dayOk,
        json: () => Promise.resolve(dayEvents),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Fix "today" to 2025-03-15 so tests are deterministic
  vi.setSystemTime(new Date(2025, 2, 15, 12, 0, 0));
  useBaby.mockReturnValue({ selectedBaby: BABY });
  global.fetch = mockFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---- No baby selected ----

describe("Calendar — no baby selected", () => {
  it("shows 'No baby selected' when selectedBaby is null", () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    render(<Calendar />);
    expect(screen.getByText(/no baby selected/i)).toBeInTheDocument();
  });

  it("does not fetch calendar data when no baby is selected", () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    render(<Calendar />);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ---- Month/year header and navigation ----

describe("Calendar — month header and navigation", () => {
  it("displays current month and year in header", async () => {
    render(<Calendar />);
    await waitFor(() => {
      expect(screen.getByText("March 2025")).toBeInTheDocument();
    });
  });

  it("renders prev and next month navigation buttons", () => {
    render(<Calendar />);
    expect(screen.getByLabelText("Previous month")).toBeInTheDocument();
    expect(screen.getByLabelText("Next month")).toBeInTheDocument();
  });

  it("navigates to previous month when prev button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(screen.getByLabelText("Previous month"));

    expect(screen.getByText("February 2025")).toBeInTheDocument();
  });

  it("navigates to next month when next button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(screen.getByLabelText("Next month"));

    expect(screen.getByText("April 2025")).toBeInTheDocument();
  });

  it("wraps from January to previous year December when going back", async () => {
    // Start on January 2025 by navigating back from March
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Go back 3 months: March -> Feb -> Jan -> Dec 2024
    await user.click(screen.getByLabelText("Previous month"));
    await user.click(screen.getByLabelText("Previous month"));
    await user.click(screen.getByLabelText("Previous month"));

    expect(screen.getByText("December 2024")).toBeInTheDocument();
  });

  it("wraps from December to next year January when going forward", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Go forward 10 months: March -> ... -> January 2026
    for (let i = 0; i < 10; i++) {
      await user.click(screen.getByLabelText("Next month"));
    }

    expect(screen.getByText("January 2026")).toBeInTheDocument();
  });
});

// ---- Weekday headers ----

describe("Calendar — weekday headers", () => {
  it("renders Sun through Sat headers", () => {
    render(<Calendar />);
    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });
});

// ---- Calendar grid ----

describe("Calendar — grid layout", () => {
  it("renders correct number of day cells for March 2025 (31 days)", async () => {
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // March 2025 has 31 days
    for (let d = 1; d <= 31; d++) {
      expect(screen.getByText(String(d))).toBeInTheDocument();
    }
  });

  it("highlights today's date", async () => {
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Day 15 should have the blue highlight class
    const todayButton = screen.getByText("15");
    expect(todayButton.className).toMatch(/bg-blue-600/);
  });

  it("does not highlight non-today dates with today styling", async () => {
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const day10 = screen.getByText("10");
    expect(day10.className).not.toMatch(/bg-blue-600/);
  });
});

// ---- Event dots ----

describe("Calendar — event dots", () => {
  it("shows blue dot for days with feed events", async () => {
    global.fetch = mockFetch({
      monthData: {
        "2025-03-10": { feed_count: 3, sleep_count: 0, diaper_count: 0, has_milestone: false },
      },
    });
    render(<Calendar />);

    await waitFor(() => {
      const day10Button = screen.getByText("10").closest("button");
      const blueDot = day10Button.querySelector(".bg-blue-500");
      expect(blueDot).not.toBeNull();
    });
  });

  it("shows purple dot for days with sleep events", async () => {
    global.fetch = mockFetch({
      monthData: {
        "2025-03-12": { feed_count: 0, sleep_count: 2, diaper_count: 0, has_milestone: false },
      },
    });
    render(<Calendar />);

    await waitFor(() => {
      const dayButton = screen.getByText("12").closest("button");
      const purpleDot = dayButton.querySelector(".bg-purple-500");
      expect(purpleDot).not.toBeNull();
    });
  });

  it("shows yellow dot for days with diaper events", async () => {
    global.fetch = mockFetch({
      monthData: {
        "2025-03-12": { feed_count: 0, sleep_count: 0, diaper_count: 4, has_milestone: false },
      },
    });
    render(<Calendar />);

    await waitFor(() => {
      const dayButton = screen.getByText("12").closest("button");
      const yellowDot = dayButton.querySelector(".bg-yellow-500");
      expect(yellowDot).not.toBeNull();
    });
  });

  it("shows milestone star for days with milestones", async () => {
    global.fetch = mockFetch({
      monthData: {
        "2025-03-05": { feed_count: 0, sleep_count: 0, diaper_count: 0, has_milestone: true },
      },
    });
    render(<Calendar />);

    await waitFor(() => {
      const dayButton = screen.getByText("5").closest("button");
      expect(dayButton.textContent).toContain("⭐");
    });
  });

  it("shows multiple dots when multiple event types exist on a day", async () => {
    global.fetch = mockFetch({
      monthData: {
        "2025-03-08": { feed_count: 2, sleep_count: 1, diaper_count: 3, has_milestone: false },
      },
    });
    render(<Calendar />);

    await waitFor(() => {
      const dayButton = screen.getByText("8").closest("button");
      expect(dayButton.querySelector(".bg-blue-500")).not.toBeNull();
      expect(dayButton.querySelector(".bg-purple-500")).not.toBeNull();
      expect(dayButton.querySelector(".bg-yellow-500")).not.toBeNull();
    });
  });

  it("shows no dots for days without events", async () => {
    global.fetch = mockFetch({ monthData: {} });
    render(<Calendar />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const dayButton = screen.getByText("20").closest("button");
    expect(dayButton.querySelector(".bg-blue-500")).toBeNull();
    expect(dayButton.querySelector(".bg-purple-500")).toBeNull();
    expect(dayButton.querySelector(".bg-yellow-500")).toBeNull();
  });
});

// ---- Day selection & timeline ----

describe("Calendar — day selection and timeline", () => {
  it("shows day timeline when a day is clicked", async () => {
    const dayEvents = [
      { id: 1, event_type: "feed", timestamp: "2025-03-10T08:00:00Z" },
    ];
    global.fetch = mockFetch({ dayEvents });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(screen.getByText("10").closest("button"));

    await waitFor(() => {
      expect(screen.getByTestId("day-timeline")).toBeInTheDocument();
    });
  });

  it("fetches day events from correct API endpoint on day click", async () => {
    global.fetch = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(screen.getByText("10").closest("button"));

    await waitFor(() => {
      const dayCalls = global.fetch.mock.calls.filter(([url]) =>
        url.includes("/calendar/day")
      );
      expect(dayCalls.length).toBeGreaterThanOrEqual(1);
      expect(dayCalls[0][0]).toBe(
        `/api/v1/babies/${BABY.id}/calendar/day?date=2025-03-10`
      );
    });
  });

  it("hides day timeline when same day is clicked again (toggle)", async () => {
    global.fetch = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const dayBtn = screen.getByText("10").closest("button");
    await user.click(dayBtn);
    await waitFor(() => {
      expect(screen.getByTestId("day-timeline")).toBeInTheDocument();
    });

    await user.click(dayBtn);
    expect(screen.queryByTestId("day-timeline")).not.toBeInTheDocument();
  });

  it("shows selected day date heading when a day is selected", async () => {
    global.fetch = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(screen.getByText("10").closest("button"));

    await waitFor(() => {
      // Should display a formatted date heading with the day number
      expect(screen.getByText(/march.*10|10.*march/i)).toBeInTheDocument();
    });
  });

  it("clears selected day when navigating to a different month", async () => {
    global.fetch = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(screen.getByText("10").closest("button"));
    await waitFor(() => {
      expect(screen.getByTestId("day-timeline")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Next month"));

    expect(screen.queryByTestId("day-timeline")).not.toBeInTheDocument();
  });

  it("applies selected styling to clicked day", async () => {
    global.fetch = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const dayBtn = screen.getByText("10").closest("button");
    await user.click(dayBtn);

    expect(dayBtn.className).toMatch(/bg-blue-100|bg-blue-900/);
  });
});

// ---- Loading state ----

describe("Calendar — loading state", () => {
  it("shows Loading... while fetching month data", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));
    render(<Calendar />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});

// ---- API integration ----

describe("Calendar — API integration", () => {
  it("fetches month data with correct year and month parameters", async () => {
    global.fetch = mockFetch();
    render(<Calendar />);

    await waitFor(() => {
      const monthCalls = global.fetch.mock.calls.filter(([url]) =>
        url.includes("/calendar/month")
      );
      expect(monthCalls.length).toBeGreaterThanOrEqual(1);
      expect(monthCalls[0][0]).toBe(
        `/api/v1/babies/${BABY.id}/calendar/month?year=2025&month=3`
      );
    });
  });

  it("refetches month data when navigating to a different month", async () => {
    global.fetch = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const initialCalls = global.fetch.mock.calls.length;

    await user.click(screen.getByLabelText("Next month"));

    await waitFor(() => {
      const monthCalls = global.fetch.mock.calls
        .filter(([url]) => url.includes("/calendar/month"));
      // Should have at least 2 month calls (initial + after nav)
      expect(monthCalls.length).toBeGreaterThanOrEqual(2);
      // The second call should be for April
      const aprilCall = monthCalls.find(([url]) => url.includes("month=4"));
      expect(aprilCall).toBeDefined();
    });
  });

  it("handles month API failure gracefully without crashing", async () => {
    global.fetch = mockFetch({ monthOk: false });
    render(<Calendar />);

    // Should render the grid without dots, no crash
    await waitFor(() => {
      expect(screen.getByText("15")).toBeInTheDocument();
    });
  });

  it("handles day API failure gracefully without crashing", async () => {
    global.fetch = mockFetch({ dayOk: false });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Calendar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(screen.getByText("10").closest("button"));

    // Should still show timeline area without crash
    await waitFor(() => {
      expect(screen.getByTestId("day-timeline")).toBeInTheDocument();
    });
  });

  it("uses baby ID in calendar API endpoints", async () => {
    global.fetch = mockFetch();
    render(<Calendar />);

    await waitFor(() => {
      const urls = global.fetch.mock.calls.map(([url]) => url);
      expect(
        urls.some((u) => u.includes(`/babies/${BABY.id}/calendar/month`))
      ).toBe(true);
    });
  });
});
