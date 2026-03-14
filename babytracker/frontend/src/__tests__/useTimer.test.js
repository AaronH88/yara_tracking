import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimer } from "../hooks/useTimer";

describe("useTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- isRunning and null handling ---

  it("returns isRunning false and elapsed null when startedAt is null", () => {
    const { result } = renderHook(() => useTimer(null));
    expect(result.current.isRunning).toBe(false);
    expect(result.current.elapsed).toBeNull();
  });

  it("returns isRunning false and elapsed null when startedAt is undefined", () => {
    const { result } = renderHook(() => useTimer(undefined));
    expect(result.current.isRunning).toBe(false);
    expect(result.current.elapsed).toBeNull();
  });

  it("returns isRunning true when startedAt is a valid ISO string", () => {
    const now = new Date("2026-03-14T10:00:00Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T09:55:00Z")
    );
    expect(result.current.isRunning).toBe(true);
    expect(result.current.elapsed).not.toBeNull();
  });

  // --- Elapsed format: seconds shown when < 2 minutes ---

  it("shows only seconds when elapsed is under 1 minute", () => {
    const now = new Date("2026-03-14T10:00:30Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("30s");
  });

  it("shows 0s when just started", () => {
    const now = new Date("2026-03-14T10:00:00Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("0s");
  });

  it("shows minutes and seconds when elapsed is between 1 and 2 minutes", () => {
    const now = new Date("2026-03-14T10:01:45Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("1m 45s");
  });

  it("shows exactly 1m 59s at 119 seconds", () => {
    const now = new Date("2026-03-14T10:01:59Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("1m 59s");
  });

  // --- Elapsed format: no seconds when >= 2 minutes ---

  it("drops seconds at exactly 2 minutes", () => {
    const now = new Date("2026-03-14T10:02:00Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("2m");
  });

  it("shows minutes without seconds above 2 minutes", () => {
    const now = new Date("2026-03-14T10:45:30Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("45m");
  });

  // --- Elapsed format: hours ---

  it("shows hours and zero-padded minutes for exactly 1 hour", () => {
    const now = new Date("2026-03-14T11:00:00Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("1h 00m");
  });

  it("shows hours and minutes for 1h 23m", () => {
    const now = new Date("2026-03-14T11:23:00Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("1h 23m");
  });

  it("shows hours and zero-padded minutes for 2h 04m", () => {
    const now = new Date("2026-03-14T12:04:30Z");
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("2h 04m");
  });

  // --- Ticking behavior ---

  it("updates elapsed every second", () => {
    const start = new Date("2026-03-14T10:00:00Z");
    vi.setSystemTime(start);
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("0s");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsed).toBe("1s");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsed).toBe("2s");
  });

  it("transitions from seconds format to minutes-only format at 2 minutes", () => {
    const start = new Date("2026-03-14T10:00:00Z");
    vi.setSystemTime(new Date("2026-03-14T10:01:59Z"));
    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("1m 59s");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsed).toBe("2m");
  });

  // --- Cleanup on unmount ---

  it("clears interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const now = new Date("2026-03-14T10:00:00Z");
    vi.setSystemTime(now);

    const { unmount } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("does not update elapsed after unmount", () => {
    const now = new Date("2026-03-14T10:00:00Z");
    vi.setSystemTime(now);

    const { result, unmount } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    const elapsedBefore = result.current.elapsed;

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // After unmount, result.current should still have the last value
    expect(result.current.elapsed).toBe(elapsedBefore);
  });

  // --- Changing startedAt ---

  it("resets elapsed when startedAt changes to null", () => {
    const now = new Date("2026-03-14T10:01:00Z");
    vi.setSystemTime(now);

    const { result, rerender } = renderHook(
      ({ startedAt }) => useTimer(startedAt),
      { initialProps: { startedAt: "2026-03-14T10:00:00Z" } }
    );
    expect(result.current.isRunning).toBe(true);
    expect(result.current.elapsed).not.toBeNull();

    rerender({ startedAt: null });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.elapsed).toBeNull();
  });

  it("starts ticking when startedAt changes from null to a value", () => {
    const now = new Date("2026-03-14T10:00:00Z");
    vi.setSystemTime(now);

    const { result, rerender } = renderHook(
      ({ startedAt }) => useTimer(startedAt),
      { initialProps: { startedAt: null } }
    );
    expect(result.current.isRunning).toBe(false);

    rerender({ startedAt: "2026-03-14T10:00:00Z" });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.elapsed).toBe("0s");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.elapsed).toBe("3s");
  });

  it("resets elapsed when startedAt changes to a new value", () => {
    const now = new Date("2026-03-14T10:05:00Z");
    vi.setSystemTime(now);

    const { result, rerender } = renderHook(
      ({ startedAt }) => useTimer(startedAt),
      { initialProps: { startedAt: "2026-03-14T10:00:00Z" } }
    );
    expect(result.current.elapsed).toBe("5m");

    // Change to a more recent start time
    rerender({ startedAt: "2026-03-14T10:04:00Z" });
    expect(result.current.elapsed).toBe("1m 00s");
  });

  // --- Edge cases ---

  it("clamps negative elapsed to 0 when startedAt is in the future", () => {
    const now = new Date("2026-03-14T10:00:00Z");
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:05:00Z")
    );
    // formatElapsed(Math.max(0, ms)) should clamp to 0
    expect(result.current.elapsed).toBe("0s");
  });

  it("handles a very large elapsed time (multi-hour)", () => {
    const now = new Date("2026-03-14T20:30:00Z");
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("10h 30m");
  });

  it("pads single-digit minutes with leading zero in hours format", () => {
    const now = new Date("2026-03-14T11:05:00Z");
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("1h 05m");
  });

  it("pads single-digit seconds with leading zero in seconds format", () => {
    const now = new Date("2026-03-14T10:01:05Z");
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer("2026-03-14T10:00:00Z")
    );
    expect(result.current.elapsed).toBe("1m 05s");
  });
});
