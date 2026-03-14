import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BabyProvider } from "../context/BabyContext";
import Admin from "../pages/Admin";

// Helper to mock fetch with different responses per URL
function mockFetchResponses(handlers) {
  return vi.fn((url, options) => {
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return Promise.resolve(handler(options));
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

function renderAdmin() {
  return render(
    <BabyProvider>
      <Admin />
    </BabyProvider>,
  );
}

const mockUsers = [
  { id: 1, name: "Mom" },
  { id: 2, name: "Dad" },
];

const mockBabies = [
  { id: 1, name: "Baby A", birthdate: "2025-06-01", gender: "female" },
  { id: 2, name: "Baby B", birthdate: "2025-09-15", gender: null },
];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Admin — initial rendering", () => {
  it("fetches and displays users and babies on mount", async () => {
    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve(mockUsers) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve(mockBabies) }),
    });

    await act(async () => {
      renderAdmin();
    });

    expect(screen.getByText("Mom")).toBeInTheDocument();
    expect(screen.getByText("Dad")).toBeInTheDocument();
    expect(screen.getByText("Baby A")).toBeInTheDocument();
    expect(screen.getByText("Baby B")).toBeInTheDocument();
  });

  it("renders section headings for Users and Babies", async () => {
    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve([]) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Babies")).toBeInTheDocument();
  });

  it("renders add user form with input and submit button", async () => {
    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve([]) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    expect(screen.getByPlaceholderText("New user name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
  });

  it("renders add baby form with name, date, gender and submit button", async () => {
    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve([]) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    expect(screen.getByPlaceholderText("Baby name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Baby" })).toBeInTheDocument();
    // Gender select should exist
    expect(screen.getByDisplayValue("Gender (optional)")).toBeInTheDocument();
  });

  it("shows baby birthdate and gender when present", async () => {
    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve([]) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve(mockBabies) }),
    });

    await act(async () => {
      renderAdmin();
    });

    expect(screen.getByText("2025-06-01")).toBeInTheDocument();
    expect(screen.getByText("female")).toBeInTheDocument();
    expect(screen.getByText("2025-09-15")).toBeInTheDocument();
  });
});

describe("Admin — add user", () => {
  it("sends POST to /api/v1/users with trimmed name and refreshes list", async () => {
    const user = userEvent.setup();
    let fetchCallCount = 0;

    global.fetch = vi.fn((url, options) => {
      if (url === "/api/v1/users" && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 3, name: "Grandma" }) });
      }
      if (url === "/api/v1/users") {
        fetchCallCount++;
        const users = fetchCallCount <= 1 ? mockUsers : [...mockUsers, { id: 3, name: "Grandma" }];
        return Promise.resolve({ ok: true, json: () => Promise.resolve(users) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    const input = screen.getByPlaceholderText("New user name");
    await user.type(input, "  Grandma  ");
    await user.click(screen.getByRole("button", { name: "Add User" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/users", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Grandma" }),
      }));
    });
  });

  it("clears the input after successful add", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url === "/api/v1/users" && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 3, name: "New" }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
    });

    await act(async () => {
      renderAdmin();
    });

    const input = screen.getByPlaceholderText("New user name");
    await user.type(input, "New");
    await user.click(screen.getByRole("button", { name: "Add User" }));

    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  it("shows error when creating a duplicate user (409)", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url === "/api/v1/users" && options?.method === "POST") {
        return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
    });

    await act(async () => {
      renderAdmin();
    });

    const input = screen.getByPlaceholderText("New user name");
    await user.type(input, "Mom");
    await user.click(screen.getByRole("button", { name: "Add User" }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it("does not submit when input is empty or whitespace only", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url) => {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes("users") ? mockUsers : []) });
    });

    await act(async () => {
      renderAdmin();
    });

    // Click add with empty input
    await user.click(screen.getByRole("button", { name: "Add User" }));

    // Type whitespace only
    const input = screen.getByPlaceholderText("New user name");
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "Add User" }));

    // No POST should have been made
    const postCalls = global.fetch.mock.calls.filter(
      ([, opts]) => opts?.method === "POST"
    );
    expect(postCalls).toHaveLength(0);
  });
});

describe("Admin — edit user", () => {
  it("opens edit modal with user name pre-filled when Edit is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve(mockUsers) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Edit Mom"));

    expect(screen.getByText("Edit User")).toBeInTheDocument();
    // The input in the modal should have "Mom" prefilled
    const editInput = screen.getByDisplayValue("Mom");
    expect(editInput).toBeInTheDocument();
  });

  it("sends PATCH to update user name and closes modal", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url.match(/\/api\/v1\/users\/\d+/) && options?.method === "PATCH") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, name: "Mama" }) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Edit Mom"));
    const editInput = screen.getByDisplayValue("Mom");
    await user.clear(editInput);
    await user.type(editInput, "Mama");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/users/1", expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Mama" }),
      }));
    });

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText("Edit User")).not.toBeInTheDocument();
    });
  });

  it("closes edit user modal when Cancel is clicked without saving", async () => {
    const user = userEvent.setup();

    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve(mockUsers) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Edit Mom"));
    expect(screen.getByText("Edit User")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Edit User")).not.toBeInTheDocument();
  });
});

