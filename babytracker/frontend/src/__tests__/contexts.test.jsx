import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
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
      <button onClick={() => toggleDark()}>toggle dark</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

describe("PersonaContext", () => {
  it("defaults to null when no persona in localStorage", () => {
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    expect(screen.getByTestId("persona")).toHaveTextContent("null");
  });

  it("reads initial persona from localStorage", () => {
    localStorage.setItem("babytracker_persona", JSON.stringify({ userId: 2, userName: "Dad" }));
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    expect(screen.getByTestId("persona")).toHaveTextContent('{"userId":2,"userName":"Dad"}');
  });

  it("persists persona to localStorage on setPersona", async () => {
    const user = userEvent.setup();
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    await user.click(screen.getByText("set persona"));
    expect(screen.getByTestId("persona")).toHaveTextContent('{"userId":1,"userName":"Mom"}');
    expect(localStorage.getItem("babytracker_persona")).toBe(
      JSON.stringify({ userId: 1, userName: "Mom" }),
    );
  });

  it("clears persona from localStorage on clearPersona", async () => {
    localStorage.setItem("babytracker_persona", JSON.stringify({ userId: 1, userName: "Mom" }));
    const user = userEvent.setup();
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    await user.click(screen.getByText("clear persona"));
    expect(screen.getByTestId("persona")).toHaveTextContent("null");
    expect(localStorage.getItem("babytracker_persona")).toBeNull();
  });
});

describe("BabyContext", () => {
  it("defaults to empty babies and null selectedBaby", async () => {
    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await act(() => Promise.resolve());
    expect(screen.getByTestId("babies")).toHaveTextContent("[]");
    expect(screen.getByTestId("baby")).toHaveTextContent("null");
  });

  it("fetches babies from API and auto-selects first", async () => {
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

    expect(screen.getByTestId("babies")).toHaveTextContent(JSON.stringify(mockBabies));
    expect(screen.getByTestId("baby")).toHaveTextContent(JSON.stringify(mockBabies[0]));
    expect(localStorage.getItem("selectedBabyId")).toBe("1");
  });

  it("restores selected baby from localStorage", async () => {
    localStorage.setItem("selectedBabyId", "2");
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

    expect(screen.getByTestId("baby")).toHaveTextContent(JSON.stringify(mockBabies[1]));
  });

  it("allows setting a baby via setSelectedBaby", async () => {
    const user = userEvent.setup();
    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await act(() => Promise.resolve());
    await user.click(screen.getByText("set baby"));
    expect(screen.getByTestId("baby")).toHaveTextContent('{"id":2,"name":"Baby2"}');
    expect(localStorage.getItem("selectedBabyId")).toBe("2");
  });
});

describe("SettingsContext", () => {
  it("has default settings with imperial units and 24h time format", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false }),
    );
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

  it("fetches settings from API on mount", async () => {
    const serverSettings = { units: "metric", time_format: "12h" };
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(serverSettings) }),
    );

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    const parsed = JSON.parse(screen.getByTestId("settings").textContent);
    expect(parsed.units).toBe("metric");
    expect(parsed.time_format).toBe("12h");
  });

  it("updates a setting via updateSetting", async () => {
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

    await user.click(screen.getByText("change units"));

    const parsed = JSON.parse(screen.getByTestId("settings").textContent);
    expect(parsed.units).toBe("metric");
  });

  it("toggles dark mode and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByTestId("isDark")).toHaveTextContent("false");

    await user.click(screen.getByText("toggle dark"));
    expect(screen.getByTestId("isDark")).toHaveTextContent("true");
    expect(localStorage.getItem("darkMode")).toBe("true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(screen.getByText("toggle dark"));
    expect(screen.getByTestId("isDark")).toHaveTextContent("false");
    expect(localStorage.getItem("darkMode")).toBe("false");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reads dark mode from localStorage on init", async () => {
    localStorage.setItem("darkMode", "true");
    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByTestId("isDark")).toHaveTextContent("true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
