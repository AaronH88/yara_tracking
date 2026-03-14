import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DayTimeline from "../components/DayTimeline";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2025, 2, 15, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

// ---- Helper factories ----

function makeFeedEvent(overrides = {}) {
  return {
    id: 1,
    event_type: "feed",
    timestamp: "2025-03-15T08:30:00",
    detail: {
      type: "bottle",
      started_at: "2025-03-15T08:30:00",
      ended_at: "2025-03-15T08:45:00",
      amount_oz: 4,
      notes: null,
    },
    ...overrides,
  };
}

function makeSleepEvent(overrides = {}) {
  return {
    id: 2,
    event_type: "sleep",
    timestamp: "2025-03-15T13:00:00",
    detail: {
      type: "nap",
      started_at: "2025-03-15T13:00:00",
      ended_at: "2025-03-15T14:30:00",
      notes: null,
    },
    ...overrides,
  };
}

function makeDiaperEvent(overrides = {}) {
  return {
    id: 3,
    event_type: "diaper",
    timestamp: "2025-03-15T10:00:00",
    detail: {
      type: "wet",
      logged_at: "2025-03-15T10:00:00",
      notes: null,
    },
    ...overrides,
  };
}

function makeMilestoneEvent(overrides = {}) {
  return {
    id: 4,
    event_type: "milestone",
    timestamp: "2025-03-15T00:00:00",
    detail: {
      title: "First smile",
      occurred_at: "2025-03-15",
      notes: null,
    },
    ...overrides,
  };
}

// ---- Loading state ----

describe("DayTimeline — loading state", () => {
  it("shows loading message when loading prop is true", () => {
    render(<DayTimeline events={[]} loading={true} />);
    expect(screen.getByText("Loading events...")).toBeInTheDocument();
  });

  it("does not render events when loading", () => {
    render(<DayTimeline events={[makeFeedEvent()]} loading={true} />);
    expect(screen.getByText("Loading events...")).toBeInTheDocument();
    expect(screen.queryByText("Bottle")).not.toBeInTheDocument();
  });
});

// ---- Empty state ----

describe("DayTimeline — empty state", () => {
  it("shows 'No events this day' when events array is empty", () => {
    render(<DayTimeline events={[]} loading={false} />);
    expect(screen.getByText("No events this day")).toBeInTheDocument();
  });
});

// ---- Feed events ----

describe("DayTimeline — feed events", () => {
  it("renders feed event with correct label", () => {
    render(<DayTimeline events={[makeFeedEvent()]} loading={false} />);
    expect(screen.getByText("Bottle")).toBeInTheDocument();
  });

  it("renders breast_left feed label correctly", () => {
    const ev = makeFeedEvent({
      detail: { type: "breast_left", started_at: "2025-03-15T08:30:00", ended_at: "2025-03-15T08:45:00", amount_oz: null, notes: null },
    });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("Breast L")).toBeInTheDocument();
  });

  it("displays feed duration and amount when provided", () => {
    render(<DayTimeline events={[makeFeedEvent()]} loading={false} />);
    // Duration and amount shown together: "15m · 4oz"
    expect(screen.getByText(/15m/)).toBeInTheDocument();
    expect(screen.getByText(/4oz/)).toBeInTheDocument();
  });

  it("does not show duration for feed without ended_at", () => {
    const ev = makeFeedEvent({
      detail: { type: "bottle", started_at: "2025-03-15T08:30:00", ended_at: null, amount_oz: 4, notes: null },
    });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.queryByText(/\dm/)).not.toBeInTheDocument();
  });
});

// ---- Sleep events ----

describe("DayTimeline — sleep events", () => {
  it("renders sleep event with correct label", () => {
    render(<DayTimeline events={[makeSleepEvent()]} loading={false} />);
    expect(screen.getByText("Nap")).toBeInTheDocument();
  });

  it("renders night sleep label", () => {
    const ev = makeSleepEvent({
      detail: { type: "night", started_at: "2025-03-15T20:00:00", ended_at: "2025-03-16T06:00:00", notes: null },
    });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("Night")).toBeInTheDocument();
  });

  it("displays sleep duration correctly", () => {
    render(<DayTimeline events={[makeSleepEvent()]} loading={false} />);
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
  });

  it("shows start and end time range for sleep events", () => {
    render(<DayTimeline events={[makeSleepEvent()]} loading={false} />);
    // The SleepBar renders "time – time" format
    const timeEl = screen.getByText(/\u2013/);
    expect(timeEl).toBeInTheDocument();
  });

  it("does not show duration bar for sleep without ended_at", () => {
    const ev = makeSleepEvent({
      detail: { type: "nap", started_at: "2025-03-15T13:00:00", ended_at: null, notes: null },
    });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("Nap")).toBeInTheDocument();
    // No duration text should be rendered
    expect(screen.queryByText(/\d+h|\d+m/)).not.toBeInTheDocument();
  });
});

