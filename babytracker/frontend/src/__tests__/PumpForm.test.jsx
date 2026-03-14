import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/PersonaContext", () => ({
  usePersona: vi.fn(),
}));
vi.mock("../context/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

import PumpForm from "../components/forms/PumpForm";
import { usePersona } from "../context/PersonaContext";
import { useSettings } from "../context/SettingsContext";

const PERSONA = { id: 2, name: "Mom" };
const USERS = [
  { id: 2, name: "Mom" },
  { id: 3, name: "Dad" },
];

beforeEach(() => {
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

describe("PumpForm", () => {
  it("renders all required fields", async () => {
    render(<PumpForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());
    expect(screen.getByText("Started at")).toBeInTheDocument();
    expect(screen.getByText("Duration (minutes)")).toBeInTheDocument();
    expect(screen.getByText(/Left/)).toBeInTheDocument();
    expect(screen.getByText(/Right/)).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("shows oz labels when imperial", async () => {
    render(<PumpForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Left (oz)")).toBeInTheDocument());
    expect(screen.getByText("Right (oz)")).toBeInTheDocument();
  });

  it("shows ml labels when metric", async () => {
    useSettings.mockReturnValue({ settings: { units: "metric" } });
    render(<PumpForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Left (ml)")).toBeInTheDocument());
    expect(screen.getByText("Right (ml)")).toBeInTheDocument();
  });

  it("shows Create button for new events", async () => {
    render(<PumpForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
  });

  it("shows Update button when editing", async () => {
    const event = { id: 1, user_id: 2, logged_at: "2024-01-15T10:00:00Z", duration_minutes: 20 };
    render(<PumpForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());
  });

  it("sends POST for new pump event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<PumpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      expect(postCall[0]).toBe("/api/v1/pumps");
    });
  });

  it("sends PATCH for existing pump event", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const event = { id: 5, user_id: 2, logged_at: "2024-01-15T10:00:00Z" };
    render(<PumpForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall[0]).toBe(`/api/v1/pumps/${event.id}`);
    });
  });

  it("sends left_oz and right_oz for imperial units", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<PumpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    const leftLabel = screen.getByText(/Left/i);
    const leftInput = leftLabel.closest("div").querySelector("input");
    const rightLabel = screen.getByText(/Right/i);
    const rightInput = rightLabel.closest("div").querySelector("input");
    await user.type(leftInput, "3");
    await user.type(rightInput, "2");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.left_oz).toBe(3);
      expect(body.right_oz).toBe(2);
      expect(body.left_ml).toBeUndefined();
      expect(body.right_ml).toBeUndefined();
    });
  });

  it("sends left_ml and right_ml for metric units", async () => {
    useSettings.mockReturnValue({ settings: { units: "metric" } });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<PumpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    const leftLabel = screen.getByText(/Left/i);
    const leftInput = leftLabel.closest("div").querySelector("input");
    const rightLabel = screen.getByText(/Right/i);
    const rightInput = rightLabel.closest("div").querySelector("input");
    await user.type(leftInput, "90");
    await user.type(rightInput, "80");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.left_ml).toBe(90);
      expect(body.right_ml).toBe(80);
      expect(body.left_oz).toBeUndefined();
      expect(body.right_oz).toBeUndefined();
    });
  });

  it("sends duration_minutes when provided", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<PumpForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    const durationLabel = screen.getByText(/Duration/i);
    const durationInput = durationLabel.closest("div").querySelector("input");
    await user.type(durationInput, "15");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.duration_minutes).toBe(15);
    });
  });

  it("renders cancel button only when onCancel provided", async () => {
    render(<PumpForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
