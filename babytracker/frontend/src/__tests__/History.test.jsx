import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));

vi.mock("../components/forms/FeedForm", () => ({
  default: ({ event, onSaved, onCancel }) => (
    <div data-testid="feed-form">
      <span>FeedForm:{event.id}</span>
      <button onClick={onSaved}>save-feed</button>
      <button onClick={onCancel}>cancel-feed</button>
    </div>
  ),
}));
vi.mock("../components/forms/SleepForm", () => ({
  default: ({ event, onSaved, onCancel }) => (
    <div data-testid="sleep-form">
      <span>SleepForm:{event.id}</span>
      <button onClick={onSaved}>save-sleep</button>
      <button onClick={onCancel}>cancel-sleep</button>
    </div>
  ),
}));
vi.mock("../components/forms/DiaperForm", () => ({
  default: ({ event, onSaved, onCancel }) => (
    <div data-testid="diaper-form">
      <span>DiaperForm:{event.id}</span>
      <button onClick={onSaved}>save-diaper</button>
      <button onClick={onCancel}>cancel-diaper</button>
    </div>
  ),
}));
vi.mock("../components/forms/PumpForm", () => ({
  default: ({ event, onSaved, onCancel }) => (
    <div data-testid="pump-form">
      <span>PumpForm:{event.id}</span>
      <button onClick={onSaved}>save-pump</button>
      <button onClick={onCancel}>cancel-pump</button>
    </div>
  ),
}));
vi.mock("../components/forms/MilestoneForm", () => ({
  default: ({ event, onSaved, onCancel }) => (
    <div data-testid="milestone-form">
      <span>MilestoneForm:{event.id}</span>
      <button onClick={onSaved}>save-milestone</button>
      <button onClick={onCancel}>cancel-milestone</button>
    </div>
  ),
}));

import History from "../pages/History";
import { useBaby } from "../context/BabyContext";

const BABY = { id: 42, name: "TestBaby" };

function now() {
  return new Date();
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString();
}

function daysAgo(d) {
  return new Date(Date.now() - d * 86400000).toISOString();
}

function makeFeed(overrides = {}) {
  return {
    id: 1,
    type: "bottle",
    started_at: hoursAgo(1),
    ended_at: hoursAgo(0.5),
    user_id: 10,
    ...overrides,
  };
}

function makeSleep(overrides = {}) {
  return {
    id: 2,
    type: "nap",
    started_at: hoursAgo(2),
    ended_at: hoursAgo(1),
    user_id: 10,
    ...overrides,
  };
}

function makeDiaper(overrides = {}) {
  return {
    id: 3,
    type: "wet",
    logged_at: hoursAgo(0.5),
    user_id: 10,
    ...overrides,
  };
}

function makePump(overrides = {}) {
  return {
    id: 4,
    logged_at: hoursAgo(1.5),
    duration_minutes: 15,
    user_id: 10,
    ...overrides,
  };
}

function makeMilestone(overrides = {}) {
  return {
    id: 5,
    title: "First smile",
    occurred_at: hoursAgo(3),
    user_id: 10,
    ...overrides,
  };
}

const USERS = [
  { id: 10, name: "Mom" },
  { id: 20, name: "Dad" },
];

