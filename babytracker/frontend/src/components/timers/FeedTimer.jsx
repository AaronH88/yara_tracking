import { useState } from "react";
import { useBaby } from "../../context/BabyContext";
import { usePersona } from "../../context/PersonaContext";
import { useActiveEvents } from "../../hooks/useActiveEvents";
import { useTimer } from "../../hooks/useTimer";

const FEED_TYPES = [
  { type: "breast_left", label: "Breast L" },
  { type: "breast_right", label: "Breast R" },
  { type: "both_sides", label: "Both Sides" },
  { type: "bottle", label: "Bottle" },
];

const FEED_TYPE_LABELS = {
  breast_left: "Breast \u2014 Left",
  breast_right: "Breast \u2014 Right",
  both_sides: "Breast \u2014 Both Sides",
  bottle: "Bottle",
};

function getLastSideKey(babyId) {
  return `feedTimer_lastSide_${babyId}`;
}

function getLastSide(babyId) {
  try {
    return localStorage.getItem(getLastSideKey(babyId));
  } catch {
    return null;
  }
}

function saveLastSide(babyId, feedType) {
  const sideTypes = ["breast_left", "breast_right", "both_sides"];
  if (sideTypes.includes(feedType)) {
    try {
      localStorage.setItem(getLastSideKey(babyId), feedType);
    } catch {
      // localStorage unavailable
    }
  }
}

export default function FeedTimer() {
  const { selectedBaby } = useBaby();
  const { persona } = usePersona();
  const { activeFeed, refetch } = useActiveEvents(selectedBaby?.id);
  const { elapsed } = useTimer(activeFeed?.started_at);
  const [stoppedFeed, setStoppedFeed] = useState(null);
  const [formAmount, setFormAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function startFeed(feedType) {
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/feeds`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: persona.id,
            type: feedType,
            started_at: new Date().toISOString(),
          }),
        }
      );
      if (response.ok) {
        saveLastSide(selectedBaby.id, feedType);
        await refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function stopFeed() {
    if (!activeFeed) return;
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/feeds/${activeFeed.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ended_at: new Date().toISOString() }),
        }
      );
      if (response.ok) {
        const stopped = await response.json();
        setStoppedFeed(stopped);
        setFormAmount("");
        setFormNotes("");
        await refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDetails(e) {
    e.preventDefault();
    if (!stoppedFeed) return;
    setSubmitting(true);
    try {
      const updates = {};
      if (formAmount.trim()) {
        updates.amount_oz = parseFloat(formAmount);
      }
      if (formNotes.trim()) {
        updates.notes = formNotes.trim();
      }
      if (Object.keys(updates).length > 0) {
        await fetch(
          `/api/v1/babies/${selectedBaby.id}/feeds/${stoppedFeed.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          }
        );
      }
      setStoppedFeed(null);
    } finally {
      setSubmitting(false);
    }
  }

  function skipDetails() {
    setStoppedFeed(null);
  }

  if (stoppedFeed) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-300">
          Feed Details
        </h3>
        <p className="text-sm text-orange-600 dark:text-orange-400">
          {FEED_TYPE_LABELS[stoppedFeed.type] || stoppedFeed.type}
        </p>
        <form onSubmit={saveDetails} className="space-y-3">
          <div>
            <label
              htmlFor="feed-amount"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Amount (oz)
            </label>
            <input
              id="feed-amount"
              type="number"
              step="0.1"
              min="0"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              className="mt-1 block w-full rounded-lg border-2 border-orange-200 px-3 py-2
                dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              placeholder="e.g. 4.0"
            />
          </div>
          <div>
            <label
              htmlFor="feed-notes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Notes
            </label>
            <textarea
              id="feed-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-lg border-2 border-orange-200 px-3 py-2
                dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-2xl bg-orange-600 py-3 text-white font-semibold
                hover:bg-orange-700 disabled:opacity-50 shadow-md active:scale-95 transition-all"
            >
              Save
            </button>
            <button
              type="button"
              onClick={skipDetails}
              className="flex-1 rounded-2xl border-2 border-orange-200 py-3 text-orange-700 font-semibold
                hover:bg-pastel-peach dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700
                active:scale-95 transition-all"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (activeFeed) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">🍼</span>
          <span className="text-xs font-semibold text-orange-700 bg-white/60 rounded-full px-3 py-1 dark:text-orange-300 dark:bg-white/20">
            {FEED_TYPE_LABELS[activeFeed.type] || activeFeed.type}
          </span>
        </div>
        <p className="text-5xl font-bold text-orange-800 dark:text-orange-300">
          {elapsed ?? "0s"}
        </p>
        <div className="text-sm text-orange-600 dark:text-orange-400 mb-4">
          Started {elapsed ?? "just now"} ago
        </div>
        <button
          onClick={stopFeed}
          disabled={submitting}
          className="w-full rounded-2xl bg-orange-600 py-3 text-white font-semibold
            hover:bg-orange-700 disabled:opacity-50 shadow-md active:scale-95 transition-all"
        >
          Stop Feed
        </button>
      </div>
    );
  }

  const lastSide = selectedBaby ? getLastSide(selectedBaby.id) : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {FEED_TYPES.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => startFeed(type)}
          disabled={submitting}
          className="flex flex-col items-center justify-center rounded-2xl border-2
            border-orange-200 bg-white py-6 text-lg font-semibold text-orange-800
            hover:bg-pastel-peach shadow-md disabled:opacity-50
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
            dark:hover:border-orange-500 dark:hover:bg-gray-700
            active:scale-95 transition-all"
        >
          {label}
          {lastSide === type && (
            <span className="mt-1 text-xs font-normal text-orange-500 dark:text-gray-500">
              last used
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
