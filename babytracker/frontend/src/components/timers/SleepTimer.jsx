import { useState } from "react";
import { useBaby } from "../../context/BabyContext";
import { usePersona } from "../../context/PersonaContext";
import { useActiveEvents } from "../../hooks/useActiveEvents";
import { useTimer } from "../../hooks/useTimer";

const SLEEP_TYPES = [
  { type: "nap", label: "Nap" },
  { type: "night", label: "Night Sleep" },
];

const SLEEP_TYPE_LABELS = {
  nap: "Nap",
  night: "Night Sleep",
};

export default function SleepTimer() {
  const { selectedBaby } = useBaby();
  const { persona } = usePersona();
  const { activeSleep, refetch } = useActiveEvents(selectedBaby?.id);
  const { elapsed } = useTimer(activeSleep?.started_at);
  const [stoppedSleep, setStoppedSleep] = useState(null);
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function startSleep(sleepType) {
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/sleeps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: persona.id,
            type: sleepType,
            started_at: new Date().toISOString(),
          }),
        }
      );
      if (response.ok) {
        await refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function wakeUp() {
    if (!activeSleep) return;
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/sleeps/${activeSleep.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ended_at: new Date().toISOString() }),
        }
      );
      if (response.ok) {
        const stopped = await response.json();
        setStoppedSleep(stopped);
        setFormNotes("");
        await refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveNotes(e) {
    e.preventDefault();
    if (!stoppedSleep) return;
    setSubmitting(true);
    try {
      if (formNotes.trim()) {
        await fetch(
          `/api/v1/babies/${selectedBaby.id}/sleeps/${stoppedSleep.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: formNotes.trim() }),
          }
        );
      }
      setStoppedSleep(null);
    } finally {
      setSubmitting(false);
    }
  }

  function skipNotes() {
    setStoppedSleep(null);
  }

  if (stoppedSleep) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Sleep Details
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {SLEEP_TYPE_LABELS[stoppedSleep.type] || stoppedSleep.type}
        </p>
        <form onSubmit={saveNotes} className="space-y-3">
          <div>
            <label
              htmlFor="sleep-notes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Notes
            </label>
            <textarea
              id="sleep-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-white font-medium
                hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={skipNotes}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-gray-700 font-medium
                hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (activeSleep) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {SLEEP_TYPE_LABELS[activeSleep.type] || activeSleep.type}
        </p>
        <p className="text-4xl font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {elapsed ?? "0s"}
        </p>
        <button
          onClick={wakeUp}
          disabled={submitting}
          className="w-full rounded-lg bg-amber-600 py-3 text-white text-lg font-semibold
            hover:bg-amber-700 disabled:opacity-50"
        >
          Wake Up
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {SLEEP_TYPES.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => startSleep(type)}
          disabled={submitting}
          className="flex flex-col items-center justify-center rounded-xl border-2
            border-gray-200 bg-white py-6 text-lg font-semibold text-gray-800
            hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
            dark:hover:border-indigo-500 dark:hover:bg-gray-700"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