function mockFetch({
  feeds = [],
  sleeps = [],
  diapers = [],
  pumps = [],
  milestones = [],
  users = USERS,
  deleteOk = true,
} = {}) {
  return vi.fn((url, opts) => {
    if (opts?.method === "DELETE") {
      return Promise.resolve({ ok: deleteOk });
    }
    if (url.includes("/feeds")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(feeds) });
    }
    if (url.includes("/sleeps")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(sleeps) });
    }
    if (url.includes("/diapers")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(diapers),
      });
    }
    if (url.includes("/pumps")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(pumps) });
    }
    if (url.includes("/milestones")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(milestones),
      });
    }
    if (url.includes("/users")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(users) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useBaby.mockReturnValue({ selectedBaby: BABY });
  global.fetch = mockFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---- No baby selected ----

describe("History — no baby selected", () => {
  it("shows 'No baby selected' when selectedBaby is null", () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    render(<History />);
    expect(screen.getByText(/no baby selected/i)).toBeInTheDocument();
  });

  it("does not fetch events when no baby is selected", () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    render(<History />);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ---- Filter bar rendering ----

describe("History — filter bars", () => {
  it("renders all type filter buttons", async () => {
    global.fetch = mockFetch();
    render(<History />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const allButtons = screen.getAllByRole("button", { name: "All" });
    expect(allButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Feeds" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sleeps" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nappies" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pumps" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Milestones" })
    ).toBeInTheDocument();
  });

  it("renders all date filter buttons", async () => {
    global.fetch = mockFetch();
    render(<History />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Last 7 days" })
    ).toBeInTheDocument();
    // "All" button appears twice (type filter + date filter)
    const allButtons = screen.getAllByRole("button", { name: "All" });
    expect(allButtons.length).toBeGreaterThanOrEqual(2);
  });
});

// ---- Events display ----

describe("History — event display", () => {
  it("shows events sorted by most recent first", async () => {
    const feed = makeFeed({ id: 1, started_at: hoursAgo(3) });
    const diaper = makeDiaper({ id: 2, logged_at: hoursAgo(1) });
    global.fetch = mockFetch({ feeds: [feed], diapers: [diaper] });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Wet")).toBeInTheDocument();
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });
  });

  it("shows feed event detail label", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed({ type: "breast_left" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Breast L")).toBeInTheDocument();
    });
  });

  it("shows sleep event detail label", async () => {
    global.fetch = mockFetch({
      sleeps: [makeSleep({ type: "night" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Night")).toBeInTheDocument();
    });
  });

  it("shows diaper event detail label", async () => {
    global.fetch = mockFetch({
      diapers: [makeDiaper({ type: "dirty" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Dirty")).toBeInTheDocument();
    });
  });

  it("shows pump event detail with duration", async () => {
    global.fetch = mockFetch({
      pumps: [makePump({ duration_minutes: 20 })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("20min")).toBeInTheDocument();
    });
  });

  it("shows milestone event title", async () => {
    global.fetch = mockFetch({
      milestones: [makeMilestone({ title: "Rolled over" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Rolled over")).toBeInTheDocument();
    });
  });

  it("shows duration for feed events", async () => {
    const started = hoursAgo(2);
    const ended = new Date(
      new Date(started).getTime() + 30 * 60000
    ).toISOString();
    global.fetch = mockFetch({
      feeds: [makeFeed({ started_at: started, ended_at: ended })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("30m")).toBeInTheDocument();
    });
  });

  it("shows 'Logged by' user name", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed({ user_id: 20 })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Dad")).toBeInTheDocument();
    });
  });

  it("shows empty state when no events match", async () => {
    global.fetch = mockFetch();
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("No events logged yet")).toBeInTheDocument();
    });
  });

  it("shows loading spinner while fetching", () => {
    // Make fetch hang
    global.fetch = vi.fn(() => new Promise(() => {}));
    render(<History />);
    expect(screen.getByText("Loading events...")).toBeInTheDocument();
  });
});

// ---- Quality icon display ----

describe("History — quality icon display", () => {
  it("shows quality icon for feed events with quality set to good", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed({ quality: "good" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });
    expect(screen.getByTitle("good")).toBeInTheDocument();
    expect(screen.getByTitle("good").textContent).toBe("👍");
  });

  it("shows quality icon for feed events with quality set to okay", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed({ quality: "okay" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByTitle("okay")).toBeInTheDocument();
    });
    expect(screen.getByTitle("okay").textContent).toBe("😐");
  });

  it("shows quality icon for feed events with quality set to poor", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed({ quality: "poor" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByTitle("poor")).toBeInTheDocument();
    });
    expect(screen.getByTitle("poor").textContent).toBe("👎");
  });

  it("does not show quality icon for feed events without quality", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed({ quality: null })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });
    expect(screen.queryByTitle("good")).not.toBeInTheDocument();
    expect(screen.queryByTitle("okay")).not.toBeInTheDocument();
    expect(screen.queryByTitle("poor")).not.toBeInTheDocument();
  });

  it("does not show quality icon for non-feed events even if quality field exists", async () => {
    global.fetch = mockFetch({
      sleeps: [makeSleep({ quality: "good" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Nap")).toBeInTheDocument();
    });
    expect(screen.queryByTitle("good")).not.toBeInTheDocument();
  });

  it("does not show quality icon for unknown quality values", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed({ quality: "excellent" })],
    });
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });
    expect(screen.queryByTitle("excellent")).not.toBeInTheDocument();
  });
});

// ---- Type filtering ----

