import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));
vi.mock("../context/PersonaContext", () => ({
  usePersona: vi.fn(),
}));

import SleepForm from "../components/forms/SleepForm";
import { useBaby } from "../context/BabyContext";
import { usePersona } from "../context/PersonaContext";

const BABY = { id: 1, name: "TestBaby" };
const PERSONA = { id: 2, name: "Mom" };
const USERS = [
  { id: 2, name: "Mom" },
  { id: 3, name: "Dad" },
];

beforeEach(() => {
  useBaby.mockReturnValue({ selectedBaby: BABY });
  usePersona.mockReturnValue({ persona: PERSONA });
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

describe("SleepForm", () => {
  it("renders all required fields", async () => {
    render(<SleepForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Started at")).toBeInTheDocument();
    expect(screen.getByText("Ended at")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("renders nap and night type options", async () => {
    render(<SleepForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Nap")).toBeInTheDocument());
    expect(screen.getByText("Night")).toBeInTheDocument();
  });

  it("shows Create button for new events", async () => {
    render(<SleepForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
  });

  it("shows Update button when editing", async () => {
    const event = { id: 1, user_id: 2, type: "nap", started_at: "2024-01-15T10:00:00Z", ended_at: "2024-01-15T11:00:00Z", notes: "" };
    render(<SleepForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());
  });

  it("populates fields from existing event", async () => {
    const event = { id: 1, user_id: 2, type: "night", started_at: "2024-01-15T20:00:00Z", ended_at: "2024-01-16T06:00:00Z", notes: "slept well" };
    render(<SleepForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Night")).toBeInTheDocument());
    expect(screen.getByDisplayValue("slept well")).toBeInTheDocument();
  });

  it("sends POST for new event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<SleepForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      expect(postCall[0]).toBe(`/api/v1/babies/${BABY.id}/sleeps`);
      const body = JSON.parse(postCall[1].body);
      expect(body.type).toBe("nap");
      expect(body.user_id).toBe(PERSONA.id);
    });
  });

  it("sends PATCH for existing event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const event = { id: 3, user_id: 2, type: "nap", started_at: "2024-01-15T10:00:00Z" };
    render(<SleepForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall[0]).toBe(`/api/v1/babies/${BABY.id}/sleeps/${event.id}`);
    });
  });

  it("does not submit when no baby is selected", async () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<SleepForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCalls).toHaveLength(0);
    });
  });

  it("sends null ended_at when not provided", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<SleepForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.ended_at).toBeNull();
    });
  });

  it("renders cancel button only when onCancel provided", async () => {
    render(<SleepForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
