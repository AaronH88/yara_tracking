import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock all form components so we can test the modal in isolation
vi.mock("../components/forms/FeedForm", () => ({
  default: ({ onSaved, onCancel }) => (
    <div data-testid="feed-form">
      <button onClick={onSaved}>SaveFeed</button>
      <button onClick={onCancel}>CancelFeed</button>
    </div>
  ),
}));
vi.mock("../components/forms/SleepForm", () => ({
  default: ({ onSaved, onCancel }) => (
    <div data-testid="sleep-form">
      <button onClick={onSaved}>SaveSleep</button>
      <button onClick={onCancel}>CancelSleep</button>
    </div>
  ),
}));
vi.mock("../components/forms/DiaperForm", () => ({
  default: ({ onSaved, onCancel }) => (
    <div data-testid="diaper-form">
      <button onClick={onSaved}>SaveDiaper</button>
    </div>
  ),
}));
vi.mock("../components/forms/PumpForm", () => ({
  default: ({ onSaved, onCancel }) => (
    <div data-testid="pump-form">
      <button onClick={onSaved}>SavePump</button>
    </div>
  ),
}));
vi.mock("../components/forms/MilestoneForm", () => ({
  default: ({ onSaved, onCancel }) => (
    <div data-testid="milestone-form">
      <button onClick={onSaved}>SaveMilestone</button>
    </div>
  ),
}));
vi.mock("../components/forms/MeasurementForm", () => ({
  default: ({ onSaved, onCancel }) => (
    <div data-testid="measurement-form">
      <button onClick={onSaved}>SaveMeasurement</button>
    </div>
  ),
}));

import LogPastEventModal from "../components/LogPastEventModal";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---- Initial render (event type selector) ----

describe("LogPastEventModal — event type selector", () => {
  it("renders the 'Log Past Event' heading initially", () => {
    render(<LogPastEventModal onClose={vi.fn()} />);
    expect(screen.getByText("Log Past Event")).toBeInTheDocument();
  });

  it("renders all six event type buttons", () => {
    render(<LogPastEventModal onClose={vi.fn()} />);
    expect(screen.getByText("Feed")).toBeInTheDocument();
    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByText("Diaper")).toBeInTheDocument();
    expect(screen.getByText("Pump")).toBeInTheDocument();
    expect(screen.getByText("Milestone")).toBeInTheDocument();
    expect(screen.getByText("Measurement")).toBeInTheDocument();
  });

  it("renders a close button showing the X symbol initially", () => {
    render(<LogPastEventModal onClose={vi.fn()} />);
    // The close button contains the X character
    const closeBtn = screen.getByRole("button", { name: /✕/ });
    expect(closeBtn).toBeInTheDocument();
  });

  it("does not render any form component initially", () => {
    render(<LogPastEventModal onClose={vi.fn()} />);
    expect(screen.queryByTestId("feed-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sleep-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("diaper-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pump-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("milestone-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("measurement-form")).not.toBeInTheDocument();
  });
});

// ---- Selecting an event type ----

describe("LogPastEventModal — selecting event type", () => {
  it("shows the FeedForm when Feed is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Feed"));

    expect(screen.getByTestId("feed-form")).toBeInTheDocument();
    // Event type grid should be hidden
    expect(screen.queryByText("Sleep")).not.toBeInTheDocument();
  });

  it("shows the SleepForm when Sleep is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Sleep"));

    expect(screen.getByTestId("sleep-form")).toBeInTheDocument();
  });

  it("shows the DiaperForm when Diaper is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Diaper"));

    expect(screen.getByTestId("diaper-form")).toBeInTheDocument();
  });

  it("shows the PumpForm when Pump is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Pump"));

    expect(screen.getByTestId("pump-form")).toBeInTheDocument();
  });

  it("shows the MilestoneForm when Milestone is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Milestone"));

    expect(screen.getByTestId("milestone-form")).toBeInTheDocument();
  });

  it("shows the MeasurementForm when Measurement is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Measurement"));

    expect(screen.getByTestId("measurement-form")).toBeInTheDocument();
  });

  it("updates heading to include selected type name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Feed"));

    expect(screen.getByText("Log Past Feed")).toBeInTheDocument();
  });

  it("shows Back button instead of X when a type is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Feed"));

    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /✕/ })).not.toBeInTheDocument();
  });
});

// ---- Back navigation ----

describe("LogPastEventModal — back navigation", () => {
  it("returns to event type selector when Back is clicked from a form", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Feed"));
    expect(screen.getByTestId("feed-form")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back/i }));

    // Should be back to selector
    expect(screen.queryByTestId("feed-form")).not.toBeInTheDocument();
    expect(screen.getByText("Feed")).toBeInTheDocument();
    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByText("Log Past Event")).toBeInTheDocument();
  });

  it("form's onCancel also navigates back to type selector", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    await user.click(screen.getByText("Feed"));
    expect(screen.getByTestId("feed-form")).toBeInTheDocument();

    // Click the form's own cancel button (which calls onCancel prop)
    await user.click(screen.getByText("CancelFeed"));

    // Should return to selector, not close modal
    expect(screen.queryByTestId("feed-form")).not.toBeInTheDocument();
    expect(screen.getByText("Feed")).toBeInTheDocument();
  });
});

// ---- Closing the modal ----

describe("LogPastEventModal — closing", () => {
  it("calls onClose(false) when X button is clicked on type selector", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /✕/ }));

    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("calls onClose(false) when backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<LogPastEventModal onClose={onClose} />);

    // Click the backdrop (the outermost fixed overlay div)
    const backdrop = container.querySelector(".fixed.inset-0");
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("does not close when clicking inside the modal content", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={onClose} />);

    // Click the heading (inside the modal content, not the backdrop)
    await user.click(screen.getByText("Log Past Event"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose(true) when a form reports saved", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={onClose} />);

    await user.click(screen.getByText("Feed"));
    await user.click(screen.getByText("SaveFeed"));

    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("does not call onClose when Back is clicked (stays in modal)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={onClose} />);

    await user.click(screen.getByText("Feed"));
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---- Dashboard integration for Log Past Event button ----

describe("LogPastEventModal — multiple type selections", () => {
  it("can select a type, go back, then select a different type", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LogPastEventModal onClose={vi.fn()} />);

    // Select Feed
    await user.click(screen.getByText("Feed"));
    expect(screen.getByTestId("feed-form")).toBeInTheDocument();

    // Go back
    await user.click(screen.getByRole("button", { name: /back/i }));

    // Now select Sleep
    await user.click(screen.getByText("Sleep"));
    expect(screen.getByTestId("sleep-form")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-form")).not.toBeInTheDocument();
  });
});
