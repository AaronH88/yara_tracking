import { useState, useEffect, useCallback } from "react";
import { useBaby } from "../context/BabyContext";

export default function Admin() {
  const { refreshBabies } = useBaby();
  const [users, setUsers] = useState([]);
  const [babies, setBabies] = useState([]);
  const [newUserName, setNewUserName] = useState("");
  const [newBaby, setNewBaby] = useState({ name: "", birthdate: "", gender: "" });
  const [editingUser, setEditingUser] = useState(null);
  const [editingBaby, setEditingBaby] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [userError, setUserError] = useState("");
  const [babyError, setBabyError] = useState("");

  const fetchUsers = useCallback(async () => {
    const response = await fetch("/api/v1/users");
    if (response.ok) setUsers(await response.json());
  }, []);

  const fetchBabies = useCallback(async () => {
    const response = await fetch("/api/v1/babies");
    if (response.ok) setBabies(await response.json());
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchBabies();
  }, [fetchUsers, fetchBabies]);

  async function handleAddUser(e) {
    e.preventDefault();
    setUserError("");
    const trimmed = newUserName.trim();
    if (!trimmed) return;
    const response = await fetch("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (response.ok) {
      setNewUserName("");
      fetchUsers();
    } else if (response.status === 409) {
      setUserError("A user with this name already exists");
    }
  }

  async function handleUpdateUser(e) {
    e.preventDefault();
    if (!editingUser) return;
    const trimmed = editingUser.name.trim();
    if (!trimmed) return;
    const response = await fetch(`/api/v1/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (response.ok) {
      setEditingUser(null);
      fetchUsers();
    }
  }

  async function handleDeleteUser() {
    if (!deletingUser) return;
    setDeleteError("");
    const response = await fetch(`/api/v1/users/${deletingUser.id}`, {
      method: "DELETE",
    });
    if (response.ok || response.status === 204) {
      setDeletingUser(null);
      fetchUsers();
    } else if (response.status === 409) {
      setDeleteError("This user has logged events and cannot be deleted");
    }
  }

  async function handleAddBaby(e) {
    e.preventDefault();
    setBabyError("");
    const trimmedName = newBaby.name.trim();
    if (!trimmedName || !newBaby.birthdate) return;
    const payload = { name: trimmedName, birthdate: newBaby.birthdate };
    if (newBaby.gender) payload.gender = newBaby.gender;
    const response = await fetch("/api/v1/babies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      setNewBaby({ name: "", birthdate: "", gender: "" });
      fetchBabies();
      refreshBabies();
    } else {
      setBabyError("Failed to add baby");
    }
  }

  async function handleUpdateBaby(e) {
    e.preventDefault();
    if (!editingBaby) return;
    const trimmedName = editingBaby.name.trim();
    if (!trimmedName || !editingBaby.birthdate) return;
    const payload = {
      name: trimmedName,
      birthdate: editingBaby.birthdate,
      gender: editingBaby.gender || null,
    };
    const response = await fetch(`/api/v1/babies/${editingBaby.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      setEditingBaby(null);
      fetchBabies();
      refreshBabies();
    }
  }

  return (
    <div className="space-y-6 p-4">
      <section>
        <h2 className="mb-3 text-lg font-bold text-purple-800 dark:text-purple-300">
          Users
        </h2>

        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-2xl border border-pastel-lavender/40 bg-white/90 backdrop-blur-sm p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                {user.name}
              </span>
              <button
                onClick={() => setEditingUser({ ...user })}
                className="rounded-lg px-4 py-2 text-sm text-purple-600 hover:bg-pastel-lavender dark:text-purple-400 dark:hover:bg-purple-900/30"
                aria-label={`Edit ${user.name}`}
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setDeleteError("");
                  setDeletingUser(user);
                }}
                className="rounded-lg px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                aria-label={`Delete ${user.name}`}
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddUser} className="mt-3 flex gap-2">
          <input
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="New user name"
            className="min-w-0 flex-1 rounded-lg border-2 border-purple-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <button
            type="submit"
            className="rounded-2xl bg-gradient-to-br from-pastel-lavender to-purple-300 border-2 border-purple-300 px-4 min-h-[48px] py-3 text-sm font-semibold text-purple-800 hover:shadow-lg shadow-md active:scale-95 transition-all"
          >
            Add User
          </button>
        </form>
        {userError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{userError}</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-purple-800 dark:text-purple-300">
          Babies
        </h2>

        <div className="space-y-2">
          {babies.map((baby) => (
            <div
              key={baby.id}
              className="flex items-center gap-3 rounded-2xl border border-pastel-lavender/40 bg-white/90 backdrop-blur-sm p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {baby.name}
                </span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {baby.birthdate}
                </span>
                {baby.gender && (
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                    {baby.gender}
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditingBaby({ ...baby })}
                className="rounded-lg px-4 py-2 text-sm text-purple-600 hover:bg-pastel-lavender dark:text-purple-400 dark:hover:bg-purple-900/30"
                aria-label={`Edit ${baby.name}`}
              >
                Edit
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddBaby} className="mt-3 space-y-2">
          <input
            type="text"
            value={newBaby.name}
            onChange={(e) => setNewBaby((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Baby name"
            className="w-full rounded-lg border-2 border-purple-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <input
            type="date"
            value={newBaby.birthdate}
            onChange={(e) => setNewBaby((prev) => ({ ...prev, birthdate: e.target.value }))}
            className="w-full rounded-lg border-2 border-purple-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <select
            value={newBaby.gender}
            onChange={(e) => setNewBaby((prev) => ({ ...prev, gender: e.target.value }))}
            className="w-full rounded-lg border-2 border-purple-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Gender (optional)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-br from-pastel-lavender to-purple-300 border-2 border-purple-300 min-h-[48px] py-3 text-sm font-semibold text-purple-800 hover:shadow-lg shadow-md active:scale-95 transition-all"
          >
            Add Baby
          </button>
        </form>
        {babyError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{babyError}</p>
        )}
      </section>

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 backdrop-blur-sm p-6 shadow-xl dark:bg-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Delete user <strong>{deletingUser.name}</strong>?
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleDeleteUser}
                className="flex-1 rounded-2xl bg-red-600 min-h-[48px] py-3 font-semibold text-white hover:bg-red-700 shadow-md active:scale-95 transition-all"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 rounded-2xl border-2 border-purple-200 min-h-[48px] py-3 font-semibold text-purple-700 hover:bg-pastel-lavender dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-t-2xl bg-white/95 backdrop-blur-sm p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold text-purple-800 dark:text-purple-300">
              Edit User
            </h3>
            <form onSubmit={handleUpdateUser} className="space-y-3">
              <input
                type="text"
                value={editingUser.name}
                onChange={(e) =>
                  setEditingUser((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full rounded-lg border-2 border-purple-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-gradient-to-br from-pastel-lavender to-purple-300 border-2 border-purple-300 min-h-[48px] py-3 font-semibold text-purple-800 hover:shadow-lg shadow-md active:scale-95 transition-all"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 rounded-2xl border-2 border-purple-200 min-h-[48px] py-3 font-semibold text-purple-700 hover:bg-pastel-lavender dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingBaby && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-t-2xl bg-white/95 backdrop-blur-sm p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold text-purple-800 dark:text-purple-300">
              Edit Baby
            </h3>
            <form onSubmit={handleUpdateBaby} className="space-y-3">
              <input
                type="text"
                value={editingBaby.name}
                onChange={(e) =>
                  setEditingBaby((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Name"
                className="w-full rounded-lg border-2 border-purple-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <input
                type="date"
                value={editingBaby.birthdate}
                onChange={(e) =>
                  setEditingBaby((prev) => ({ ...prev, birthdate: e.target.value }))
                }
                className="w-full rounded-lg border-2 border-purple-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <select
                value={editingBaby.gender || ""}
                onChange={(e) =>
                  setEditingBaby((prev) => ({ ...prev, gender: e.target.value }))
                }
                className="w-full rounded-lg border-2 border-purple-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Gender (optional)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-gradient-to-br from-pastel-lavender to-purple-300 border-2 border-purple-300 min-h-[48px] py-3 font-semibold text-purple-800 hover:shadow-lg shadow-md active:scale-95 transition-all"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBaby(null)}
                  className="flex-1 rounded-2xl border-2 border-purple-200 min-h-[48px] py-3 font-semibold text-purple-700 hover:bg-pastel-lavender dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
