import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsProvider } from "../context/SettingsContext";
import { PersonaProvider } from "../context/PersonaContext";
import Settings from "../pages/Settings";

function renderSettings() {
  return render(
    <SettingsProvider>
      <PersonaProvider>
        <Settings />
      </PersonaProvider>
    </SettingsProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");

  // Default fetch mock for settings API
  global.fetch = vi.fn((url, options) => {
    if (url === "/api/v1/settings" && (!options || !options.method || options.method === "GET")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ units: "imperial", time_format: "24h" }),
      });
    }
    if (url === "/api/v1/settings" && options?.method === "PATCH") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

describe("Settings — rendering", () => {
  it("renders the Settings heading", async () => {
    await act(async () => {
      renderSettings();
    });

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders all five sections: Dark Mode, Units, Time Format, Who Am I, About", async () => {
    await act(async () => {
      renderSettings();
    });

    expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    expect(screen.getByText("Units")).toBeInTheDocument();
    expect(screen.getByText("Time Format")).toBeInTheDocument();
    expect(screen.getByText("Who Am I")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("shows app name and version in About section", async () => {
    await act(async () => {
      renderSettings();
    });

    expect(screen.getByText("Baby Tracker")).toBeInTheDocument();
    expect(screen.getByText("Version 1.0.0")).toBeInTheDocument();
  });
});

describe("Settings — Dark Mode toggle", () => {
  it("renders a toggle switch with role='switch'", async () => {
    await act(async () => {
      renderSettings();
    });

    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
  });

  it("shows 'Off' when dark mode is off", async () => {
    await act(async () => {
      renderSettings();
    });

    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("toggles dark mode on click and updates aria-checked", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("On")).toBeInTheDocument();
  });

  it("applies 'dark' class to document.documentElement when toggled on", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(screen.getByRole("switch"));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes 'dark' class when toggled off after being on", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    const toggle = screen.getByRole("switch");
    await user.click(toggle); // on
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(toggle); // off
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists dark mode preference in localStorage", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    await user.click(screen.getByRole("switch"));

    expect(localStorage.getItem("darkMode")).toBe("true");
  });
});

describe("Settings — Units", () => {
  it("renders imperial and metric radio options", async () => {
    await act(async () => {
      renderSettings();
    });

    expect(screen.getByText("Imperial (oz, lbs, in)")).toBeInTheDocument();
    expect(screen.getByText("Metric (ml, kg, cm)")).toBeInTheDocument();
  });

  it("has imperial selected by default", async () => {
    await act(async () => {
      renderSettings();
    });

    const imperialRadio = screen.getByLabelText("Imperial (oz, lbs, in)");
    expect(imperialRadio).toBeChecked();

    const metricRadio = screen.getByLabelText("Metric (ml, kg, cm)");
    expect(metricRadio).not.toBeChecked();
  });

  it("calls updateSetting via PATCH when switching to metric", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    await user.click(screen.getByLabelText("Metric (ml, kg, cm)"));

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/settings", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ units: "metric" }),
    }));
  });

  it("updates UI immediately when switching units (optimistic update)", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    await user.click(screen.getByLabelText("Metric (ml, kg, cm)"));

    expect(screen.getByLabelText("Metric (ml, kg, cm)")).toBeChecked();
    expect(screen.getByLabelText("Imperial (oz, lbs, in)")).not.toBeChecked();
  });

  it("calls PATCH when switching back to imperial", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    // Switch to metric first
    await user.click(screen.getByLabelText("Metric (ml, kg, cm)"));
    // Switch back to imperial
    await user.click(screen.getByLabelText("Imperial (oz, lbs, in)"));

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/settings", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ units: "imperial" }),
    }));
  });
});

describe("Settings — Time Format", () => {
  it("renders 24-hour and 12-hour radio options", async () => {
    await act(async () => {
      renderSettings();
    });

    expect(screen.getByText("24-hour")).toBeInTheDocument();
    expect(screen.getByText("12-hour")).toBeInTheDocument();
  });

  it("has 24-hour selected by default", async () => {
    await act(async () => {
      renderSettings();
    });

    expect(screen.getByLabelText("24-hour")).toBeChecked();
    expect(screen.getByLabelText("12-hour")).not.toBeChecked();
  });

  it("calls PATCH when switching to 12-hour format", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    await user.click(screen.getByLabelText("12-hour"));

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/settings", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ time_format: "12h" }),
    }));
  });

  it("updates the radio selection immediately on click", async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderSettings();
    });

    await user.click(screen.getByLabelText("12-hour"));

    expect(screen.getByLabelText("12-hour")).toBeChecked();
    expect(screen.getByLabelText("24-hour")).not.toBeChecked();
  });
});

describe("Settings — Who Am I (persona)", () => {
  it("displays the current persona name", async () => {
    // Set persona in localStorage before rendering
    localStorage.setItem("babytracker_persona", JSON.stringify({ id: 1, name: "Mom" }));

    await act(async () => {
      renderSettings();
    });

    expect(screen.getByText("Mom")).toBeInTheDocument();
    expect(screen.getByText(/logged in as/i)).toBeInTheDocument();
  });

  it("renders a Switch User button", async () => {
    localStorage.setItem("babytracker_persona", JSON.stringify({ id: 1, name: "Mom" }));

    await act(async () => {
      renderSettings();
    });

    expect(screen.getByRole("button", { name: /switch user/i })).toBeInTheDocument();
  });

  it("clears persona when Switch User is clicked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("babytracker_persona", JSON.stringify({ id: 1, name: "Mom" }));

    await act(async () => {
      renderSettings();
    });

    await user.click(screen.getByRole("button", { name: /switch user/i }));

    // Persona should be cleared from localStorage
    expect(localStorage.getItem("babytracker_persona")).toBeNull();
  });

  it("has minimum 48px tap target on Switch User button (mobile-first)", async () => {
    localStorage.setItem("babytracker_persona", JSON.stringify({ id: 1, name: "Mom" }));

    await act(async () => {
      renderSettings();
    });

    const button = screen.getByRole("button", { name: /switch user/i });
    expect(button.className).toContain("min-h-[48px]");
  });
});

describe("Settings — radio tap targets", () => {
  it("all radio labels have minimum 48px height for mobile tap targets", async () => {
    await act(async () => {
      renderSettings();
    });

    // All radio labels should have min-h-[48px]
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      expect(label.className).toContain("min-h-[48px]");
    }
  });
});

describe("Settings — server settings integration", () => {
  it("reflects server settings when API returns metric and 12h", async () => {
    global.fetch = vi.fn((url) => {
      if (url === "/api/v1/settings") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ units: "metric", time_format: "12h" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    await act(async () => {
      renderSettings();
    });

    expect(screen.getByLabelText("Metric (ml, kg, cm)")).toBeChecked();
    expect(screen.getByLabelText("12-hour")).toBeChecked();
  });

  it("falls back to defaults when settings API fails", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    await act(async () => {
      renderSettings();
    });

    // Defaults: imperial and 24h
    expect(screen.getByLabelText("Imperial (oz, lbs, in)")).toBeChecked();
    expect(screen.getByLabelText("24-hour")).toBeChecked();
  });
});