describe("Admin — delete user", () => {
  it("shows confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve(mockUsers) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Delete Mom"));

    // The confirmation modal should appear with the user's name in a <strong> tag
    const modal = document.querySelector("div.fixed");
    expect(modal).toBeTruthy();
    expect(within(modal).getByText("Mom")).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("sends DELETE request and closes dialog on success", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url.match(/\/api\/v1\/users\/\d+/) && options?.method === "DELETE") {
        return Promise.resolve({ ok: true, status: 204 });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Delete Mom"));

    // Click the Delete button in the confirmation modal
    const modal = screen.getByText(/delete user/i).closest("div.fixed");
    const confirmBtn = within(modal).getAllByRole("button").find(b => b.textContent === "Delete");
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/users/1", expect.objectContaining({
        method: "DELETE",
      }));
    });
  });

  it("shows error when deleting a user who has logged events (409)", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url.match(/\/api\/v1\/users\/\d+/) && options?.method === "DELETE") {
        return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({}) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Delete Mom"));

    const modal = screen.getByText(/delete user/i).closest("div.fixed");
    const confirmBtn = within(modal).getAllByRole("button").find(b => b.textContent === "Delete");
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/has logged events/i)).toBeInTheDocument();
    });
  });

  it("closes delete confirmation when Cancel is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve(mockUsers) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Delete Mom"));
    expect(screen.getByText(/delete user/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // The confirmation text should be gone
    await waitFor(() => {
      expect(screen.queryByText(/delete user.*\?/i)).not.toBeInTheDocument();
    });
  });
});

describe("Admin — add baby", () => {
  it("sends POST with name, birthdate, and optional gender", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url === "/api/v1/babies" && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 3, name: "Baby C", birthdate: "2026-01-15", gender: "male" }) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBabies) });
    });

    await act(async () => {
      renderAdmin();
    });

    await user.type(screen.getByPlaceholderText("Baby name"), "Baby C");
    // Set date
    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, "2026-01-15");
    // Select gender
    await user.selectOptions(screen.getByDisplayValue("Gender (optional)"), "male");
    await user.click(screen.getByRole("button", { name: "Add Baby" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Baby C", birthdate: "2026-01-15", gender: "male" }),
      }));
    });
  });

  it("sends POST without gender field when gender is not selected", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url === "/api/v1/babies" && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 3, name: "Baby C", birthdate: "2026-01-15" }) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    await user.type(screen.getByPlaceholderText("Baby name"), "Baby C");
    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, "2026-01-15");
    await user.click(screen.getByRole("button", { name: "Add Baby" }));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([u, opts]) => u === "/api/v1/babies" && opts?.method === "POST"
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body).toEqual({ name: "Baby C", birthdate: "2026-01-15" });
      expect(body).not.toHaveProperty("gender");
    });
  });

  it("clears the form after successful baby creation", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url === "/api/v1/babies" && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 3, name: "Baby C", birthdate: "2026-01-15" }) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    const nameInput = screen.getByPlaceholderText("Baby name");
    await user.type(nameInput, "Baby C");
    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, "2026-01-15");
    await user.click(screen.getByRole("button", { name: "Add Baby" }));

    await waitFor(() => {
      expect(nameInput).toHaveValue("");
    });
  });

  it("shows error when baby creation fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url === "/api/v1/babies" && options?.method === "POST") {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    await user.type(screen.getByPlaceholderText("Baby name"), "Baby C");
    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, "2026-01-15");
    await user.click(screen.getByRole("button", { name: "Add Baby" }));

    await waitFor(() => {
      expect(screen.getByText(/failed to add baby/i)).toBeInTheDocument();
    });
  });

  it("does not submit when name is empty", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url) => {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes("users") ? [] : []) });
    });

    await act(async () => {
      renderAdmin();
    });

    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, "2026-01-15");
    await user.click(screen.getByRole("button", { name: "Add Baby" }));

    const postCalls = global.fetch.mock.calls.filter(
      ([, opts]) => opts?.method === "POST"
    );
    expect(postCalls).toHaveLength(0);
  });

  it("does not submit when birthdate is empty", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url) => {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes("users") ? [] : []) });
    });

    await act(async () => {
      renderAdmin();
    });

    await user.type(screen.getByPlaceholderText("Baby name"), "Baby C");
    await user.click(screen.getByRole("button", { name: "Add Baby" }));

    const postCalls = global.fetch.mock.calls.filter(
      ([, opts]) => opts?.method === "POST"
    );
    expect(postCalls).toHaveLength(0);
  });

  it("calls refreshBabies from BabyContext after adding a baby", async () => {
    const user = userEvent.setup();
    let babiesFetchCount = 0;

    global.fetch = vi.fn((url, options) => {
      if (url === "/api/v1/babies" && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 3, name: "Baby C", birthdate: "2026-01-15" }) });
      }
      if (url === "/api/v1/babies") {
        babiesFetchCount++;
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    const initialCount = babiesFetchCount;

    await user.type(screen.getByPlaceholderText("Baby name"), "Baby C");
    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, "2026-01-15");
    await user.click(screen.getByRole("button", { name: "Add Baby" }));

    await waitFor(() => {
      // After adding, both the local fetchBabies and context refreshBabies should have been called
      expect(babiesFetchCount).toBeGreaterThan(initialCount);
    });
  });
});

