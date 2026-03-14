import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaProvider, usePersona } from "../context/PersonaContext";
import { BabyProvider, useBaby } from "../context/BabyContext";
import { SettingsProvider, useSettings } from "../context/SettingsContext";

function PersonaConsumer() {
  const { persona, setPersona, clearPersona } = usePersona();
  return (
    <div>
      <span data-testid="persona">{persona ? JSON.stringify(persona) : "null"}</span>
      <button onClick={() => setPersona({ userId: 1, userName: "Mom" })}>set persona</button>
      <button onClick={() => clearPersona()}>clear persona</button>
    </div>
  );
}

function BabyConsumer() {
  const { babies, selectedBaby, setSelectedBaby } = useBaby();
  return (
    <div>
      <span data-testid="babies">{JSON.stringify(babies)}</span>
      <span data-testid="baby">{selectedBaby ? JSON.stringify(selectedBaby) : "null"}</span>
      <button onClick={() => setSelectedBaby({ id: 2, name: "Baby2" })}>set baby</button>
      <button onClick={() => setSelectedBaby(null)}>clear baby</button>
    </div>
  );
}

function SettingsConsumer() {
  const { settings, updateSetting, isDark, toggleDark } = useSettings();
  return (
    <div>
      <span data-testid="settings">{JSON.stringify(settings)}</span>
      <span data-testid="isDark">{String(isDark)}</span>
      <button onClick={() => updateSetting("units", "metric")}>change units</button>
      <button onClick={() => updateSetting("time_format", "12h")}>change time</button>
      <button onClick={() => toggleDark()}>toggle dark</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

describe("PersonaContext edge cases", () => {
  it("handles corrupted JSON in localStorage gracefully", () => {
    localStorage.setItem("babytracker_persona", "not-valid-json{{{");
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    expect(screen.getByTestId("persona")).toHaveTextContent("null");
    expect(localStorage.getItem("babytracker_persona")).toBeNull();
  });

  it("setPersona overwrites previous persona", async () => {
    localStorage.setItem(
      "babytracker_persona",
      JSON.stringify({ userId: 99, userName: "OldUser" }),
    );
    const user = userEvent.setup();
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    expect(screen.getByTestId("persona")).toHaveTextContent("OldUser");
    await user.click(screen.getByText("set persona"));
    expect(screen.getByTestId("persona")).toHaveTextContent('{"userId":1,"userName":"Mom"}');
    expect(localStorage.getItem("babytracker_persona")).toBe(
      JSON.stringify({ userId: 1, userName: "Mom" }),
    );
  });

  it("clearPersona then setPersona works correctly", async () => {
    localStorage.setItem(
      "babytracker_persona",
      JSON.stringify({ userId: 1, userName: "Mom" }),
    );
    const user = userEvent.setup();
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    await user.click(screen.getByText("clear persona"));
    expect(screen.getByTestId("persona")).toHaveTextContent("null");
    await user.click(screen.getByText("set persona"));
    expect(screen.getByTestId("persona")).toHaveTextContent('{"userId":1,"userName":"Mom"}');
    expect(localStorage.getItem("babytracker_persona")).not.toBeNull();
  });
});

describe("BabyContext edge cases", () => {
  it("falls back to first baby when stored ID does not exist in fetched list", async () => {
    localStorage.setItem("selectedBabyId", "999");
    const mockBabies = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockBabies) }),
    );

    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByTestId("baby")).toHaveTextContent(JSON.stringify(mockBabies[0]));
    expect(localStorage.getItem("selectedBabyId")).toBe("1");
  });

  it("keeps empty state when API returns not-ok response", async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));

    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByTestId("babies")).toHaveTextContent("[]");
    expect(screen.getByTestId("baby")).toHaveTextContent("null");
  });

  it("keeps empty state when fetch throws a network error", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByTestId("babies")).toHaveTextContent("[]");
    expect(screen.getByTestId("baby")).toHaveTextContent("null");
  });

  it("does not auto-select when API returns empty babies array", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
    );

    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByTestId("baby")).toHaveTextContent("null");
    expect(localStorage.getItem("selectedBabyId")).toBeNull();
  });

  it("setSelectedBaby(null) removes selectedBabyId from localStorage", async () => {
    const mockBabies = [{ id: 1, name: "Alice" }];
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockBabies) }),
    );
    const user = userEvent.setup();

    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await act(() => Promise.resolve());

    expect(localStorage.getItem("selectedBabyId")).toBe("1");

    await user.click(screen.getByText("clear baby"));
    expect(screen.getByTestId("baby")).toHaveTextContent("null");
    expect(localStorage.getItem("selectedBabyId")).toBeNull();
  });

  it("calls the correct API endpoint for babies", async () => {
    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await act(() => Promise.resolve());

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies");
  });
});

describe("SettingsContext edge cases", () => {
  it("keeps defaults when fetch throws a network error", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    const parsed = JSON.parse(screen.getByTestId("settings").textContent);
    expect(parsed.units).toBe("imperial");
    expect(parsed.time_format).toBe("24h");
  });

  it("updateSetting sends PATCH to /api/v1/settings with correct payload", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ units: "imperial", time_format: "24h" }) }),
    );
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    // Reset to track only the PATCH call
    global.fetch.mockClear();
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await user.click(screen.getByText("change units"));

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ units: "metric" }),
    });
  });

  it("updateSetting preserves other settings (only changes targeted key)", async () => {
    const serverSettings = { units: "imperial", time_format: "24h" };
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(serverSettings) }),
    );
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    await user.click(screen.getByText("change units"));

    const parsed = JSON.parse(screen.getByTestId("settings").textContent);
    expect(parsed.units).toBe("metric");
    expect(parsed.time_format).toBe("24h");
  });

  it("re-fetches settings on window focus event", async () => {
    const initialSettings = { units: "imperial", time_format: "24h" };
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(initialSettings) }),
    );

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    // First call is on mount
    const mountCallCount = global.fetch.mock.calls.length;

    // Simulate focus event
    const updatedSettings = { units: "metric", time_format: "12h" };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updatedSettings),
    });

    await act(async () => {
      fireEvent.focus(window);
    });

    expect(global.fetch.mock.calls.length).toBeGreaterThan(mountCallCount);
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/settings");
  });

  it("isDark defaults to false when localStorage has no darkMode and prefers-color-scheme is light", async () => {
    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByTestId("isDark")).toHaveTextContent("false");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("isDark is false when localStorage darkMode is explicitly 'false'", async () => {
    localStorage.setItem("darkMode", "false");
    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByTestId("isDark")).toHaveTextContent("false");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("updateSetting still updates state even if PATCH request fails", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ units: "imperial", time_format: "24h" }) }),
    );
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    // Make PATCH fail
    global.fetch.mockRejectedValue(new Error("Network error"));

    await user.click(screen.getByText("change units"));

    // Optimistic update should still be reflected
    const parsed = JSON.parse(screen.getByTestId("settings").textContent);
    expect(parsed.units).toBe("metric");
  });

  it("calls /api/v1/settings on mount", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/settings");
  });
});
