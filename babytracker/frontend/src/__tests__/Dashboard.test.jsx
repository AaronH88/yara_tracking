import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the hooks and components used by Dashboard
vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));
vi.mock("../context/PersonaContext", () => ({
  usePersona: vi.fn(),
}));
vi.mock("../hooks/useActiveEvents", () => ({
  useActiveEvents: vi.fn(),
}));
vi.mock("../components/timers/FeedTimer", () => ({
  default: () => <div data-testid="feed-timer">FeedTimer</div>,
}));
vi.mock("../components/timers/SleepTimer", () => ({
  default: () => <div data-testid="sleep-timer">SleepTimer</div>,
}));
vi.mock("../components/LogPastEventModal", () => ({
  default: ({ onClose }) => (
    <div data-testid="log-past-event-modal">
      <button onClick={() => onClose(true)}>MockSave</button>
      <button onClick={() => onClose(false)}>MockClose</button>
    </div>
  ),
}));

import Dashboard from "../pages/Dashboard";
import { useBaby } from "../context/BabyContext";
import { usePersona } from "../context/PersonaContext";
import { useActiveEvents } from "../hooks/useActiveEvents";

const BABY = { id: 42, name: "TestBaby" };
const PERSONA = { id: 7, name: "Mom" };

function setupDefaults({ activeFeed = null, activeSleep = null } = {}) {
  const refetch = vi.fn(() => Promise.resolve());
  useBaby.mockReturnValue({ selectedBaby: BABY });
  usePersona.mockReturnValue({ persona: PERSONA });
  useActiveEvents.mockReturnValue({ activeFeed, activeSleep, refetch });
  return { refetch };
}

function mockFetchResponses({ feeds = [], sleeps = [], diapers = [] } = {}) {
  global.fetch = vi.fn((url) => {
    if (url.includes("/feeds?limit=1")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(feeds) });
    }
    if (url.includes("/sleeps?limit=1")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(sleeps) });
    }
    if (url.includes("/diapers?limit=1")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(diapers) });
    }
    if (url.includes("/diapers") && !url.includes("limit")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 99, type: "wet" }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockFetchResponses();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---- No baby selected ----

describe("Dashboard — no baby selected", () => {
  it("shows 'No baby selected' when selectedBaby is null", () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    usePersona.mockReturnValue({ persona: PERSONA });
    useActiveEvents.mockReturnValue({ activeFeed: null, activeSleep: null, refetch: vi.fn() });
    render(<Dashboard />);

    expect(screen.getByText(/no baby selected/i)).toBeInTheDocument();
  });

  it("does not render quick log buttons when no baby is selected", () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    usePersona.mockReturnValue({ persona: PERSONA });
    useActiveEvents.mockReturnValue({ activeFeed: null, activeSleep: null, refetch: vi.fn() });
    render(<Dashboard />);

    expect(screen.queryByRole("button", { name: /wet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log feed/i })).not.toBeInTheDocument();
  });
});

// ---- Section rendering ----

describe("Dashboard — section rendering", () => {
  it("renders the Quick Log section heading", () => {
    setupDefaults();
    render(<Dashboard />);

    expect(screen.getByText(/quick log/i)).toBeInTheDocument();
  });

  it("renders the Last Events section heading", () => {
    setupDefaults();
    render(<Dashboard />);

    expect(screen.getByText(/last events/i)).toBeInTheDocument();
  });

  it("does not render Active Timers section when no timers are active", () => {
    setupDefaults();
    render(<Dashboard />);

    expect(screen.queryByText(/active timers/i)).not.toBeInTheDocument();
  });
});

// ---- Active Timers ----

