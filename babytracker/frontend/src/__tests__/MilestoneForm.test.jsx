import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/BabyContext", () => ({
  useBaby: vi.fn(),
}));
vi.mock("../context/PersonaContext", () => ({
  usePersona: vi.fn(),
}));

import MilestoneForm from "../components/forms/MilestoneForm";
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

describe("MilestoneForm", () => {
  it("renders all required fields", async () => {
    render(<MilestoneForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("uses date input for occurred_at", async () => {
    render(<MilestoneForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Date")).toBeInTheDocument());
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeTruthy();
  });

  it("has a required title field with placeholder", async () => {
    render(<MilestoneForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText("e.g. First smile")).toBeInTheDocument());
  });

  it("shows Create button for new events", async () => {
    render(<MilestoneForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
  });

  it("shows Update button when editing", async () => {
    const event = { id: 1, user_id: 2, occurred_at: "2024-01-15", title: "First smile", notes: "" };
    render(<MilestoneForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());
  });

  it("populates fields from existing event", async () => {
    const event = { id: 1, user_id: 2, occurred_at: "2024-06-15", title: "First tooth", notes: "bottom front" };
    render(<MilestoneForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("First tooth")).toBeInTheDocument());
    expect(screen.getByDisplayValue("bottom front")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2024-06-15")).toBeInTheDocument();
  });

  it("sends POST for new milestone", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<MilestoneForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    const titleInput = screen.getByPlaceholderText("e.g. First smile");
    await user.type(titleInput, "First word");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      expect(postCall[0]).toBe(`/api/v1/babies/${BABY.id}/milestones`);
      const body = JSON.parse(postCall[1].body);
      expect(body.title).toBe("First word");
      expect(body.user_id).toBe(PERSONA.id);
    });
  });

  it("sends PATCH for existing milestone", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const event = { id: 4, user_id: 2, occurred_at: "2024-01-15", title: "First smile", notes: "" };
    render(<MilestoneForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall[0]).toBe(`/api/v1/babies/${BABY.id}/milestones/${event.id}`);
    });
  });

  it("does not submit when no baby is selected", async () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<MilestoneForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());

    const titleInput = screen.getByPlaceholderText("e.g. First smile");
    await user.type(titleInput, "Test");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCalls).toHaveLength(0);
    });
  });

  it("trims title on submission", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<MilestoneForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    const titleInput = screen.getByPlaceholderText("e.g. First smile");
    await user.type(titleInput, "  First laugh  ");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.title).toBe("First laugh");
    });
  });

  it("renders cancel button only when onCancel provided", async () => {
    render(<MilestoneForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("loads users into the logged-by dropdown", async () => {
    render(<MilestoneForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Mom")).toBeInTheDocument());
    expect(screen.getByText("Dad")).toBeInTheDocument();
  });
});
