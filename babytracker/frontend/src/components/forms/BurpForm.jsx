import { useState, useEffect } from "react";
import { useBaby } from "../../context/BabyContext";
import { usePersona } from "../../context/PersonaContext";

function toLocalDatetime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDatetime(localStr) {
  if (!localStr) return null;
  return new Date(localStr).toISOString();
}

export default function BurpForm({ event, onSaved, onCancel }) {
  const { selectedBaby } = useBaby();
  const { persona } = usePersona();

  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(event?.user_id ?? persona?.id ?? "");
  const [startedAt, setStartedAt] = useState(
    toLocalDatetime(event?.started_at ?? new Date().toISOString())
  );
  const [endedAt, setEndedAt] = useState(
    toLocalDatetime(event?.ended_at ?? "")
  );
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/v1/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedBaby?.id) return;
    setSubmitting(true);
    try {
      const body = {
        user_id: Number(userId),
        started_at: fromLocalDatetime(startedAt),
        ended_at: endedAt ? fromLocalDatetime(endedAt) : null,
        notes: notes.trim() || null,
      };

      const url = event
        ? `/api/v1/babies/${selectedBaby.id}/burps/${event.id}`
        : `/api/v1/babies/${selectedBaby.id}/burps`;
      const method = event ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok && onSaved) {
        onSaved(await response.json());
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Logged by
        </label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Started at
        </label>
        <input
          type="datetime-local"
          value={startedAt}
          onChange={(e) => setStartedAt(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Ended at
        </label>
        <input
          type="datetime-local"
          value={endedAt}
          onChange={(e) => setEndedAt(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-blue-600 min-h-[48px] py-3 text-white font-medium
            hover:bg-blue-700 disabled:opacity-50"
        >
          {event ? "Update" : "Create"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 min-h-[48px] py-3 text-gray-700 font-medium
              hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
