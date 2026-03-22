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

// ---- Wet Amount selector ----

describe("DiaperForm — wet amount selector", () => {
  it("shows wet amount buttons when type is wet", async () => {
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Wet Amount")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Small" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Medium" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heavy" })).toBeInTheDocument();
  });

  it("shows wet amount buttons when type is both", async () => {
    const user = userEvent.setup();
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Wet"), "both");
    expect(screen.getByText("Wet Amount")).toBeInTheDocument();
  });

  it("hides wet amount buttons when type is dirty", async () => {
    const user = userEvent.setup();
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Wet"), "dirty");
    expect(screen.queryByText("Wet Amount")).not.toBeInTheDocument();
  });

  it("selects a wet amount on click", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Wet Amount")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Medium" }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.wet_amount).toBe("medium");
    });
  });

  it("toggles wet amount off when clicked again (deselect)", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Wet Amount")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Small" }));
    await user.click(screen.getByRole("button", { name: "Small" }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.wet_amount).toBeNull();
    });
  });

  it("sends null wet_amount when type is dirty", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());

    // Select a wet amount first
    await user.click(screen.getByRole("button", { name: "Heavy" }));
    // Then switch to dirty
    await user.selectOptions(screen.getByDisplayValue("Wet"), "dirty");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.wet_amount).toBeNull();
    });
  });

  it("pre-fills wet amount from existing event", async () => {
    const event = { id: 5, user_id: 2, type: "wet", wet_amount: "heavy", logged_at: "2024-01-15T10:00:00Z", notes: "" };
    const onSaved = vi.fn();
    render(<DiaperForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Wet Amount")).toBeInTheDocument());

    // Submit without changing anything — should preserve pre-filled value
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      const body = JSON.parse(patchCall[1].body);
      expect(body.wet_amount).toBe("heavy");
    });
  });
});

// ---- Dirty Colour selector ----

describe("DiaperForm — dirty colour selector", () => {
  it("shows colour buttons when type is dirty", async () => {
    const user = userEvent.setup();
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Wet"), "dirty");
    expect(screen.getByText("Colour")).toBeInTheDocument();
    expect(screen.getByText("Yellow")).toBeInTheDocument();
    expect(screen.getByText("Green")).toBeInTheDocument();
    expect(screen.getByText("Brown")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("shows colour buttons when type is both", async () => {
    const user = userEvent.setup();
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Wet"), "both");
    expect(screen.getByText("Colour")).toBeInTheDocument();
  });

  it("hides colour buttons when type is wet", async () => {
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    expect(screen.queryByText("Colour")).not.toBeInTheDocument();
  });

  it("selects a dirty colour on click", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Wet"), "dirty");

    await user.click(screen.getByText("Brown"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.dirty_colour).toBe("brown");
    });
  });

  it("toggles dirty colour off when clicked again", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Wet"), "dirty");

    await user.click(screen.getByText("Green"));
    await user.click(screen.getByText("Green"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.dirty_colour).toBeNull();
    });
  });

  it("sends null dirty_colour when type is wet", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.dirty_colour).toBeNull();
    });
  });

  it("pre-fills dirty colour from existing event", async () => {
    const event = { id: 6, user_id: 2, type: "dirty", dirty_colour: "green", logged_at: "2024-01-15T10:00:00Z", notes: "" };
    const onSaved = vi.fn();
    render(<DiaperForm event={event} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText("Colour")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "PATCH"
      );
      const body = JSON.parse(patchCall[1].body);
      expect(body.dirty_colour).toBe("green");
    });
  });

  it("shows both wet amount and colour when type is both", async () => {
    const user = userEvent.setup();
    render(<DiaperForm onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Wet"), "both");
    expect(screen.getByText("Wet Amount")).toBeInTheDocument();
    expect(screen.getByText("Colour")).toBeInTheDocument();
  });

  it("submits both wet_amount and dirty_colour when type is both", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<DiaperForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByDisplayValue("Wet")).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Wet"), "both");

    await user.click(screen.getByRole("button", { name: "Medium" }));
    await user.click(screen.getByText("Yellow"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => opts?.method === "POST"
      );
      const body = JSON.parse(postCall[1].body);
      expect(body.wet_amount).toBe("medium");
      expect(body.dirty_colour).toBe("yellow");
    });
  });
});
