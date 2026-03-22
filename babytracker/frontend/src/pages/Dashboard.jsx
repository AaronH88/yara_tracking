import { useState, useEffect, useCallback } from "react";
import { useBaby } from "../context/BabyContext";
import { usePersona } from "../context/PersonaContext";
import { useActiveEvents } from "../hooks/useActiveEvents";
import FeedTimer from "../components/timers/FeedTimer";
import SleepTimer from "../components/timers/SleepTimer";
import BurpTimer from "../components/timers/BurpTimer";
import LogPastEventModal from "../components/LogPastEventModal";

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
  const { activeFeed, activeSleep, activeBurp, refetch } = useActiveEvents(
    selectedBaby?.id
  );
  const [lastFeed, setLastFeed] = useState(null);
  const [lastSleep, setLastSleep] = useState(null);
  const [lastDiaper, setLastDiaper] = useState(null);
  const [loggingDiaper, setLoggingDiaper] = useState(false);
  const [showFeedTimer, setShowFeedTimer] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showBurpTimer, setShowBurpTimer] = useState(false);
  const [showLogPastEvent, setShowLogPastEvent] = useState(false);
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
          className="min-h-[48px] rounded-lg px-3 py-2 text-sm font-medium text-purple-600 hover:bg-pastel-lavender dark:text-purple-400 dark:hover:bg-purple-900/30"
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
          className="min-h-[48px] rounded-lg px-3 py-2 text-sm font-medium text-purple-600 hover:bg-pastel-lavender dark:text-purple-400 dark:hover:bg-purple-900/30"
        >
          &larr; Back to Dashboard
        </button>
        <SleepTimer />
      </div>
    );
  }

  if (showBurpTimer) {
    return (
      <div className="space-y-4 p-4">
        <button
          onClick={() => setShowBurpTimer(false)}
          className="min-h-[48px] rounded-lg px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30"
        >
          &larr; Back to Dashboard
        </button>
        <BurpTimer />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {(activeFeed || activeSleep || activeBurp) && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3">
            Active Timers
          </h2>
          {activeFeed && (
            <div className="rounded-3xl border-2 border-orange-200 bg-gradient-to-r from-pastel-peach to-pastel-rose p-5 shadow-lg dark:border-orange-700 dark:bg-gradient-to-r dark:from-orange-900/30 dark:to-pink-900/30">
              <FeedTimer />
            </div>
          )}
          {activeSleep && (
            <div className="rounded-3xl border-2 border-purple-200 bg-gradient-to-r from-pastel-lavender to-purple-200 p-5 shadow-lg mt-3 dark:border-purple-700 dark:bg-gradient-to-r dark:from-purple-900/30 dark:to-indigo-900/30">
              <SleepTimer />
            </div>
          )}
          {activeBurp && (
            <div className="rounded-3xl border-2 border-green-200 bg-gradient-to-r from-green-100 to-emerald-100 p-5 shadow-lg mt-3 dark:border-green-700 dark:bg-gradient-to-r dark:from-green-900/30 dark:to-emerald-900/30">
              <BurpTimer />
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3">
          Quick Log
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {DIAPER_TYPES.map(({ type, label }) => {
            const getColors = () => {
              if (type === "wet") {
                return "border-blue-200 text-blue-700 hover:bg-pastel-sky dark:hover:border-blue-500";
              }
              if (type === "dirty") {
                return "border-orange-200 text-orange-700 hover:bg-pastel-peach dark:hover:border-orange-500";
              }
              return "border-purple-200 text-purple-700 hover:bg-pastel-lavender dark:hover:border-purple-500";
            };

            return (
              <button
                key={type}
                onClick={() => logDiaper(type)}
                disabled={loggingDiaper}
                className={`flex flex-col items-center justify-center rounded-2xl border-2
                  bg-white py-5 text-sm font-semibold shadow-md disabled:opacity-50
                  dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
                  dark:hover:bg-gray-700 active:scale-95 transition-all ${getColors()}`}
              >
                <span className="text-2xl mb-1">
                  {type === "wet" ? "💧" : type === "dirty" ? "💩" : "💧💩"}
                </span>
                {label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setShowFeedTimer(true)}
            className="flex items-center justify-center rounded-2xl border-2
              border-orange-300 bg-gradient-to-br from-pastel-peach to-orange-200 py-4 text-sm font-semibold text-orange-800
              hover:shadow-lg shadow-md
              dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
              dark:hover:border-orange-500 dark:hover:bg-gray-700
              active:scale-95 transition-all"
          >
            🍼 Feed
          </button>
          <button
            onClick={() => setShowSleepTimer(true)}
            className="flex items-center justify-center rounded-2xl border-2
              border-purple-300 bg-gradient-to-br from-pastel-lavender to-purple-200 py-4 text-sm font-semibold text-purple-800
              hover:shadow-lg shadow-md
              dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
              dark:hover:border-purple-500 dark:hover:bg-gray-700
              active:scale-95 transition-all"
          >
            😴 Sleep
          </button>
          <button
            onClick={() => setShowBurpTimer(true)}
            className="flex items-center justify-center rounded-2xl border-2
              border-green-300 bg-gradient-to-br from-green-100 to-emerald-100 py-4 text-sm font-semibold text-green-800
              hover:shadow-lg shadow-md
              dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
              dark:hover:border-green-500 dark:hover:bg-gray-700
              active:scale-95 transition-all"
          >
            🫧 Burp
          </button>
        </div>
        <button
          onClick={() => setShowLogPastEvent(true)}
          className="mt-3 w-full flex items-center justify-center rounded-2xl border-2
            border-dashed border-green-300 bg-white/70 py-3 text-sm font-medium text-green-700
            hover:bg-pastel-mint
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400
            dark:hover:border-green-500 dark:hover:bg-gray-700 dark:hover:text-green-300
            active:scale-95 transition-all"
        >
          📝 Log Past Event
        </button>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3">
          Last Events
        </h2>

        {sinceLastFeed && (
          <div className="mb-3 rounded-2xl bg-gradient-to-r from-pastel-rose to-pastel-peach border-2 border-orange-200 p-4 text-center shadow-md dark:bg-gradient-to-r dark:from-pink-900/30 dark:to-orange-900/30 dark:border-orange-700">
            <p className="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide font-semibold mb-1">
              Since last feed
            </p>
            <p className="text-3xl font-bold text-orange-800 dark:text-orange-300">
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
            label="Last Nappy"
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

      {showLogPastEvent && (
        <LogPastEventModal
          onClose={(saved) => {
            setShowLogPastEvent(false);
            if (saved) fetchLastEvents();
          }}
        />
      )}
    </div>
  );
}

function LastEventCard({ label, typeLabel, when, duration, empty }) {
  if (empty) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-sm p-4 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No events yet
        </p>
      </div>
    );
  }

  const getBorderColor = () => {
    if (label.includes('Feed')) return 'border-orange-200 dark:border-orange-700';
    if (label.includes('Sleep')) return 'border-purple-200 dark:border-purple-700';
    return 'border-blue-200 dark:border-blue-700';
  };

  const getBgColor = () => {
    if (label.includes('Feed')) return 'bg-pastel-peach dark:bg-orange-900/30';
    if (label.includes('Sleep')) return 'bg-pastel-lavender dark:bg-purple-900/30';
    return 'bg-pastel-sky dark:bg-blue-900/30';
  };

  const getTextColor = () => {
    if (label.includes('Feed')) return 'text-orange-700 dark:text-orange-400';
    if (label.includes('Sleep')) return 'text-purple-700 dark:text-purple-400';
    return 'text-blue-700 dark:text-blue-400';
  };

  return (
    <div className={`rounded-2xl border bg-white/90 backdrop-blur-sm p-4 shadow-md ${getBorderColor()} dark:bg-gray-800`}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-gray-800 dark:text-gray-300">
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {timeAgo(when)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {typeLabel && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getBgColor()} ${getTextColor()}`}>
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