// ---- Diaper events ----

describe("DayTimeline — diaper events", () => {
  it("renders diaper event with correct label", () => {
    render(<DayTimeline events={[makeDiaperEvent()]} loading={false} />);
    expect(screen.getByText("Wet")).toBeInTheDocument();
  });

  it("renders dirty diaper label", () => {
    const ev = makeDiaperEvent({ detail: { type: "dirty", logged_at: "2025-03-15T10:00:00", notes: null } });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("Dirty")).toBeInTheDocument();
  });

  it("renders 'both' diaper label", () => {
    const ev = makeDiaperEvent({ detail: { type: "both", logged_at: "2025-03-15T10:00:00", notes: null } });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("Both")).toBeInTheDocument();
  });
});

// ---- Milestone events ----

describe("DayTimeline — milestone events", () => {
  it("renders milestone event with title", () => {
    render(<DayTimeline events={[makeMilestoneEvent()]} loading={false} />);
    expect(screen.getByText("First smile")).toBeInTheDocument();
  });

  it("falls back to 'Milestone' label when title is missing", () => {
    const ev = makeMilestoneEvent({ detail: { title: null, notes: null } });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("Milestone")).toBeInTheDocument();
  });
});

// ---- Hour grouping ----

describe("DayTimeline — hour grouping and labels", () => {
  it("groups events by hour and displays hour labels", () => {
    const events = [
      makeFeedEvent({ id: 1, timestamp: "2025-03-15T08:30:00" }),
      makeDiaperEvent({ id: 2, timestamp: "2025-03-15T10:00:00" }),
    ];
    render(<DayTimeline events={events} loading={false} />);
    expect(screen.getByText("8 AM")).toBeInTheDocument();
    expect(screen.getByText("10 AM")).toBeInTheDocument();
  });

  it("displays 12 AM for midnight events", () => {
    const ev = makeMilestoneEvent({ timestamp: "2025-03-15T00:15:00" });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("12 AM")).toBeInTheDocument();
  });

  it("displays 12 PM for noon events", () => {
    const ev = makeFeedEvent({ timestamp: "2025-03-15T12:30:00" });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("12 PM")).toBeInTheDocument();
  });

  it("displays PM for afternoon events", () => {
    const ev = makeSleepEvent({ timestamp: "2025-03-15T15:00:00" });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("3 PM")).toBeInTheDocument();
  });

  it("renders multiple events in same hour together", () => {
    const events = [
      makeFeedEvent({ id: 1, timestamp: "2025-03-15T08:00:00" }),
      makeDiaperEvent({ id: 2, timestamp: "2025-03-15T08:30:00" }),
    ];
    render(<DayTimeline events={events} loading={false} />);
    // Both should be present, and only one "8 AM" label
    expect(screen.getByText("Bottle")).toBeInTheDocument();
    expect(screen.getByText("Wet")).toBeInTheDocument();
    expect(screen.getAllByText("8 AM")).toHaveLength(1);
  });

  it("orders hour groups chronologically", () => {
    const events = [
      makeDiaperEvent({ id: 2, timestamp: "2025-03-15T14:00:00" }),
      makeFeedEvent({ id: 1, timestamp: "2025-03-15T08:00:00" }),
    ];
    render(<DayTimeline events={events} loading={false} />);
    const hourLabels = screen.getAllByText(/AM|PM/);
    // "8 AM" should come before "2 PM"
    const texts = hourLabels.map((el) => el.textContent);
    expect(texts.indexOf("8 AM")).toBeLessThan(texts.indexOf("2 PM"));
  });
});

// ---- Overlapping events ----

describe("DayTimeline — overlapping events", () => {
  it("offsets overlapping non-sleep events with marginLeft", () => {
    const events = [
      makeFeedEvent({ id: 1, timestamp: "2025-03-15T08:00:00" }),
      makeDiaperEvent({ id: 2, timestamp: "2025-03-15T08:00:00" }),
    ];
    render(<DayTimeline events={events} loading={false} />);
    const buttons = screen.getAllByRole("button");
    // At least one button should have marginLeft for overlap offset
    const hasOffset = buttons.some(
      (btn) => btn.style.marginLeft && btn.style.marginLeft !== ""
    );
    expect(hasOffset).toBe(true);
  });

  it("does not offset non-overlapping events", () => {
    const events = [
      makeFeedEvent({ id: 1, timestamp: "2025-03-15T08:00:00" }),
      makeDiaperEvent({ id: 2, timestamp: "2025-03-15T14:00:00" }),
    ];
    render(<DayTimeline events={events} loading={false} />);
    const buttons = screen.getAllByRole("button");
    const hasOffset = buttons.some(
      (btn) => btn.style.marginLeft && btn.style.marginLeft !== ""
    );
    expect(hasOffset).toBe(false);
  });
});

