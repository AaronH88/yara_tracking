import { useState, useCallback } from "react";
import { useBaby } from "../../context/BabyContext";
import { usePersona } from "../../context/PersonaContext";
import { useActiveEvents } from "../../hooks/useActiveEvents";
import { useTimer } from "../../hooks/useTimer";

export default function BurpTimer() {
  const { selectedBaby } = useBaby();
  const { persona } = usePersona();
  const { activeBurp, refetch } = useActiveEvents(selectedBaby?.id);
  const { elapsed } = useTimer(activeBurp?.started_at);
  const [stoppedBurp, setStoppedBurp] = useState(null);
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function startBurp() {
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/burps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: persona.id,
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

  async function stopBurp() {
    if (!activeBurp) return;
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/burps/${activeBurp.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ended_at: new Date().toISOString() }),
        }
      );
      if (response.ok) {
        const stopped = await response.json();
        setStoppedBurp(stopped);
        setFormNotes("");
        await refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveNotes(e) {
    e.preventDefault();
    if (!stoppedBurp) return;
    setSubmitting(true);
    try {
      if (formNotes.trim()) {
        await fetch(
          `/api/v1/babies/${selectedBaby.id}/burps/${stoppedBurp.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: formNotes.trim() }),
          }
        );
      }
      setStoppedBurp(null);
    } finally {
      setSubmitting(false);
    }
  }

  function skipNotes() {
    setStoppedBurp(null);
  }

  if (stoppedBurp) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
          Burp Details
        </h3>
        <form onSubmit={saveNotes} className="space-y-3">
          <div>
            <label
              htmlFor="burp-notes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Notes
            </label>
            <textarea
              id="burp-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-lg border-2 border-green-200 px-3 py-2
                dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-2xl bg-green-600 py-3 text-white font-semibold
                hover:bg-green-700 disabled:opacity-50 shadow-md active:scale-95 transition-all"
            >
              Save
            </button>
            <button
              type="button"
              onClick={skipNotes}
              className="flex-1 rounded-2xl border-2 border-green-200 py-3 text-green-700 font-semibold
                hover:bg-green-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700
                active:scale-95 transition-all"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (activeBurp) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">🫧</span>
          <span className="text-xs font-semibold text-green-700 bg-white/60 rounded-full px-3 py-1 dark:text-green-300 dark:bg-white/20">
            Burping
          </span>
        </div>
        <p className="text-5xl font-bold text-green-800 dark:text-green-300">
          {elapsed ?? "0s"}
        </p>
        <div className="text-sm text-green-600 dark:text-green-400 mb-4">
          Started {elapsed ?? "just now"} ago
        </div>
        <button
          onClick={stopBurp}
          disabled={submitting}
          className="w-full rounded-2xl bg-green-600 py-3 text-white font-semibold
            hover:bg-green-700 disabled:opacity-50 shadow-md active:scale-95 transition-all"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startBurp}
      disabled={submitting}
      className="w-full flex flex-col items-center justify-center rounded-2xl border-2
        border-green-200 bg-white py-6 text-lg font-semibold text-green-800
        hover:bg-green-50 shadow-md disabled:opacity-50
        dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
        dark:hover:border-green-500 dark:hover:bg-gray-700
        active:scale-95 transition-all"
    >
      Start Burp
    </button>
  );
}