describe("Dashboard — active timers", () => {
  it("shows Active Timers heading when a feed is active", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
    });
    render(<Dashboard />);

    expect(screen.getByText(/active timers/i)).toBeInTheDocument();
  });

  it("renders FeedTimer component when a feed is active", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
    });
    render(<Dashboard />);

    expect(screen.getByTestId("feed-timer")).toBeInTheDocument();
  });

  it("renders SleepTimer component when a sleep is active", () => {
    setupDefaults({
      activeSleep: { id: 20, type: "nap", started_at: "2026-03-14T10:00:00Z" },
    });
    render(<Dashboard />);

    expect(screen.getByTestId("sleep-timer")).toBeInTheDocument();
  });

  it("renders both timers when both feed and sleep are active", () => {
    setupDefaults({
      activeFeed: { id: 10, type: "bottle", started_at: "2026-03-14T10:00:00Z" },
      activeSleep: { id: 20, type: "nap", started_at: "2026-03-14T10:00:00Z" },
    });
    render(<Dashboard />);

    expect(screen.getByTestId("feed-timer")).toBeInTheDocument();
    expect(screen.getByTestId("sleep-timer")).toBeInTheDocument();
  });
});

// ---- Quick Log — Diaper buttons ----

describe("Dashboard — diaper quick log", () => {
  it("renders three diaper buttons: Wet, Dirty, Both", () => {
    setupDefaults();
    render(<Dashboard />);

    expect(screen.getByRole("button", { name: /wet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dirty/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /both/i })).toBeInTheDocument();
  });

  it("POSTs to the diapers endpoint when Wet is tapped", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /wet/i }));

    await waitFor(() => {
      const diaperCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => url.includes("/diapers") && opts?.method === "POST"
      );
      expect(diaperCalls).toHaveLength(1);
      const body = JSON.parse(diaperCalls[0][1].body);
      expect(body.type).toBe("wet");
      expect(body.user_id).toBe(PERSONA.id);
      expect(body.logged_at).toBeDefined();
    });
  });

  it("POSTs correct type when Dirty is tapped", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /dirty/i }));

    await waitFor(() => {
      const diaperCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => url.includes("/diapers") && opts?.method === "POST"
      );
      expect(diaperCalls).toHaveLength(1);
      const body = JSON.parse(diaperCalls[0][1].body);
      expect(body.type).toBe("dirty");
    });
  });

  it("POSTs correct type when Both is tapped", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /both/i }));

    await waitFor(() => {
      const diaperCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => url.includes("/diapers") && opts?.method === "POST"
      );
      expect(diaperCalls).toHaveLength(1);
      const body = JSON.parse(diaperCalls[0][1].body);
      expect(body.type).toBe("both");
    });
  });

  it("disables diaper buttons while a diaper is being logged", async () => {
    setupDefaults();
    // Make the POST hang indefinitely
    let resolvePost;
    global.fetch = vi.fn((url, opts) => {
      if (opts?.method === "POST") {
        return new Promise((resolve) => { resolvePost = resolve; });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /wet/i }));

    // Buttons should be disabled while logging
    expect(screen.getByRole("button", { name: /wet/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /dirty/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /both/i })).toBeDisabled();

    // Resolve to clean up
    resolvePost({ ok: true, json: () => Promise.resolve({}) });
  });

  it("does not POST if no persona is set", async () => {
    useBaby.mockReturnValue({ selectedBaby: BABY });
    usePersona.mockReturnValue({ persona: null });
    useActiveEvents.mockReturnValue({ activeFeed: null, activeSleep: null, refetch: vi.fn() });
    const postFetch = vi.fn();
    global.fetch = vi.fn((url, opts) => {
      if (opts?.method === "POST") postFetch();
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /wet/i }));

    expect(postFetch).not.toHaveBeenCalled();
  });

  it("refetches last events after logging a diaper", async () => {
    setupDefaults();
    const fetchCalls = [];
    global.fetch = vi.fn((url, opts) => {
      fetchCalls.push({ url, method: opts?.method || "GET" });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    // Clear initial fetch calls
    fetchCalls.length = 0;

    await user.click(screen.getByRole("button", { name: /wet/i }));

    await waitFor(() => {
      // After POST, should refetch last events (feeds, sleeps, diapers)
      const postCall = fetchCalls.find((c) => c.method === "POST");
      expect(postCall).toBeDefined();
      const refetchCalls = fetchCalls.filter(
        (c) => c.method === "GET" && c.url.includes("limit=1")
      );
      expect(refetchCalls.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ---- Quick Log — Feed/Sleep shortcuts ----

describe("Dashboard — feed and sleep shortcuts", () => {
  it("renders Log Feed button", () => {
    setupDefaults();
    render(<Dashboard />);

    expect(screen.getByRole("button", { name: /log feed/i })).toBeInTheDocument();
  });

  it("renders Log Sleep button", () => {
    setupDefaults();
    render(<Dashboard />);

    expect(screen.getByRole("button", { name: /log sleep/i })).toBeInTheDocument();
  });

  it("shows FeedTimer when Log Feed is clicked", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /log feed/i }));

    expect(screen.getByTestId("feed-timer")).toBeInTheDocument();
    // Dashboard quick log should be gone
    expect(screen.queryByText(/quick log/i)).not.toBeInTheDocument();
  });

  it("shows SleepTimer when Log Sleep is clicked", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /log sleep/i }));

    expect(screen.getByTestId("sleep-timer")).toBeInTheDocument();
    expect(screen.queryByText(/quick log/i)).not.toBeInTheDocument();
  });

  it("shows Back to Dashboard button when FeedTimer is open", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /log feed/i }));

    expect(screen.getByText(/back to dashboard/i)).toBeInTheDocument();
  });

  it("returns to dashboard when Back button is clicked from FeedTimer", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /log feed/i }));
    await user.click(screen.getByText(/back to dashboard/i));

    expect(screen.getByText(/quick log/i)).toBeInTheDocument();
  });

  it("returns to dashboard when Back button is clicked from SleepTimer", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /log sleep/i }));
    await user.click(screen.getByText(/back to dashboard/i));

    expect(screen.getByText(/quick log/i)).toBeInTheDocument();
  });
});

