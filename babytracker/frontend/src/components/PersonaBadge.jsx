import { useState, useRef, useEffect } from "react";
import { usePersona } from "../context/PersonaContext";

export default function PersonaBadge() {
  const { persona, setPersona, clearPersona } = usePersona();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/v1/users")
      .then((res) => (res.ok ? res.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (sheetRef.current && !sheetRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!persona) return null;

  return (
    <div className="relative" ref={sheetRef}>
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full bg-pastel-lavender px-3 py-1 text-sm font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
      >
        {persona.name}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-pastel-lavender bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {users
            .filter((user) => user.id !== persona.id)
            .map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  setPersona(user);
                  setOpen(false);
                }}
                className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-pastel-mint dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Switch to {user.name}
              </button>
            ))}
          <button
            onClick={() => {
              clearPersona();
              setOpen(false);
            }}
            className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-pastel-rose dark:text-red-400 dark:hover:bg-gray-700"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
