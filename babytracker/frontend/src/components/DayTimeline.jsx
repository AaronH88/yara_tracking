const EVENT_ICONS = {
  feed: "🍼",
  sleep: "😴",
  diaper: "🧷",
  pump: "🧴",
  milestone: "⭐",
};

const FEED_LABELS = {
  breast_left: "Breast L",
  breast_right: "Breast R",
  both_sides: "Both Sides",
  bottle: "Bottle",
};
const SLEEP_LABELS = { nap: "Nap", night: "Night" };
const DIAPER_LABELS = { wet: "Wet", dirty: "Dirty", both: "Both" };

function eventLabel(ev) {
  const detail = ev.detail || {};
  switch (ev.event_type) {
    case "feed":
      return FEED_LABELS[detail.type] || detail.type || "Feed";
    case "sleep":
      return SLEEP_LABELS[detail.type] || detail.type || "Sleep";
    case "diaper":
      return DIAPER_LABELS[detail.type] || detail.type || "Diaper";
    case "milestone":
      return detail.title || "Milestone";
    default:
      return ev.event_type;
  }
}

function formatEventTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DayTimeline({ events, loading }) {
  if (loading) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Loading...
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No events this day
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <div
          key={`${ev.event_type}-${ev.id}`}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <span className="text-xl">{EVENT_ICONS[ev.event_type] || "📌"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {eventLabel(ev)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatEventTime(ev.timestamp)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