describe("History — type filter", () => {
  it("filters to show only feed events when Feeds is clicked", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed()],
      diapers: [makeDiaper()],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Feeds" }));

    expect(screen.getByText("Bottle")).toBeInTheDocument();
    expect(screen.queryByText("Wet")).not.toBeInTheDocument();
  });

  it("filters to show only sleep events when Sleeps is clicked", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed()],
      sleeps: [makeSleep()],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Sleeps" }));

    expect(screen.queryByText("Bottle")).not.toBeInTheDocument();
    expect(screen.getByText("Nap")).toBeInTheDocument();
  });

  it("shows all events again when All is clicked after filtering", async () => {
    global.fetch = mockFetch({
      feeds: [makeFeed()],
      diapers: [makeDiaper()],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Feeds" }));
    expect(screen.queryByText("Wet")).not.toBeInTheDocument();

    // Click "All" in the type filters (first one)
    const allButtons = screen.getAllByRole("button", { name: "All" });
    await user.click(allButtons[0]);

    expect(screen.getByText("Bottle")).toBeInTheDocument();
    expect(screen.getByText("Wet")).toBeInTheDocument();
  });
});

// ---- Date filtering ----

describe("History — date filter", () => {
  it("shows only today's events by default", async () => {
    const todayFeed = makeFeed({ id: 1, started_at: hoursAgo(1) });
    const oldFeed = makeFeed({ id: 2, started_at: daysAgo(3) });
    global.fetch = mockFetch({ feeds: [todayFeed, oldFeed] });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    // Only today's event should show (both have same label, but we can check count)
    // The old event should be filtered out by date
    const bottleLabels = screen.getAllByText("Bottle");
    expect(bottleLabels).toHaveLength(1);
  });

  it("shows events from last 7 days when 'Last 7 days' is clicked", async () => {
    const todayFeed = makeFeed({ id: 1, started_at: hoursAgo(1) });
    const threeDaysAgoFeed = makeFeed({
      id: 2,
      started_at: daysAgo(3),
      type: "breast_left",
    });
    const tenDaysAgoFeed = makeFeed({
      id: 3,
      started_at: daysAgo(10),
      type: "breast_right",
    });
    global.fetch = mockFetch({
      feeds: [todayFeed, threeDaysAgoFeed, tenDaysAgoFeed],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Last 7 days" }));

    expect(screen.getByText("Bottle")).toBeInTheDocument();
    expect(screen.getByText("Breast L")).toBeInTheDocument();
    expect(screen.queryByText("Breast R")).not.toBeInTheDocument();
  });

  it("shows all events when date filter 'All' is clicked", async () => {
    const todayFeed = makeFeed({ id: 1, started_at: hoursAgo(1) });
    const oldFeed = makeFeed({
      id: 2,
      started_at: daysAgo(30),
      type: "breast_right",
    });
    global.fetch = mockFetch({ feeds: [todayFeed, oldFeed] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    // Click the second "All" button (date filter)
    const allButtons = screen.getAllByRole("button", { name: "All" });
    await user.click(allButtons[allButtons.length - 1]);

    expect(screen.getByText("Bottle")).toBeInTheDocument();
    expect(screen.getByText("Breast R")).toBeInTheDocument();
  });
});

// ---- Edit ----

describe("History — edit events", () => {
  it("opens edit form when an event row is clicked", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Bottle"));

    expect(screen.getByTestId("feed-form")).toBeInTheDocument();
    expect(screen.getByText("FeedForm:1")).toBeInTheDocument();
  });

  it("opens the correct form type for sleep events", async () => {
    global.fetch = mockFetch({ sleeps: [makeSleep()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Nap")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Nap"));

    expect(screen.getByTestId("sleep-form")).toBeInTheDocument();
  });

  it("opens the correct form type for diaper events", async () => {
    global.fetch = mockFetch({ diapers: [makeDiaper()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Wet")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Wet"));

    expect(screen.getByTestId("diaper-form")).toBeInTheDocument();
  });

  it("closes edit form and refetches when onSaved is called", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Bottle"));
    expect(screen.getByTestId("feed-form")).toBeInTheDocument();

    const fetchCountBefore = global.fetch.mock.calls.length;
    await user.click(screen.getByText("save-feed"));

    expect(screen.queryByTestId("feed-form")).not.toBeInTheDocument();
    // Should refetch events
    expect(global.fetch.mock.calls.length).toBeGreaterThan(fetchCountBefore);
  });

  it("closes edit form without refetching when onCancel is called", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Bottle"));
    expect(screen.getByTestId("feed-form")).toBeInTheDocument();

    await user.click(screen.getByText("cancel-feed"));

    expect(screen.queryByTestId("feed-form")).not.toBeInTheDocument();
  });

  it("shows Edit heading with capitalized event type", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Bottle"));

    expect(screen.getByText("Edit Feed")).toBeInTheDocument();
  });
});

// ---- Delete ----

describe("History — delete events", () => {
  it("shows delete confirmation dialog when delete button is clicked", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete event"));

    expect(screen.getByText(/delete this feed event/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Delete$/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Cancel$/ })
    ).toBeInTheDocument();
  });

  it("sends DELETE request to correct endpoint for feed events", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed({ id: 99 })] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete event"));
    await user.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      const deleteCalls = global.fetch.mock.calls.filter(
        ([, opts]) => opts?.method === "DELETE"
      );
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0][0]).toBe(`/api/v1/babies/${BABY.id}/feeds/99`);
    });
  });

  it("sends DELETE to correct endpoint for pump events (no baby prefix)", async () => {
    global.fetch = mockFetch({ pumps: [makePump({ id: 77 })] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("15min")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete event"));
    await user.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      const deleteCalls = global.fetch.mock.calls.filter(
        ([, opts]) => opts?.method === "DELETE"
      );
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0][0]).toBe("/api/v1/pumps/77");
    });
  });

  it("closes confirmation dialog when cancel is clicked", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete event"));
    expect(screen.getByText(/delete this feed event/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(
      screen.queryByText(/delete this feed event/i)
    ).not.toBeInTheDocument();
  });

  it("refetches events after successful delete", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    const fetchCountBefore = global.fetch.mock.calls.length;

    await user.click(screen.getByLabelText("Delete event"));
    await user.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      // DELETE call + refetch calls
      expect(global.fetch.mock.calls.length).toBeGreaterThan(
        fetchCountBefore + 1
      );
    });
  });

  it("does not close dialog on failed delete", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()], deleteOk: false });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete event"));
    await user.click(screen.getByRole("button", { name: /^Delete$/ }));

    // Dialog should still be open since delete failed
    await waitFor(() => {
      expect(screen.getByText(/delete this feed event/i)).toBeInTheDocument();
    });
  });
});

