import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));
vi.mock("../context/PersonaContext", () => ({
  usePersona: vi.fn(),
}));

import BurpForm from "../components/forms/BurpForm";
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

describe("BurpForm", () => {
  it("renders all required fields", async () => {
    render(<BurpForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());
    expect(screen.getByText("Started at")).toBeInTheDocument();
    expect(screen.getByText("Ended at")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("shows Create button for new events", async () => {
    render(<BurpForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
  });

  it("shows Update button when editing", async () => {
    const event = { id: 1, user_id: 2, started_at: "2024-01-15T10:00:00Z", ended_at: "2024-01-15T10:05:00Z", notes: "" };
    render(<BurpForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());
  });

  it("populates fields from existing event", async () => {
    const event = { id: 1, user_id: 2, started_at: "2024-01-15T10:00:00Z", ended_at: "2024-01-15T10:05:00Z", notes: "good burp" };
    render(<BurpForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("good burp")).toBeInTheDocument());
  });

  it("sends POST for new event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<BurpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      expect(postCall[0]).toBe(`/api/v1/babies/${BABY.id}/burps`);
      const body = JSON.parse(postCall[1].body);
      expect(body.user_id).toBe(PERSONA.id);
      expect(body.started_at).toBeDefined();
    });
  });

  it("sends PATCH for existing event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const event = { id: 3, user_id: 2, started_at: "2024-01-15T10:00:00Z" };
    render(<BurpForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall[0]).toBe(`/api/v1/babies/${BABY.id}/burps/${event.id}`);
    });
  });

  it("does not submit when no baby is selected", async () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<BurpForm onSaved={onSaved} />);
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
    render(<BurpForm onSaved={onSaved} />);
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
    render(<BurpForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("renders cancel button when onCancel is provided", async () => {
    render(<BurpForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<BurpForm onSaved={vi.fn()} onCancel={onCancel} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onSaved after successful POST", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<BurpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({ id: 99 });
    });
  });

  it("does not call onSaved when POST fails", async () => {
    global.fetch = vi.fn((url) => {
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(USERS) });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<BurpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCalls.length).toBeGreaterThan(0);
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("trims notes whitespace before sending", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<BurpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Notes")).toBeInTheDocument());

    const notesField = screen.getByRole("textbox");
    await user.type(notesField, "  some notes  ");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.notes).toBe("some notes");
    });
  });

  it("sends null notes when notes is empty string", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<BurpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.notes).toBeNull();
    });
  });
});
