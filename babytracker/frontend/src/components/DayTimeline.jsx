const EVENT_ICONS = {
  feed: "\u{1F37C}",
  sleep: "\u{1F634}",
  diaper: "\u{1F9F7}",
  milestone: "\u2B50",
};

const EVENT_COLORS = {
  feed: { bg: "bg-blue-50 dark:bg-blue-900/30", border: "border-blue-300 dark:border-blue-700", bar: "bg-blue-500" },
  sleep: { bg: "bg-purple-50 dark:bg-purple-900/30", border: "border-purple-300 dark:border-purple-700", bar: "bg-purple-500" },
  diaper: { bg: "bg-yellow-50 dark:bg-yellow-900/30", border: "border-yellow-300 dark:border-yellow-700", bar: "bg-yellow-500" },
  milestone: { bg: "bg-amber-50 dark:bg-amber-900/30", border: "border-amber-300 dark:border-amber-700", bar: "bg-amber-500" },
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

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const totalMin = Math.floor(
    (new Date(endIso) - new Date(startIso)) / 60000
  );
  if (totalMin < 1) return "<1m";
  if (totalMin < 60) return `${totalMin}m`;
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}

function eventExtra(ev) {
  const detail = ev.detail || {};
  const parts = [];
  if (ev.event_type === "feed") {
    const duration = formatDuration(detail.started_at, detail.ended_at);
    if (duration) parts.push(duration);
    if (detail.amount_oz != null) parts.push(`${detail.amount_oz}oz`);
  }
  if (ev.event_type === "sleep") {
    const duration = formatDuration(detail.started_at, detail.ended_at);
    if (duration) parts.push(duration);
  }
  return parts.join(" \u00B7 ");
}

function getHourFromTimestamp(isoString) {
  if (!isoString) return 0;
  return new Date(isoString).getHours();
}

function eventsOverlap(evA, evB) {
  const startA = new Date(evA.timestamp).getTime();
  const endA = evA.event_type === "sleep" && evA.detail?.ended_at
    ? new Date(evA.detail.ended_at).getTime()
    : startA + 60000;
  const startB = new Date(evB.timestamp).getTime();
  const endB = evB.event_type === "sleep" && evB.detail?.ended_at
    ? new Date(evB.detail.ended_at).getTime()
    : startB + 60000;
  return startA < endB && startB < endA;
}

function assignOverlapOffsets(events) {
  const offsets = new Array(events.length).fill(0);
  for (let i = 0; i < events.length; i++) {
    for (let j = 0; j < i; j++) {
      if (eventsOverlap(events[i], events[j]) && offsets[i] === offsets[j]) {
        offsets[i] = offsets[j] + 1;
      }
    }
  }
  return offsets;
}

function groupByHour(events) {
  const hourMap = {};
  for (const ev of events) {
    const hour = getHourFromTimestamp(ev.timestamp);
    if (!hourMap[hour]) hourMap[hour] = [];
    hourMap[hour].push(ev);
  }
  return Object.keys(hourMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((hour) => ({ hour, events: hourMap[hour] }));
}

function formatHour(hour) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function SleepBar({ ev, onClick }) {
  const colors = EVENT_COLORS.sleep;
  const duration = formatDuration(ev.detail?.started_at, ev.detail?.ended_at);
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[3rem] w-full items-center gap-2 rounded-lg border-l-4 ${colors.border} ${colors.bg} px-3 py-2 text-left transition-colors active:opacity-80`}
    >
      <span className="text-lg">{EVENT_ICONS.sleep}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {eventLabel(ev)}
          </span>
          <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
            {formatEventTime(ev.timestamp)}
            {ev.detail?.ended_at && ` \u2013 ${formatEventTime(ev.detail.ended_at)}`}
          </span>
        </div>
        {duration && (
          <div className="mt-0.5">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 rounded-full ${colors.bar}`} style={{ width: "40%" }} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{duration}</span>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

function EventMarker({ ev, onClick, offsetLevel }) {
  const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.feed;
  const extra = eventExtra(ev);
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[3rem] w-full items-center gap-2 rounded-lg border-l-4 ${colors.border} ${colors.bg} px-3 py-2 text-left transition-colors active:opacity-80`}
      style={offsetLevel > 0 ? { marginLeft: `${offsetLevel * 16}px` } : undefined}
    >
      <span className="text-lg">{EVENT_ICONS[ev.event_type] || "\u{1F4CC}"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {eventLabel(ev)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatEventTime(ev.timestamp)}
          </span>
        </div>
        {extra && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{extra}</p>
        )}
      </div>
    </button>
  );
}

export default function DayTimeline({ events, loading, onEventTap }) {
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

  const hourGroups = groupByHour(events);
  const overlapOffsets = assignOverlapOffsets(events);

  return (
    <div className="relative">
      {hourGroups.map(({ hour, events: hourEvents }) => (
        <div key={hour} className="flex gap-3">
          {/* Hour label column */}
          <div className="flex w-14 shrink-0 flex-col items-end pt-3">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {formatHour(hour)}
            </span>
          </div>

          {/* Timeline line + events */}
          <div className="relative flex-1 border-l-2 border-gray-200 pb-3 pl-4 dark:border-gray-700">
            {/* Dot on timeline */}
            <div className="absolute -left-[5px] top-4 h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />

            <div className="space-y-2 pt-1">
              {hourEvents.map((ev) => {
                const globalIdx = events.indexOf(ev);
                const offset = overlapOffsets[globalIdx] || 0;
                const handleTap = onEventTap ? () => onEventTap(ev) : undefined;

                if (ev.event_type === "sleep") {
                  return (
                    <SleepBar key={`${ev.event_type}-${ev.id}`} ev={ev} onClick={handleTap} />
                  );
                }
                return (
                  <EventMarker
                    key={`${ev.event_type}-${ev.id}`}
                    ev={ev}
                    onClick={handleTap}
                    offsetLevel={offset}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
