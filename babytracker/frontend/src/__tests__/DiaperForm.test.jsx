import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));
vi.mock("../context/PersonaContext", () => ({
  usePersona: vi.fn(),
}));

import DiaperForm from "../components/forms/DiaperForm";
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

describe("DiaperForm", () => {
  it("renders all required fields for create mode", async () => {
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Logged at")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("shows Update button when editing an existing event", async () => {
    const event = { id: 5, user_id: 2, type: "dirty", logged_at: "2024-01-15T10:00:00Z", notes: "test" };
    render(<DiaperForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());
  });

  it("populates fields from existing event data", async () => {
    const event = { id: 5, user_id: 2, type: "dirty", logged_at: "2024-01-15T10:00:00Z", notes: "messy one" };
    render(<DiaperForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Dirty")).toBeInTheDocument());
    expect(screen.getByDisplayValue("messy one")).toBeInTheDocument();
  });

  it("renders cancel button when onCancel is provided", async () => {
    render(<DiaperForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());
  });

  it("does not render cancel button when onCancel is absent", async () => {
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<DiaperForm onSaved={vi.fn()} onCancel={onCancel} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("submits POST request for new diaper event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      expect(postCall[0]).toBe(`/api/v1/babies/${BABY.id}/diapers`);
      const body = JSON.parse(postCall[1].body);
      expect(body.type).toBe("wet");
      expect(body.user_id).toBe(PERSONA.id);
    });
    expect(onSaved).toHaveBeenCalledWith({ id: 99 });
  });

  it("submits PATCH request when editing an existing event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const event = { id: 7, user_id: 2, type: "both", logged_at: "2024-01-15T10:00:00Z", notes: "" };
    render(<DiaperForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall[0]).toBe(`/api/v1/babies/${BABY.id}/diapers/${event.id}`);
    });
  });

  it("does not submit when no baby is selected", async () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCalls).toHaveLength(0);
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("loads users into the dropdown", async () => {
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Mom")).toBeInTheDocument());
    expect(screen.getByText("Dad")).toBeInTheDocument();
  });

  it("allows changing diaper type", async () => {
    const user = userEvent.setup();
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());

    await user.selectOptions(screen.getByDisplayValue("Wet"), "dirty");
    expect(screen.getByDisplayValue("Dirty")).toBeInTheDocument();
  });

  it("trims notes and sends null for empty notes", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DiaperForm onSaved={onSaved} />);
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
