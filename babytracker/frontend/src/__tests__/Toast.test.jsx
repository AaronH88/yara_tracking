import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toast from "../components/Toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast — rendering", () => {
  it("renders the provided message text", () => {
    render(<Toast message="Sleep timer automatically stopped" onDismiss={() => {}} />);
    expect(screen.getByText("Sleep timer automatically stopped")).toBeInTheDocument();
  });

  it("has role='status' for accessibility", () => {
    render(<Toast message="Hello" onDismiss={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders with opacity-100 initially (not fading)", () => {
    render(<Toast message="Hello" onDismiss={() => {}} />);
    const el = screen.getByRole("status");
    expect(el.className).toMatch(/opacity-100/);
    expect(el.className).not.toMatch(/opacity-0/);
  });
});

describe("Toast — auto-dismiss after 3 seconds", () => {
  it("begins fading at 2700ms", () => {
    render(<Toast message="Fading soon" onDismiss={() => {}} />);

    act(() => { vi.advanceTimersByTime(2699); });
    expect(screen.getByRole("status").className).toMatch(/opacity-100/);

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole("status").className).toMatch(/opacity-0/);
  });

  it("calls onDismiss at 3000ms", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Bye" onDismiss={onDismiss} />);

    act(() => { vi.advanceTimersByTime(2999); });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("removes element from DOM after 3000ms", () => {
    render(<Toast message="Gone" onDismiss={() => {}} />);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("Toast — tap to dismiss early", () => {
  it("calls onDismiss immediately when clicked", async () => {
    vi.useRealTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Tap me" onDismiss={onDismiss} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("status"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("removes element from DOM after click", async () => {
    vi.useRealTimers();
    render(<Toast message="Click to close" onDismiss={() => {}} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("status"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("Toast — cleanup", () => {
  it("clears timers on unmount to prevent memory leaks", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast message="Cleanup" onDismiss={onDismiss} />);

    unmount();

    // Advance past 3s — onDismiss should NOT fire since component unmounted
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
