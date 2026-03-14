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

import MeasurementForm from "../components/forms/MeasurementForm";
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

describe("MeasurementForm", () => {
  it("renders all required fields", async () => {
    render(<MeasurementForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());
    expect(screen.getByText("Measured at")).toBeInTheDocument();
    expect(screen.getByText(/Weight/)).toBeInTheDocument();
    expect(screen.getByText(/Height/)).toBeInTheDocument();
    expect(screen.getByText("Head circumference (cm)")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("shows lbs+oz weight fields for imperial", async () => {
    render(<MeasurementForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Weight (lbs + oz)")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("lbs")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("oz")).toBeInTheDocument();
  });

  it("shows kg weight field for metric", async () => {
    useSettings.mockReturnValue({ settings: { units: "metric" } });
    render(<MeasurementForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Weight (kg)")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("kg")).toBeInTheDocument();
  });

  it("shows height in inches for imperial", async () => {
    render(<MeasurementForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Height (in)")).toBeInTheDocument());
  });

  it("shows height in cm for metric", async () => {
    useSettings.mockReturnValue({ settings: { units: "metric" } });
    render(<MeasurementForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Height (cm)")).toBeInTheDocument());
  });

  it("uses date input (not datetime-local) for measured_at", async () => {
    render(<MeasurementForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Measured at")).toBeInTheDocument());
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeTruthy();
  });

  it("shows Create button for new events", async () => {
    render(<MeasurementForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
  });

  it("shows Update button when editing", async () => {
    const event = { id: 1, user_id: 2, measured_at: "2024-01-15", weight_oz: 160 };
    render(<MeasurementForm event={event} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());
  });

  it("sends POST for new measurement", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<MeasurementForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      expect(postCall[0]).toBe(`/api/v1/babies/${BABY.id}/measurements`);
    });
  });

  it("sends PATCH for existing measurement", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const event = { id: 8, user_id: 2, measured_at: "2024-01-15" };
    render(<MeasurementForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall[0]).toBe(`/api/v1/babies/${BABY.id}/measurements/${event.id}`);
    });
  });

  it("converts imperial lbs+oz to total oz in submission body", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<MeasurementForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Logged by")).toBeInTheDocument());

    const lbsInput = screen.getByPlaceholderText("lbs");
    const ozInput = screen.getByPlaceholderText("oz");
    await user.type(lbsInput, "10");
    await user.type(ozInput, "4");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.weight_oz).toBe(10 * 16 + 4); // 164 oz
    });
  });

  it("does not submit when no baby is selected", async () => {
    useBaby.mockReturnValue({ selectedBaby: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<MeasurementForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => opts?.method === "POST"
      );
      expect(postCalls).toHaveLength(0);
    });
  });

  it("renders cancel button only when onCancel provided", async () => {
    render(<MeasurementForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
