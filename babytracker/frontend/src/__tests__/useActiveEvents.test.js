import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useActiveEvents } from "../hooks/useActiveEvents";

const FEED_DATA = { id: 1, type: "feed", started_at: "2026-03-14T10:00:00Z" };
const SLEEP_DATA = { id: 2, type: "sleep", started_at: "2026-03-14T09:00:00Z" };
const BURP_DATA = { id: 3, type: "burp", started_at: "2026-03-14T11:00:00Z" };

function mockFetchResponses({ feed = null, sleep = null, burp = null, feedStatus = 200, sleepStatus = 200, burpStatus = 200 } = {}) {
  return (url) => {
    if (url.includes("/feeds/active")) {
      return Promise.resolve({
        ok: feedStatus >= 200 && feedStatus < 300,
        status: feedStatus,
        json: () => Promise.resolve(feed),
      });
    }
    if (url.includes("/sleeps/active")) {
      return Promise.resolve({
        ok: sleepStatus >= 200 && sleepStatus < 300,
        status: sleepStatus,
        json: () => Promise.resolve(sleep),
      });
    }
    if (url.includes("/burps/active")) {
      return Promise.resolve({
        ok: burpStatus >= 200 && burpStatus < 300,
        status: burpStatus,
        json: () => Promise.resolve(burp),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
  };
}

// Helper to flush promises and a single timer tick
async function flushPromises() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("useActiveEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // --- Null/missing babyId ---

  it("returns null for all events when babyId is null", () => {
    const { result } = renderHook(() => useActiveEvents(null));
    expect(result.current.activeFeed).toBeNull();
    expect(result.current.activeSleep).toBeNull();
    expect(result.current.activeBurp).toBeNull();
  });

  it("returns null for all events when babyId is undefined", () => {
    const { result } = renderHook(() => useActiveEvents(undefined));
    expect(result.current.activeFeed).toBeNull();
    expect(result.current.activeSleep).toBeNull();
    expect(result.current.activeBurp).toBeNull();
  });

  it("does not call fetch when babyId is null", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    renderHook(() => useActiveEvents(null));
    await flushPromises();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // --- Fetching active events ---

  it("fetches active feed, sleep, and burp on mount", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA, burp: BURP_DATA })
    );

    const { result } = renderHook(() => useActiveEvents("baby-1"));

    await waitFor(() => {
      expect(result.current.activeFeed).toEqual(FEED_DATA);
      expect(result.current.activeSleep).toEqual(SLEEP_DATA);
      expect(result.current.activeBurp).toEqual(BURP_DATA);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies/baby-1/feeds/active");
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies/baby-1/sleeps/active");
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies/baby-1/burps/active");
  });

  it("returns null for feed when no active feed (404)", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: null, sleep: SLEEP_DATA, feedStatus: 404 })
    );

    const { result } = renderHook(() => useActiveEvents("baby-1"));

    await waitFor(() => {
      expect(result.current.activeSleep).toEqual(SLEEP_DATA);
    });
    expect(result.current.activeFeed).toBeNull();
  });

  it("returns null for burp when no active burp (404)", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA, burp: null, burpStatus: 404 })
    );

    const { result } = renderHook(() => useActiveEvents("baby-1"));

    await waitFor(() => {
      expect(result.current.activeFeed).toEqual(FEED_DATA);
      expect(result.current.activeSleep).toEqual(SLEEP_DATA);
    });
    expect(result.current.activeBurp).toBeNull();
  });

  it("returns null for sleep when no active sleep (404)", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: null, sleepStatus: 404 })
    );

    const { result } = renderHook(() => useActiveEvents("baby-1"));

    await waitFor(() => {
      expect(result.current.activeFeed).toEqual(FEED_DATA);
    });
    expect(result.current.activeSleep).toBeNull();
  });

  it("returns null for all when all return non-ok status", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feedStatus: 404, sleepStatus: 500, burpStatus: 404 })
    );

    const { result } = renderHook(() => useActiveEvents("baby-1"));

    await flushPromises();

    expect(result.current.activeFeed).toBeNull();
    expect(result.current.activeSleep).toBeNull();
    expect(result.current.activeBurp).toBeNull();
  });

  // --- Polling ---

  it("polls every 10 seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    renderHook(() => useActiveEvents("baby-1"));

    // Flush initial fetch
    await act(async () => {});
    const initialCallCount = global.fetch.mock.calls.length;
    expect(initialCallCount).toBe(3); // one for feed, one for sleep, one for burp

    // Advance 10 seconds - should poll again
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await act(async () => {});
    expect(global.fetch).toHaveBeenCalledTimes(6); // 3 initial + 3 poll

    // Advance another 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await act(async () => {});
    expect(global.fetch).toHaveBeenCalledTimes(9);
  });

  it("updates state when polling returns new data", async () => {
    vi.useFakeTimers();
    let callCount = 0;
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      callCount++;
      if (url.includes("/feeds/active")) {
        // First call (callCount 1) returns 404, second call (callCount 3) returns data
        const ok = callCount > 2;
        return Promise.resolve({
          ok,
          status: ok ? 200 : 404,
          json: () => Promise.resolve(ok ? FEED_DATA : null),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve(null),
      });
    });

    const { result } = renderHook(() => useActiveEvents("baby-1"));

    await act(async () => {});
    expect(result.current.activeFeed).toBeNull();

    // Poll again - now returns data
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await act(async () => {});
    expect(result.current.activeFeed).toEqual(FEED_DATA);
  });

  // --- refetch ---

  it("exposes a refetch function that triggers an immediate refresh", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    const { result } = renderHook(() => useActiveEvents("baby-1"));

    await waitFor(() => {
      expect(result.current.activeFeed).toEqual(FEED_DATA);
    });

    const callsAfterInit = global.fetch.mock.calls.length;

    await act(async () => {
      await result.current.refetch();
    });
    expect(global.fetch.mock.calls.length).toBe(callsAfterInit + 3);
  });

  it("refetch is a stable function reference across rerenders", () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    const { result, rerender } = renderHook(() => useActiveEvents("baby-1"));
    const firstRefetch = result.current.refetch;
    rerender();
    expect(result.current.refetch).toBe(firstRefetch);
  });

  // --- Network errors ---

  it("keeps current state when fetch throws a network error", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    const { result } = renderHook(() => useActiveEvents("baby-1"));

    await waitFor(() => {
      expect(result.current.activeFeed).toEqual(FEED_DATA);
      expect(result.current.activeSleep).toEqual(SLEEP_DATA);
    });

    // Now make fetch throw on next poll
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.reject(new TypeError("Failed to fetch"))
    );

    // Manually trigger refetch (simulates poll)
    await act(async () => {
      await result.current.refetch();
    });

    // State should be preserved
    expect(result.current.activeFeed).toEqual(FEED_DATA);
    expect(result.current.activeSleep).toEqual(SLEEP_DATA);
  });

  // --- Cleanup ---

  it("clears polling interval on unmount", async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    const { unmount } = renderHook(() => useActiveEvents("baby-1"));

    await act(async () => {});

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("does not fetch after unmount", async () => {
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    const { unmount } = renderHook(() => useActiveEvents("baby-1"));

    await act(async () => {});

    const callCountBeforeUnmount = global.fetch.mock.calls.length;
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(global.fetch.mock.calls.length).toBe(callCountBeforeUnmount);
  });

  // --- babyId changes ---

  it("resets state and refetches when babyId changes", async () => {
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      if (url.includes("baby-1") && url.includes("/feeds/active")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FEED_DATA) });
      }
      if (url.includes("baby-2") && url.includes("/feeds/active")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...FEED_DATA, id: 99 }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    });

    const { result, rerender } = renderHook(
      ({ babyId }) => useActiveEvents(babyId),
      { initialProps: { babyId: "baby-1" } }
    );

    await waitFor(() => {
      expect(result.current.activeFeed).toEqual(FEED_DATA);
    });

    rerender({ babyId: "baby-2" });

    await waitFor(() => {
      expect(result.current.activeFeed).toEqual({ ...FEED_DATA, id: 99 });
    });
  });

  it("clears state when babyId changes to null", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    const { result, rerender } = renderHook(
      ({ babyId }) => useActiveEvents(babyId),
      { initialProps: { babyId: "baby-1" } }
    );

    await waitFor(() => {
      expect(result.current.activeFeed).toEqual(FEED_DATA);
    });

    rerender({ babyId: null });

    await waitFor(() => {
      expect(result.current.activeFeed).toBeNull();
      expect(result.current.activeSleep).toBeNull();
      expect(result.current.activeBurp).toBeNull();
    });
  });

  it("stops polling old babyId when babyId changes to null", async () => {
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    const { rerender } = renderHook(
      ({ babyId }) => useActiveEvents(babyId),
      { initialProps: { babyId: "baby-1" } }
    );

    await act(async () => {});

    rerender({ babyId: null });

    const callCountAfterChange = global.fetch.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    // No new fetches should have been made
    expect(global.fetch.mock.calls.length).toBe(callCountAfterChange);
  });

  // --- URL construction ---

  it("constructs correct API URLs with the given babyId", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      mockFetchResponses({ feed: FEED_DATA, sleep: SLEEP_DATA })
    );

    renderHook(() => useActiveEvents("abc-123"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies/abc-123/feeds/active");
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies/abc-123/sleeps/active");
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies/abc-123/burps/active");
    });
  });
});
