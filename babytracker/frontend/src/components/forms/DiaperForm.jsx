import { useState, useEffect } from "react";
import { useBaby } from "../../context/BabyContext";
import { usePersona } from "../../context/PersonaContext";

const DIAPER_TYPES = [
  { value: "wet", label: "Wet" },
  { value: "dirty", label: "Dirty" },
  { value: "both", label: "Both" },
];

const WET_AMOUNTS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];

const DIRTY_COLOURS = [
  { value: "yellow", label: "Yellow", icon: "🟡" },
  { value: "green", label: "Green", icon: "🟢" },
  { value: "brown", label: "Brown", icon: "🟤" },
  { value: "other", label: "Other", icon: "⚪" },
];

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

export default function DiaperForm({ event, onSaved, onCancel }) {
  const { selectedBaby } = useBaby();
  const { persona } = usePersona();

  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(event?.user_id ?? persona?.id ?? "");
  const [diaperType, setDiaperType] = useState(event?.type ?? "wet");
  const [wetAmount, setWetAmount] = useState(event?.wet_amount ?? null);
  const [dirtyColour, setDirtyColour] = useState(event?.dirty_colour ?? null);
  const [loggedAt, setLoggedAt] = useState(
    toLocalDatetime(event?.logged_at ?? new Date().toISOString())
  );
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const showWetAmount = diaperType === "wet" || diaperType === "both";
  const showDirtyColour = diaperType === "dirty" || diaperType === "both";

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
        type: diaperType,
        wet_amount: showWetAmount ? wetAmount : null,
        dirty_colour: showDirtyColour ? dirtyColour : null,
        logged_at: fromLocalDatetime(loggedAt),
        notes: notes.trim() || null,
      };

      const url = event
        ? `/api/v1/babies/${selectedBaby.id}/diapers/${event.id}`
        : `/api/v1/babies/${selectedBaby.id}/diapers`;
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
          Type
        </label>
        <select
          value={diaperType}
          onChange={(e) => setDiaperType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          {DIAPER_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {showWetAmount && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Wet Amount
          </label>
          <div className="mt-1 flex gap-2">
            {WET_AMOUNTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setWetAmount(wetAmount === value ? null : value)}
                className={`flex-1 min-h-[48px] rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                  wetAmount === value
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showDirtyColour && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Colour
          </label>
          <div className="mt-1 flex gap-2">
            {DIRTY_COLOURS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirtyColour(dirtyColour === value ? null : value)}
                className={`flex-1 min-h-[48px] flex flex-col items-center justify-center rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                  dirtyColour === value
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Logged at
        </label>
        <input
          type="datetime-local"
          value={loggedAt}
          onChange={(e) => setLoggedAt(e.target.value)}
          required
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