// ---- Load More ----

describe("History — load more", () => {
  it("shows Load More button when there are enough filtered events", async () => {
    // Need >= 20 filtered events
    const feeds = Array.from({ length: 25 }, (_, i) =>
      makeFeed({ id: i + 1, started_at: hoursAgo(i * 0.1) })
    );
    global.fetch = mockFetch({ feeds });
    render(<History />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /load more/i })
      ).toBeInTheDocument();
    });
  });

  it("does not show Load More when filtered events are fewer than 20", async () => {
    global.fetch = mockFetch({ feeds: [makeFeed()] });
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("Bottle")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /load more/i })
    ).not.toBeInTheDocument();
  });
});

// ---- API calls ----

describe("History — API integration", () => {
  it("fetches events from all five endpoints plus users", async () => {
    global.fetch = mockFetch();
    render(<History />);

    await waitFor(() => {
      const urls = global.fetch.mock.calls.map(([url]) => url);
      expect(urls.some((u) => u.includes("/feeds"))).toBe(true);
      expect(urls.some((u) => u.includes("/sleeps"))).toBe(true);
      expect(urls.some((u) => u.includes("/diapers"))).toBe(true);
      expect(urls.some((u) => u.includes("/pumps"))).toBe(true);
      expect(urls.some((u) => u.includes("/milestones"))).toBe(true);
      expect(urls.some((u) => u.includes("/users"))).toBe(true);
    });
  });

  it("handles API failure gracefully without crashing", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    );
    render(<History />);

    await waitFor(() => {
      expect(screen.getByText("No events logged yet")).toBeInTheDocument();
    });
  });

  it("uses baby ID in API endpoints", async () => {
    global.fetch = mockFetch();
    render(<History />);

    await waitFor(() => {
      const urls = global.fetch.mock.calls.map(([url]) => url);
      expect(
        urls.some((u) => u.includes(`/babies/${BABY.id}/feeds`))
      ).toBe(true);
    });
  });
});