// ---- onEventTap callback ----

describe("DayTimeline — tapping events", () => {
  it("calls onEventTap when a feed event is tapped", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const ev = makeFeedEvent();
    render(<DayTimeline events={[ev]} loading={false} onEventTap={onTap} />);

    await user.click(screen.getByText("Bottle").closest("button"));

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(ev);
  });

  it("calls onEventTap when a sleep event is tapped", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const ev = makeSleepEvent();
    render(<DayTimeline events={[ev]} loading={false} onEventTap={onTap} />);

    await user.click(screen.getByText("Nap").closest("button"));

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(ev);
  });

  it("calls onEventTap when a diaper event is tapped", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const ev = makeDiaperEvent();
    render(<DayTimeline events={[ev]} loading={false} onEventTap={onTap} />);

    await user.click(screen.getByText("Wet").closest("button"));

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(ev);
  });

  it("calls onEventTap when a milestone event is tapped", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const ev = makeMilestoneEvent();
    render(<DayTimeline events={[ev]} loading={false} onEventTap={onTap} />);

    await user.click(screen.getByText("First smile").closest("button"));

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(ev);
  });

  it("renders buttons even when onEventTap is not provided", () => {
    render(<DayTimeline events={[makeFeedEvent()]} loading={false} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});

// ---- Mixed event types ----

describe("DayTimeline — mixed event types rendering", () => {
  it("renders all four event types together", () => {
    const events = [
      makeFeedEvent({ id: 1, timestamp: "2025-03-15T08:00:00" }),
      makeSleepEvent({ id: 2, timestamp: "2025-03-15T13:00:00" }),
      makeDiaperEvent({ id: 3, timestamp: "2025-03-15T10:00:00" }),
      makeMilestoneEvent({ id: 4, timestamp: "2025-03-15T00:00:00" }),
    ];
    render(<DayTimeline events={events} loading={false} />);
    expect(screen.getByText("Bottle")).toBeInTheDocument();
    expect(screen.getByText("Nap")).toBeInTheDocument();
    expect(screen.getByText("Wet")).toBeInTheDocument();
    expect(screen.getByText("First smile")).toBeInTheDocument();
  });

  it("renders sleep events as SleepBar (with duration bar) and others as EventMarker", () => {
    const events = [
      makeFeedEvent({ id: 1, timestamp: "2025-03-15T08:00:00" }),
      makeSleepEvent({ id: 2, timestamp: "2025-03-15T13:00:00" }),
    ];
    render(<DayTimeline events={events} loading={false} />);
    // Sleep event should show time range with en-dash
    expect(screen.getByText(/\u2013/)).toBeInTheDocument();
    // Feed event should show the extra info (duration + amount)
    expect(screen.getByText(/4oz/)).toBeInTheDocument();
  });
});

// ---- Edge cases ----

describe("DayTimeline — edge cases", () => {
  it("handles event with missing detail gracefully", () => {
    const ev = { id: 99, event_type: "feed", timestamp: "2025-03-15T09:00:00" };
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("Feed")).toBeInTheDocument();
  });

  it("handles unknown event type gracefully", () => {
    const ev = {
      id: 100,
      event_type: "unknown_type",
      timestamp: "2025-03-15T09:00:00",
      detail: {},
    };
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("unknown_type")).toBeInTheDocument();
  });

  it("renders short durations as '<1m'", () => {
    const ev = makeFeedEvent({
      detail: {
        type: "bottle",
        started_at: "2025-03-15T08:30:00",
        ended_at: "2025-03-15T08:30:30",
        amount_oz: null,
        notes: null,
      },
    });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("<1m")).toBeInTheDocument();
  });

  it("renders multi-hour durations correctly", () => {
    const ev = makeSleepEvent({
      detail: {
        type: "night",
        started_at: "2025-03-15T20:00:00",
        ended_at: "2025-03-16T04:30:00",
        notes: null,
      },
    });
    render(<DayTimeline events={[ev]} loading={false} />);
    expect(screen.getByText("8h 30m")).toBeInTheDocument();
  });
});
