import { useState, useEffect } from "react";
import { usePersona } from "../../context/PersonaContext";
import { useSettings } from "../../context/SettingsContext";

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

export default function PumpForm({ event, onSaved, onCancel }) {
  const { persona } = usePersona();
  const { settings } = useSettings();
  const isMetric = settings.units === "metric";

  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(event?.user_id ?? persona?.id ?? "");
  const [startedAt, setStartedAt] = useState(
    toLocalDatetime(event?.logged_at ?? new Date().toISOString())
  );
  const [durationMinutes, setDurationMinutes] = useState(
    event?.duration_minutes ?? ""
  );
  const [leftAmount, setLeftAmount] = useState(() => {
    if (!event) return "";
    return isMetric ? (event.left_ml ?? "") : (event.left_oz ?? "");
  });
  const [rightAmount, setRightAmount] = useState(() => {
    if (!event) return "";
    return isMetric ? (event.right_ml ?? "") : (event.right_oz ?? "");
  });
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
    setSubmitting(true);
    try {
      const body = {
        user_id: Number(userId),
        logged_at: fromLocalDatetime(startedAt),
        notes: notes.trim() || null,
      };

      const parsedDuration = parseInt(durationMinutes, 10);
      if (!isNaN(parsedDuration) && parsedDuration > 0) {
        body.duration_minutes = parsedDuration;
      }

      const parsedLeft = parseFloat(leftAmount);
      if (!isNaN(parsedLeft) && parsedLeft >= 0) {
        if (isMetric) {
          body.left_ml = parsedLeft;
        } else {
          body.left_oz = parsedLeft;
        }
      }

      const parsedRight = parseFloat(rightAmount);
      if (!isNaN(parsedRight) && parsedRight >= 0) {
        if (isMetric) {
          body.right_ml = parsedRight;
        } else {
          body.right_oz = parsedRight;
        }
      }

      const url = event ? `/api/v1/pumps/${event.id}` : "/api/v1/pumps";
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

  const unitLabel = isMetric ? "ml" : "oz";

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
          Duration (minutes)
        </label>
        <input
          type="number"
          min="0"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Left ({unitLabel})
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={leftAmount}
            onChange={(e) => setLeftAmount(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
              dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Right ({unitLabel})
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={rightAmount}
            onChange={(e) => setRightAmount(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
              dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
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
          className="flex-1 rounded-lg bg-blue-600 py-2 text-white font-medium
            hover:bg-blue-700 disabled:opacity-50"
        >
          {event ? "Update" : "Create"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-gray-700 font-medium
              hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