describe("Admin — edit baby", () => {
  it("opens edit modal with baby data pre-filled when Edit is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve([]) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve(mockBabies) }),
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Edit Baby A"));

    expect(screen.getByText("Edit Baby")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Baby A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2025-06-01")).toBeInTheDocument();
  });

  it("sends PATCH to update baby and closes modal", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url, options) => {
      if (url.match(/\/api\/v1\/babies\/\d+/) && options?.method === "PATCH") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, name: "Baby Alpha", birthdate: "2025-06-01", gender: "female" }) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBabies) });
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Edit Baby A"));
    const nameInput = screen.getByDisplayValue("Baby A");
    await user.clear(nameInput);
    await user.type(nameInput, "Baby Alpha");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/babies/1", expect.objectContaining({
        method: "PATCH",
      }));
    });

    await waitFor(() => {
      expect(screen.queryByText("Edit Baby")).not.toBeInTheDocument();
    });
  });

  it("closes edit baby modal when Cancel is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve([]) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve(mockBabies) }),
    });

    await act(async () => {
      renderAdmin();
    });

    await user.click(screen.getByLabelText("Edit Baby A"));
    expect(screen.getByText("Edit Baby")).toBeInTheDocument();

    // There may be multiple Cancel buttons if other modals are around - get the one in the edit baby modal
    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    await user.click(cancelButtons[cancelButtons.length - 1]);

    expect(screen.queryByText("Edit Baby")).not.toBeInTheDocument();
  });

  it("calls refreshBabies after editing a baby", async () => {
    const user = userEvent.setup();
    let babiesFetchCount = 0;

    global.fetch = vi.fn((url, options) => {
      if (url.match(/\/api\/v1\/babies\/\d+/) && options?.method === "PATCH") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, name: "Baby Alpha", birthdate: "2025-06-01", gender: "female" }) });
      }
      if (url === "/api/v1/babies") {
        babiesFetchCount++;
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBabies) });
      }
      if (url === "/api/v1/users") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      renderAdmin();
    });

    const countBeforeEdit = babiesFetchCount;

    await user.click(screen.getByLabelText("Edit Baby A"));
    const nameInput = screen.getByDisplayValue("Baby A");
    await user.clear(nameInput);
    await user.type(nameInput, "Baby Alpha");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(babiesFetchCount).toBeGreaterThan(countBeforeEdit);
    });
  });
});

describe("Admin — user list has edit and delete buttons for each user", () => {
  it("renders Edit and Delete buttons for each user", async () => {
    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve(mockUsers) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    expect(screen.getByLabelText("Edit Mom")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete Mom")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit Dad")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete Dad")).toBeInTheDocument();
  });
});

describe("Admin — baby list has edit buttons for each baby", () => {
  it("renders Edit button for each baby", async () => {
    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve([]) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve(mockBabies) }),
    });

    await act(async () => {
      renderAdmin();
    });

    expect(screen.getByLabelText("Edit Baby A")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit Baby B")).toBeInTheDocument();
  });
});

describe("Admin — empty state", () => {
  it("renders correctly with no users and no babies", async () => {
    global.fetch = mockFetchResponses({
      "/api/v1/users": () => ({ ok: true, json: () => Promise.resolve([]) }),
      "/api/v1/babies": () => ({ ok: true, json: () => Promise.resolve([]) }),
    });

    await act(async () => {
      renderAdmin();
    });

    // Should still have the forms
    expect(screen.getByPlaceholderText("New user name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Baby name")).toBeInTheDocument();
    // No edit/delete buttons should be present
    expect(screen.queryByLabelText(/Edit/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Delete/)).not.toBeInTheDocument();
  });
});