// ---- Last Events ----

describe("Dashboard — last events summary", () => {
  it("shows 'No events yet' cards when there are no past events", async () => {
    setupDefaults();
    mockFetchResponses({ feeds: [], sleeps: [], diapers: [] });
    render(<Dashboard />);

    await waitFor(() => {
      const noEvents = screen.getAllByText(/no events yet/i);
      expect(noEvents.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("shows last feed event with type and time ago", async () => {
    setupDefaults();
    const feedTime = new Date(Date.now() - 30 * 60000).toISOString();
    mockFetchResponses({
      feeds: [{ id: 1, type: "bottle", started_at: feedTime, ended_at: feedTime }],
      sleeps: [],
      diapers: [],
    });
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/last feed/i)).toBeInTheDocument();
      expect(screen.getByText(/bottle/i)).toBeInTheDocument();
    });
  });

  it("shows last sleep event with type", async () => {
    setupDefaults();
    const sleepTime = new Date(Date.now() - 60 * 60000).toISOString();
    mockFetchResponses({
      feeds: [],
      sleeps: [{ id: 2, type: "nap", started_at: sleepTime, ended_at: sleepTime }],
      diapers: [],
    });
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/last sleep/i)).toBeInTheDocument();
      expect(screen.getByText(/nap/i)).toBeInTheDocument();
    });
  });

  it("shows last diaper event with type", async () => {
    setupDefaults();
    const diaperTime = new Date(Date.now() - 15 * 60000).toISOString();
    mockFetchResponses({
      feeds: [],
      sleeps: [],
      diapers: [{ id: 3, type: "wet", logged_at: diaperTime }],
    });
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/last diaper/i)).toBeInTheDocument();
      expect(screen.getByText(/wet/i)).toBeInTheDocument();
    });
  });

  it("shows 'since last feed' prominently when a feed exists", async () => {
    setupDefaults();
    const feedTime = new Date(Date.now() - 45 * 60000).toISOString();
    mockFetchResponses({
      feeds: [{ id: 1, type: "bottle", started_at: feedTime, ended_at: feedTime }],
      sleeps: [],
      diapers: [],
    });
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/since last feed/i)).toBeInTheDocument();
    });
  });

  it("does not show 'since last feed' when there are no feed events", async () => {
    setupDefaults();
    mockFetchResponses({ feeds: [], sleeps: [], diapers: [] });
    render(<Dashboard />);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(screen.getAllByText(/no events yet/i).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.queryByText(/since last feed/i)).not.toBeInTheDocument();
  });

  it("shows duration for feed events with both started_at and ended_at", async () => {
    setupDefaults();
    const startedAt = new Date(Date.now() - 60 * 60000).toISOString();
    const endedAt = new Date(Date.now() - 30 * 60000).toISOString();
    mockFetchResponses({
      feeds: [{ id: 1, type: "bottle", started_at: startedAt, ended_at: endedAt }],
      sleeps: [],
      diapers: [],
    });
    render(<Dashboard />);

    await waitFor(() => {
      // The duration is displayed in parentheses like "(30m)"
      expect(screen.getByText(/\(30m\)/)).toBeInTheDocument();
    });
  });

  it("handles API failure gracefully for last events", async () => {
    setupDefaults();
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    render(<Dashboard />);

    // Should still render the dashboard without crashing
    expect(screen.getByText(/quick log/i)).toBeInTheDocument();
  });
});

