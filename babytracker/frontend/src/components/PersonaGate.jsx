import { useState, useEffect } from "react";
import { usePersona } from "../context/PersonaContext";

export default function PersonaGate({ children }) {
  const { persona, setPersona } = usePersona();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (persona) return;

    fetch("/api/v1/users")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
        return res.json();
      })
      .then((fetchedUsers) => {
        setUsers(fetchedUsers);
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err.message);
        setLoading(false);
      });
  }, [persona]);

  if (persona) return children;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
          Welcome — who are you?
        </h1>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading users...</p>
          </div>
        )}

        {fetchError && (
          <p className="text-center text-red-600 dark:text-red-400">
            {fetchError}
          </p>
        )}

        {!loading && !fetchError && users.length === 0 && (
          <div className="text-center">
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              No users set up yet. Ask an admin to add users first.
            </p>
            <a
              href="/admin"
              className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700"
            >
              Go to Admin
            </a>
          </div>
        )}

        {!loading && !fetchError && users.length > 0 && (
          <div className="flex flex-col gap-3">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setPersona(user)}
                className="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-medium text-white hover:bg-blue-700 active:bg-blue-800"
              >
                {user.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
