import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));
vi.mock("../context/PersonaContext", () => ({
  usePersona: vi.fn(),
}));
vi.mock("../context/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

import FeedForm from "../components/forms/FeedForm";
import { useBaby } from "../context/BabyContext";
import { usePersona } from "../context/PersonaContext";
import { useSettings } from "../context/SettingsContext";

const BABY = { id: 1, name: "TestBaby" };
const PERSONA = { id: 2, name: "Mom" };
const USERS = [
  { id: 2, name: "Mom" },
  { id: 3, name: "Dad" },
];

beforeEach(() => {
  useBaby.mockReturnValue({ selectedBaby: BABY });
  usePersona.mockReturnValue({ persona: PERSONA });
  useSettings.mockReturnValue({ settings: { units: "imperial" } });
  global.fetch = vi.fn((url, opts) => {
    if (url === "/api/v1/users") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(USERS) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 99 }) });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FeedForm", () => {
  it("renders all required fields", async () => {
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Started at")).toBeInTheDocument();
    expect(screen.getByText("Ended at")).toBeInTheDocument();
    expect(screen.getByText(/Amount/)).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("shows oz label when units are imperial", async () => {
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Amount (oz)")).toBeInTheDocument());
  });

  it("shows ml label when units are metric", async () => {
    useSettings.mockReturnValue({ settings: { units: "metric" } });
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Amount (ml)")).toBeInTheDocument());
  });

  it("shows Update button when editing", async () => {
    const event = { id: 1, user_id: 2, type: "bottle", started_at: "2024-01-15T10:00:00Z", ended_at: null, amount_oz: 4, notes: "" };
    render(<FeedForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());
  });

  it("shows Create button for new events", async () => {
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
  });

  it("populates fields from existing event", async () => {
    const event = { id: 1, user_id: 2, type: "breast_left", started_at: "2024-01-15T10:00:00Z", ended_at: null, amount_oz: 4, notes: "good feed" };
    render(<FeedForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Breast L")).toBeInTheDocument());
    expect(screen.getByDisplayValue("good feed")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
  });

  it("sends POST for new event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<FeedForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      expect(postCall[0]).toBe(`/api/v1/babies/${BABY.id}/feeds`);
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("sends PATCH for existing event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const event = { id: 5, user_id: 2, type: "bottle", started_at: "2024-01-15T10:00:00Z" };
    render(<FeedForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall[0]).toBe(`/api/v1/babies/${BABY.id}/feeds/${event.id}`);
    });
  });

  it("sends amount_oz for imperial units", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<FeedForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    const amountLabel = screen.getByText(/Amount/i);
    const amountInput = amountLabel.closest("div").querySelector("input");
    await user.type(amountInput, "5");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.amount_oz).toBe(5);
      expect(body.amount_ml).toBeUndefined();
    });
  });

  it("sends amount_ml for metric units", async () => {
    useSettings.mockReturnValue({ settings: { units: "metric" } });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<FeedForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    const amountLabel = screen.getByText(/Amount/i);
    const amountInput = amountLabel.closest("div").querySelector("input");
    await user.type(amountInput, "150");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.amount_ml).toBe(150);
      expect(body.amount_oz).toBeUndefined();
    });
  });

  it("does not submit when no baby is selected", async () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<FeedForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCalls).toHaveLength(0);
    });
  });

  it("renders all feed type options", async () => {
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Breast L")).toBeInTheDocument());
    expect(screen.getByText("Breast R")).toBeInTheDocument();
    expect(screen.getByText("Both Sides")).toBeInTheDocument();
    expect(screen.getByText("Bottle")).toBeInTheDocument();
  });

  it("renders quality selector with three options", async () => {
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("How did the feed go?")).toBeInTheDocument());
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("Okay")).toBeInTheDocument();
    expect(screen.getByText("Poor")).toBeInTheDocument();
  });

  it("highlights selected quality button with ring class", async () => {
    const user = userEvent.setup();
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Good")).toBeInTheDocument());

    const goodBtn = screen.getByText("Good").closest("button");
    expect(goodBtn.className).not.toMatch(/ring-2/);

    await user.click(goodBtn);

    expect(goodBtn.className).toMatch(/ring-2/);
  });

  it("deselects quality when the same button is tapped again", async () => {
    const user = userEvent.setup();
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Good")).toBeInTheDocument());

    const goodBtn = screen.getByText("Good").closest("button");
    await user.click(goodBtn);
    expect(goodBtn.className).toMatch(/ring-2/);

    await user.click(goodBtn);
    expect(goodBtn.className).not.toMatch(/ring-2/);
  });

  it("switches selection when a different quality button is clicked", async () => {
    const user = userEvent.setup();
    render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Good")).toBeInTheDocument());

    const goodBtn = screen.getByText("Good").closest("button");
    const poorBtn = screen.getByText("Poor").closest("button");

    await user.click(goodBtn);
    expect(goodBtn.className).toMatch(/ring-2/);
    expect(poorBtn.className).not.toMatch(/ring-2/);

    await user.click(poorBtn);
    expect(poorBtn.className).toMatch(/ring-2/);
    expect(goodBtn.className).not.toMatch(/ring-2/);
  });

  it("includes quality in PATCH when editing an existing feed", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const event = { id: 5, user_id: 2, type: "bottle", started_at: "2024-01-15T10:00:00Z" };
    render(<FeedForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await user.click(screen.getByText("Poor").closest("button"));
    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse(patchCall[1].body);
      expect(body.quality).toBe("poor");
    });
  });

  it("sends quality as null when no quality is selected", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<FeedForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    // Don't select any quality
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse(postCall[1].body);
      expect(body.quality).toBeNull();
    });
  });

  it("pre-selects quality when editing a feed with existing quality", async () => {
    const event = { id: 1, user_id: 2, type: "bottle", started_at: "2024-01-15T10:00:00Z", quality: "okay" };
    render(<FeedForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Okay")).toBeInTheDocument());

    const okayBtn = screen.getByText("Okay").closest("button");
    expect(okayBtn.className).toMatch(/ring-2/);

    const goodBtn = screen.getByText("Good").closest("button");
    expect(goodBtn.className).not.toMatch(/ring-2/);
  });

  it("renders cancel button only when onCancel provided", async () => {
    const { unmount } = render(<FeedForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    unmount();

    render(<FeedForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());
  });
});
