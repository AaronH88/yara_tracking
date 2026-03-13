import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaProvider, usePersona } from "../context/PersonaContext";
import { BabyProvider, useBaby } from "../context/BabyContext";
import { SettingsProvider, useSettings } from "../context/SettingsContext";

// Test consumer components that exercise each context
function PersonaConsumer() {
  const { persona, setPersona } = usePersona();
  return (
    <div>
      <span data-testid="persona">{persona ? JSON.stringify(persona) : "null"}</span>
      <button onClick={() => setPersona({ name: "Mom" })}>set persona</button>
    </div>
  );
}

function BabyConsumer() {
  const { selectedBaby, setSelectedBaby } = useBaby();
  return (
    <div>
      <span data-testid="baby">{selectedBaby ? JSON.stringify(selectedBaby) : "null"}</span>
      <button onClick={() => setSelectedBaby({ id: 1, name: "Baby" })}>set baby</button>
    </div>
  );
}

function SettingsConsumer() {
  const { settings, setSettings } = useSettings();
  return (
    <div>
      <span data-testid="settings">{JSON.stringify(settings)}</span>
      <button onClick={() => setSettings({ units: "metric", time_format: "12h" })}>
        change settings
      </button>
    </div>
  );
}

describe("PersonaContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to null when no persona in localStorage", () => {
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    expect(screen.getByTestId("persona")).toHaveTextContent("null");
  });

  it("reads initial persona from localStorage", () => {
    localStorage.setItem("persona", JSON.stringify({ name: "Dad" }));
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    expect(screen.getByTestId("persona")).toHaveTextContent('{"name":"Dad"}');
  });

  it("allows updating persona via setPersona", async () => {
    const user = userEvent.setup();
    render(
      <PersonaProvider>
        <PersonaConsumer />
      </PersonaProvider>,
    );
    await user.click(screen.getByText("set persona"));
    expect(screen.getByTestId("persona")).toHaveTextContent('{"name":"Mom"}');
  });
});

describe("BabyContext", () => {
  it("defaults selectedBaby to null", () => {
    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    expect(screen.getByTestId("baby")).toHaveTextContent("null");
  });

  it("allows setting a baby via setSelectedBaby", async () => {
    const user = userEvent.setup();
    render(
      <BabyProvider>
        <BabyConsumer />
      </BabyProvider>,
    );
    await user.click(screen.getByText("set baby"));
    expect(screen.getByTestId("baby")).toHaveTextContent('{"id":1,"name":"Baby"}');
  });
});

describe("SettingsContext", () => {
  it("has default settings with imperial units and 24h time format", () => {
    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    const settingsText = screen.getByTestId("settings").textContent;
    const parsed = JSON.parse(settingsText);
    expect(parsed.units).toBe("imperial");
    expect(parsed.time_format).toBe("24h");
  });

  it("allows overriding settings", async () => {
    const user = userEvent.setup();
    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );
    await user.click(screen.getByText("change settings"));
    const settingsText = screen.getByTestId("settings").textContent;
    const parsed = JSON.parse(settingsText);
    expect(parsed.units).toBe("metric");
    expect(parsed.time_format).toBe("12h");
  });
});
