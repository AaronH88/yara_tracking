import { useState, useCallback } from "react";
import { useBaby } from "../../context/BabyContext";
import { usePersona } from "../../context/PersonaContext";
import { useActiveEvents } from "../../hooks/useActiveEvents";
import { useTimer } from "../../hooks/useTimer";
import Toast from "../Toast";

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
  const [toastMessage, setToastMessage] = useState(null);
  const dismissToast = useCallback(() => setToastMessage(null), []);

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
        const created = await response.json();
        if (created.auto_closed?.length > 0) {
          const closedTypes = created.auto_closed.map((item) =>
            item.type === "sleep" ? "Sleep" : item.type === "feed" ? "Feed" : "Burp"
          );
          const uniqueTypes = [...new Set(closedTypes)];
          setToastMessage(
            `${uniqueTypes.join(" and ")} timer${uniqueTypes.length > 1 ? "s" : ""} automatically stopped`
          );
        }
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

  const toastElement = toastMessage ? (
    <Toast message={toastMessage} onDismiss={dismissToast} />
  ) : null;

  if (stoppedSleep) {
    return (
      <div className="space-y-4">
        {toastElement}
        <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300">
          Sleep Details
        </h3>
        <p className="text-sm text-purple-600 dark:text-purple-400">
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
              className="mt-1 block w-full rounded-lg border-2 border-purple-200 px-3 py-2
                dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-2xl bg-purple-600 py-3 text-white font-semibold
                hover:bg-purple-700 disabled:opacity-50 shadow-md active:scale-95 transition-all"
            >
              Save
            </button>
            <button
              type="button"
              onClick={skipNotes}
              className="flex-1 rounded-2xl border-2 border-purple-200 py-3 text-purple-700 font-semibold
                hover:bg-pastel-lavender dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700
                active:scale-95 transition-all"
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
        {toastElement}
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">😴</span>
          <span className="text-xs font-semibold text-purple-700 bg-white/60 rounded-full px-3 py-1 dark:text-purple-300 dark:bg-white/20">
            {SLEEP_TYPE_LABELS[activeSleep.type] || activeSleep.type}
          </span>
        </div>
        <p className="text-5xl font-bold text-purple-800 dark:text-purple-300">
          {elapsed ?? "0s"}
        </p>
        <div className="text-sm text-purple-600 dark:text-purple-400 mb-4">
          Started {elapsed ?? "just now"} ago
        </div>
        <button
          onClick={wakeUp}
          disabled={submitting}
          className="w-full rounded-2xl bg-purple-600 py-3 text-white font-semibold
            hover:bg-purple-700 disabled:opacity-50 shadow-md active:scale-95 transition-all"
        >
          Wake Up
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {toastElement}
      {SLEEP_TYPES.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => startSleep(type)}
          disabled={submitting}
          className="flex flex-col items-center justify-center rounded-2xl border-2
            border-purple-200 bg-white py-6 text-lg font-semibold text-purple-800
            hover:bg-pastel-lavender shadow-md disabled:opacity-50
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
            dark:hover:border-purple-500 dark:hover:bg-gray-700
            active:scale-95 transition-all"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