// ---- Diaper POST URL ----

describe("Dashboard — diaper API URL", () => {
  it("POSTs to the correct baby-specific diapers endpoint", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /wet/i }));

    await waitFor(() => {
      const diaperCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => url.includes("/diapers") && opts?.method === "POST"
      );
      expect(diaperCalls).toHaveLength(1);
      expect(diaperCalls[0][0]).toBe(`/api/v1/babies/${BABY.id}/diapers`);
    });
  });

  it("sends Content-Type application/json header", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /dirty/i }));

    await waitFor(() => {
      const diaperCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => url.includes("/diapers") && opts?.method === "POST"
      );
      expect(diaperCalls[0][1].headers["Content-Type"]).toBe("application/json");
    });
  });

  it("sends a valid ISO timestamp in logged_at", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /wet/i }));

    await waitFor(() => {
      const diaperCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => url.includes("/diapers") && opts?.method === "POST"
      );
      const body = JSON.parse(diaperCalls[0][1].body);
      expect(() => new Date(body.logged_at).toISOString()).not.toThrow();
    });
  });
});

// ---- Log Past Event button ----

describe("Dashboard — Log Past Event", () => {
  it("renders a 'Log Past Event' button", () => {
    setupDefaults();
    render(<Dashboard />);

    expect(screen.getByRole("button", { name: /log past event/i })).toBeInTheDocument();
  });

  it("opens the LogPastEventModal when Log Past Event is clicked", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    expect(screen.queryByTestId("log-past-event-modal")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /log past event/i }));

    expect(screen.getByTestId("log-past-event-modal")).toBeInTheDocument();
  });

  it("closes the modal when onClose is called with false", async () => {
    setupDefaults();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /log past event/i }));
    expect(screen.getByTestId("log-past-event-modal")).toBeInTheDocument();

    await user.click(screen.getByText("MockClose"));

    expect(screen.queryByTestId("log-past-event-modal")).not.toBeInTheDocument();
  });

  it("closes the modal and refetches events when onClose is called with true (saved)", async () => {
    setupDefaults();
    const fetchCalls = [];
    global.fetch = vi.fn((url, opts) => {
      fetchCalls.push({ url, method: opts?.method || "GET" });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Dashboard />);

    // Clear initial fetch calls
    fetchCalls.length = 0;

    await user.click(screen.getByRole("button", { name: /log past event/i }));
    await user.click(screen.getByText("MockSave"));

    // Modal should be closed
    expect(screen.queryByTestId("log-past-event-modal")).not.toBeInTheDocument();

    // Should have refetched last events
    await waitFor(() => {
      const refetchCalls = fetchCalls.filter(
        (c) => c.method === "GET" && c.url.includes("limit=1")
      );
      expect(refetchCalls.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("does not show Log Past Event button when no baby is selected", () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    usePersona.mockReturnValue({ persona: PERSONA });
    useActiveEvents.mockReturnValue({ activeFeed: null, activeSleep: null, refetch: vi.fn() });
    render(<Dashboard />);

    expect(screen.queryByRole("button", { name: /log past event/i })).not.toBeInTheDocument();
  });
});
