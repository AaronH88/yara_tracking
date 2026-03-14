import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BabyProvider } from "../context/BabyContext";
import BabySwitcher from "../components/BabySwitcher";

const BABY_A = { id: 1, name: "Alice", birthdate: "2025-12-01" };
const BABY_B = { id: 2, name: "Bob", birthdate: "2025-06-01" };

function mockFetchBabies(babies) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(babies),
    }),
  );
}

async function renderSwitcher(babies = [BABY_A]) {
  mockFetchBabies(babies);
  let result;
  await act(async () => {
    result = render(
      <BabyProvider>
        <BabySwitcher />
      </BabyProvider>,
    );
  });
  return result;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BabySwitcher — single baby", () => {
  it("displays the selected baby name", async () => {
    await renderSwitcher([BABY_A]);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("displays baby age next to the name", async () => {
    await renderSwitcher([BABY_A]);
    // Age should appear in either weeks or months format
    expect(screen.getByText(/\d+(w|mo)/)).toBeInTheDocument();
  });

  it("does not show dropdown arrow for single baby", async () => {
    await renderSwitcher([BABY_A]);
    const button = screen.getByRole("button");
    const svg = button.querySelector("svg");
    expect(svg).toBeNull();
  });

  it("does not open dropdown when clicking with single baby", async () => {
    const user = userEvent.setup();
    await renderSwitcher([BABY_A]);
    await user.click(screen.getByRole("button"));
    // Only the trigger button should exist — no dropdown items
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("BabySwitcher — multiple babies", () => {
  it("shows dropdown arrow when multiple babies exist", async () => {
    await renderSwitcher([BABY_A, BABY_B]);
    const button = screen.getByRole("button");
    const svg = button.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("opens dropdown with all babies on click", async () => {
    const user = userEvent.setup();
    await renderSwitcher([BABY_A, BABY_B]);

    await user.click(screen.getByText("Alice"));

    // Both babies should be listed in dropdown
    const buttons = screen.getAllByRole("button");
    const dropdownButtons = buttons.filter(
      (b) => b.textContent.includes("Alice") || b.textContent.includes("Bob"),
    );
    // The trigger button + 2 dropdown items
    expect(dropdownButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("switches baby when clicking another baby in dropdown", async () => {
    const user = userEvent.setup();
    await renderSwitcher([BABY_A, BABY_B]);

    // Open dropdown
    await user.click(screen.getByText("Alice"));

    // Click Bob in the dropdown
    const bobButtons = screen.getAllByRole("button").filter((b) => b.textContent.includes("Bob"));
    await user.click(bobButtons[0]);

    // The main display should now show Bob
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("closes dropdown after selecting a baby", async () => {
    const user = userEvent.setup();
    await renderSwitcher([BABY_A, BABY_B]);

    // Open dropdown
    await user.click(screen.getByText("Alice"));

    // Click Bob
    const bobButtons = screen.getAllByRole("button").filter((b) => b.textContent.includes("Bob"));
    await user.click(bobButtons[0]);

    // Dropdown should be closed — only one set of baby names visible
    const allButtons = screen.getAllByRole("button");
    expect(allButtons).toHaveLength(1);
  });

  it("persists selected baby to localStorage", async () => {
    const user = userEvent.setup();
    await renderSwitcher([BABY_A, BABY_B]);

    // Open dropdown
    await user.click(screen.getByText("Alice"));

    // Click Bob
    const bobButtons = screen.getAllByRole("button").filter((b) => b.textContent.includes("Bob"));
    await user.click(bobButtons[0]);

    expect(localStorage.getItem("selectedBabyId")).toBe("2");
  });

  it("highlights the currently selected baby in the dropdown", async () => {
    const user = userEvent.setup();
    await renderSwitcher([BABY_A, BABY_B]);

    // Open dropdown
    await user.click(screen.getByText("Alice"));

    // Alice's dropdown item should be highlighted (bg-blue-50)
    const dropdownButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent.includes("Alice") && b.className.includes("bg-blue-50"),
    );
    expect(dropdownButtons.length).toBeGreaterThanOrEqual(1);
  });
});

describe("BabySwitcher — age formatting", () => {
  it("shows age in weeks for babies less than 1 month old", async () => {
    // Use a birthdate close enough to today that it's always < 1 month
    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);
    const birthdate = twoWeeksAgo.toISOString().split("T")[0];
    const newborn = { id: 3, name: "Newbie", birthdate };
    await renderSwitcher([newborn]);
    expect(screen.getByText(/2w/)).toBeInTheDocument();
  });

  it("shows age in months for babies older than 1 month", async () => {
    // Use a birthdate 3 months ago
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    const birthdate = threeMonthsAgo.toISOString().split("T")[0];
    const baby = { id: 4, name: "Older", birthdate };
    await renderSwitcher([baby]);
    expect(screen.getByText(/3mo/)).toBeInTheDocument();
  });
});

describe("BabySwitcher — no baby selected", () => {
  it("renders nothing when no baby is selected (empty babies list)", async () => {
    mockFetchBabies([]);
    const { container } = await act(async () =>
      render(
        <BabyProvider>
          <BabySwitcher />
        </BabyProvider>,
      ),
    );
    // The component returns null when no selectedBaby
    expect(container.textContent).toBe("");
  });
});
