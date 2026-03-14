import { useState, useEffect, useCallback } from "react";
import { useBaby } from "../context/BabyContext";
import { usePersona } from "../context/PersonaContext";
import { useActiveEvents } from "../hooks/useActiveEvents";
import FeedTimer from "../components/timers/FeedTimer";
import SleepTimer from "../components/timers/SleepTimer";

const DIAPER_TYPES = [
  { type: "wet", label: "Wet" },
  { type: "dirty", label: "Dirty" },
  { type: "both", label: "Both" },
];

function timeAgo(isoString) {
  if (!isoString) return null;
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return null;
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalMin = Math.floor(diffMs / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hours}h ${mins}m`;
}

const FEED_TYPE_LABELS = {
  breast_left: "Breast L",
  breast_right: "Breast R",
  both_sides: "Both Sides",
  bottle: "Bottle",
};

const DIAPER_TYPE_LABELS = {
  wet: "Wet",
  dirty: "Dirty",
  both: "Both",
};

const SLEEP_TYPE_LABELS = {
  nap: "Nap",
  night: "Night",
};

export default function Dashboard() {
  const { selectedBaby } = useBaby();
  const { persona } = usePersona();
  const { activeFeed, activeSleep, refetch } = useActiveEvents(
    selectedBaby?.id
  );
  const [lastFeed, setLastFeed] = useState(null);
  const [lastSleep, setLastSleep] = useState(null);
  const [lastDiaper, setLastDiaper] = useState(null);
  const [loggingDiaper, setLoggingDiaper] = useState(false);
  const [showFeedTimer, setShowFeedTimer] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [sinceLastFeed, setSinceLastFeed] = useState(null);

  const fetchLastEvents = useCallback(async () => {
    if (!selectedBaby?.id) return;
    try {
      const [feedRes, sleepRes, diaperRes] = await Promise.all([
        fetch(`/api/v1/babies/${selectedBaby.id}/feeds?limit=1`),
        fetch(`/api/v1/babies/${selectedBaby.id}/sleeps?limit=1`),
        fetch(`/api/v1/babies/${selectedBaby.id}/diapers?limit=1`),
      ]);
      if (feedRes.ok) {
        const feeds = await feedRes.json();
        setLastFeed(feeds[0] || null);
      }
      if (sleepRes.ok) {
        const sleeps = await sleepRes.json();
        setLastSleep(sleeps[0] || null);
      }
      if (diaperRes.ok) {
        const diapers = await diaperRes.json();
        setLastDiaper(diapers[0] || null);
      }
    } catch {
      // keep current state
    }
  }, [selectedBaby?.id]);

  useEffect(() => {
    fetchLastEvents();
    const interval = setInterval(fetchLastEvents, 30_000);
    return () => clearInterval(interval);
  }, [fetchLastEvents]);

  useEffect(() => {
    function updateSinceLastFeed() {
      const feedTime = lastFeed?.ended_at || lastFeed?.started_at;
      setSinceLastFeed(feedTime ? timeAgo(feedTime) : null);
    }
    updateSinceLastFeed();
    const interval = setInterval(updateSinceLastFeed, 60_000);
    return () => clearInterval(interval);
  }, [lastFeed]);

  async function logDiaper(diaperType) {
    if (!selectedBaby?.id || !persona?.id) return;
    setLoggingDiaper(true);
    try {
      await fetch(`/api/v1/babies/${selectedBaby.id}/diapers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: persona.id,
          logged_at: new Date().toISOString(),
          type: diaperType,
        }),
      });
      await fetchLastEvents();
    } finally {
      setLoggingDiaper(false);
    }
  }

  if (!selectedBaby) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No baby selected
      </div>
    );
  }

  if (showFeedTimer) {
    return (
      <div className="space-y-4 p-4">
        <button
          onClick={() => setShowFeedTimer(false)}
          className="min-h-[48px] rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
        >
          &larr; Back to Dashboard
        </button>
        <FeedTimer />
      </div>
    );
  }

  if (showSleepTimer) {
    return (
      <div className="space-y-4 p-4">
        <button
          onClick={() => setShowSleepTimer(false)}
          className="min-h-[48px] rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
        >
          &larr; Back to Dashboard
        </button>
        <SleepTimer />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {(activeFeed || activeSleep) && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Active Timers
          </h2>
          {activeFeed && (
            <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/30">
              <FeedTimer />
            </div>
          )}
          {activeSleep && (
            <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-700 dark:bg-indigo-900/30 mt-3">
              <SleepTimer />
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          Quick Log
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {DIAPER_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => logDiaper(type)}
              disabled={loggingDiaper}
              className="flex flex-col items-center justify-center rounded-xl border-2
                border-gray-200 bg-white py-4 text-sm font-semibold text-gray-800
                hover:border-green-400 hover:bg-green-50 disabled:opacity-50
                dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
                dark:hover:border-green-500 dark:hover:bg-gray-700
                active:scale-95 transition-transform"
            >
              <span className="text-lg mb-1">
                {type === "wet" ? "💧" : type === "dirty" ? "💩" : "💧💩"}
              </span>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowFeedTimer(true)}
            className="flex items-center justify-center rounded-xl border-2
              border-gray-200 bg-white py-4 text-sm font-semibold text-gray-800
              hover:border-blue-400 hover:bg-blue-50
              dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
              dark:hover:border-blue-500 dark:hover:bg-gray-700
              active:scale-95 transition-transform"
          >
            🍼 Log Feed
          </button>
          <button
            onClick={() => setShowSleepTimer(true)}
            className="flex items-center justify-center rounded-xl border-2
              border-gray-200 bg-white py-4 text-sm font-semibold text-gray-800
              hover:border-indigo-400 hover:bg-indigo-50
              dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
              dark:hover:border-indigo-500 dark:hover:bg-gray-700
              active:scale-95 transition-transform"
          >
            😴 Log Sleep
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          Last Events
        </h2>

        {sinceLastFeed && (
          <div className="mb-3 rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20">
            <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              Since last feed
            </p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {sinceLastFeed}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <LastEventCard
            label="Last Feed"
            typeLabel={
              lastFeed ? FEED_TYPE_LABELS[lastFeed.type] || lastFeed.type : null
            }
            when={lastFeed?.ended_at || lastFeed?.started_at}
            duration={formatDuration(lastFeed?.started_at, lastFeed?.ended_at)}
            empty={!lastFeed}
          />
          <LastEventCard
            label="Last Sleep"
            typeLabel={
              lastSleep
                ? SLEEP_TYPE_LABELS[lastSleep.type] || lastSleep.type
                : null
            }
            when={lastSleep?.ended_at || lastSleep?.started_at}
            duration={formatDuration(
              lastSleep?.started_at,
              lastSleep?.ended_at
            )}
            empty={!lastSleep}
          />
          <LastEventCard
            label="Last Diaper"
            typeLabel={
              lastDiaper
                ? DIAPER_TYPE_LABELS[lastDiaper.type] || lastDiaper.type
                : null
            }
            when={lastDiaper?.logged_at}
            empty={!lastDiaper}
          />
        </div>
      </section>
    </div>
  );
}

function LastEventCard({ label, typeLabel, when, duration, empty }) {
  if (empty) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No events yet
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {timeAgo(when)}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-1">
        {typeLabel && (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {typeLabel}
          </span>
        )}
        {duration && (
          <span className="text-xs text-gray-500 dark:text-gray-500">
            ({duration})
          </span>
        )}
      </div>
    </div>
  );
}
