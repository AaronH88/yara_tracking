import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock dependencies
vi.mock("../hooks/useTimer", () => ({
  useTimer: vi.fn(),
}));
vi.mock("../context/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

import ActiveTimer from "../components/timers/ActiveTimer";
import { useTimer } from "../hooks/useTimer";
import { useSettings } from "../context/SettingsContext";

function setup({ elapsed = "5m 30s", timeFormat = "24h", startedAt = "2026-03-14T14:14:00" } = {}) {
  useTimer.mockReturnValue({ elapsed, isRunning: elapsed !== null });
  useSettings.mockReturnValue({
    settings: { time_format: timeFormat },
  });
  return { startedAt };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Rendering basics ----

describe("ActiveTimer — rendering", () => {
  it("renders the elapsed time from useTimer", () => {
    const { startedAt } = setup({ elapsed: "3m 45s" });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText("3m 45s")).toBeInTheDocument();
  });

  it("passes startedAt prop to useTimer", () => {
    const startedAt = "2026-03-14T10:00:00Z";
    setup({ startedAt });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(useTimer).toHaveBeenCalledWith(startedAt);
  });

  it("shows fallback 0s when elapsed is null", () => {
    const { startedAt } = setup({ elapsed: null });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText("0s")).toBeInTheDocument();
  });

  it("has aria-live attribute for accessibility on elapsed display", () => {
    const { startedAt } = setup();
    render(<ActiveTimer startedAt={startedAt} />);

    const elapsedEl = screen.getByText("5m 30s");
    expect(elapsedEl).toHaveAttribute("aria-live", "polite");
  });

  it("uses large font class for the elapsed time display", () => {
    const { startedAt } = setup({ elapsed: "10s" });
    render(<ActiveTimer startedAt={startedAt} />);

    const elapsedEl = screen.getByText("10s");
    expect(elapsedEl.className).toContain("text-5xl");
  });
});

// ---- Start time display with 24h format ----

describe("ActiveTimer — 24h time format", () => {
  it("shows start time in 24h format with padded hours and minutes", () => {
    const { startedAt } = setup({
      timeFormat: "24h",
      startedAt: "2026-03-14T09:05:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 09:05/)).toBeInTheDocument();
  });

  it("shows midnight as 00:00 in 24h format", () => {
    const { startedAt } = setup({
      timeFormat: "24h",
      startedAt: "2026-03-14T00:00:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 00:00/)).toBeInTheDocument();
  });

  it("shows 23:59 correctly in 24h format", () => {
    const { startedAt } = setup({
      timeFormat: "24h",
      startedAt: "2026-03-14T23:59:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 23:59/)).toBeInTheDocument();
  });
});

// ---- Start time display with 12h format ----

describe("ActiveTimer — 12h time format", () => {
  it("shows start time with AM for morning hours", () => {
    const { startedAt } = setup({
      timeFormat: "12h",
      startedAt: "2026-03-14T09:05:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 9:05 AM/)).toBeInTheDocument();
  });

  it("shows start time with PM for afternoon hours", () => {
    const { startedAt } = setup({
      timeFormat: "12h",
      startedAt: "2026-03-14T14:14:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 2:14 PM/)).toBeInTheDocument();
  });

  it("shows 12:00 PM for noon", () => {
    const { startedAt } = setup({
      timeFormat: "12h",
      startedAt: "2026-03-14T12:00:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 12:00 PM/)).toBeInTheDocument();
  });

  it("shows 12:00 AM for midnight", () => {
    const { startedAt } = setup({
      timeFormat: "12h",
      startedAt: "2026-03-14T00:00:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 12:00 AM/)).toBeInTheDocument();
  });

  it("shows 12:30 PM for 12:30 (not 0:30 PM)", () => {
    const { startedAt } = setup({
      timeFormat: "12h",
      startedAt: "2026-03-14T12:30:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 12:30 PM/)).toBeInTheDocument();
  });

  it("pads single-digit minutes in 12h format", () => {
    const { startedAt } = setup({
      timeFormat: "12h",
      startedAt: "2026-03-14T15:03:00",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText(/Started 3:03 PM/)).toBeInTheDocument();
  });
});

// ---- Edge cases ----

describe("ActiveTimer — edge cases", () => {
  it("renders with an ISO string that includes timezone offset", () => {
    const { startedAt } = setup({
      timeFormat: "24h",
      startedAt: "2026-03-14T14:14:00Z",
    });
    render(<ActiveTimer startedAt={startedAt} />);

    // Should render without crashing; exact time depends on local TZ
    expect(screen.getByText(/Started/)).toBeInTheDocument();
  });

  it("renders different elapsed values without crashing", () => {
    const { startedAt } = setup({ elapsed: "1h 05m 30s" });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText("1h 05m 30s")).toBeInTheDocument();
  });

  it("renders seconds-only elapsed values", () => {
    const { startedAt } = setup({ elapsed: "0s" });
    render(<ActiveTimer startedAt={startedAt} />);

    expect(screen.getByText("0s")).toBeInTheDocument();
  });
});
