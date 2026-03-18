import { useState, useEffect, useCallback } from "react";
import { useBaby } from "../context/BabyContext";
import FeedForm from "../components/forms/FeedForm";
import SleepForm from "../components/forms/SleepForm";
import DiaperForm from "../components/forms/DiaperForm";
import PumpForm from "../components/forms/PumpForm";
import MilestoneForm from "../components/forms/MilestoneForm";

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "feed", label: "Feeds" },
  { key: "sleep", label: "Sleeps" },
  { key: "diaper", label: "Nappies" },
  { key: "pump", label: "Pumps" },
  { key: "milestone", label: "Milestones" },
];

const DATE_FILTERS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "all", label: "All" },
];

const FEED_LABELS = {
  breast_left: "Breast L",
  breast_right: "Breast R",
  both_sides: "Both Sides",
  bottle: "Bottle",
};
const DIAPER_LABELS = { wet: "Wet", dirty: "Dirty", both: "Both" };
const SLEEP_LABELS = { nap: "Nap", night: "Night" };

const FORM_BY_TYPE = {
  feed: FeedForm,
  sleep: SleepForm,
  diaper: DiaperForm,
  pump: PumpForm,
  milestone: MilestoneForm,
};

const ICON_BY_TYPE = {
  feed: "🍼",
  sleep: "😴",
  diaper: "🧷",
  pump: "🧴",
  milestone: "⭐",
};

function formatTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return null;
  const totalMin = Math.floor(
    (new Date(endedAt) - new Date(startedAt)) / 60000
  );
  if (totalMin < 60) return `${totalMin}m`;
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}

function startOfDay(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function eventDetail(ev) {
  switch (ev.eventType) {
    case "feed":
      return FEED_LABELS[ev.type] || ev.type;
    case "sleep":
      return SLEEP_LABELS[ev.type] || ev.type;
    case "diaper":
      return DIAPER_LABELS[ev.type] || ev.type;
    case "pump": {
      const parts = [];
      if (ev.duration_minutes) parts.push(`${ev.duration_minutes}min`);
      return parts.length ? parts.join(", ") : "Pump session";
    }
    case "milestone":
      return ev.title || "Milestone";
    default:
      return "";
  }
}

function deleteUrl(ev, babyId) {
  if (ev.eventType === "pump") return `/api/v1/pumps/${ev.id}`;
  return `/api/v1/babies/${babyId}/${ev.eventType}s/${ev.id}`;
}

export default function History() {
  const { selectedBaby } = useBaby();
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deletingEvent, setDeletingEvent] = useState(null);

  const fetchEvents = useCallback(async () => {
    if (!selectedBaby?.id) return;
    setLoading(true);
    try {
      const babyId = selectedBaby.id;
      const responses = await Promise.all([
        fetch(`/api/v1/babies/${babyId}/feeds?limit=${limit}`),
        fetch(`/api/v1/babies/${babyId}/sleeps?limit=${limit}`),
        fetch(`/api/v1/babies/${babyId}/diapers?limit=${limit}`),
        fetch(`/api/v1/pumps?limit=${limit}`),
        fetch(`/api/v1/babies/${babyId}/milestones?limit=${limit}`),
        fetch("/api/v1/users"),
      ]);

      const merged = [];
      const tagAndPush = async (res, eventType, timeField) => {
        if (!res.ok) return;
        const items = await res.json();
        items.forEach((item) =>
          merged.push({ ...item, eventType, sortTime: item[timeField] })
        );
      };

      await tagAndPush(responses[0], "feed", "started_at");
      await tagAndPush(responses[1], "sleep", "started_at");
      await tagAndPush(responses[2], "diaper", "logged_at");
      await tagAndPush(responses[3], "pump", "logged_at");
      await tagAndPush(responses[4], "milestone", "occurred_at");

      merged.sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));
      setEvents(merged);

      if (responses[5].ok) setUsers(await responses[5].json());
    } finally {
      setLoading(false);
    }
  }, [selectedBaby?.id, limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = events.filter((ev) => {
    if (typeFilter !== "all" && ev.eventType !== typeFilter) return false;
    const evTime = new Date(ev.sortTime);
    if (dateFilter === "today") return evTime >= startOfDay(0);
    if (dateFilter === "week") return evTime >= startOfDay(7);
    return true;
  });

  function getUserName(userId) {
    return users.find((u) => u.id === userId)?.name || "";
  }

  async function handleDelete() {
    if (!deletingEvent) return;
    const res = await fetch(deleteUrl(deletingEvent, selectedBaby.id), {
      method: "DELETE",
    });
    if (res.ok) {
      setDeletingEvent(null);
      fetchEvents();
    }
  }

  if (!selectedBaby) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No baby selected
      </div>
    );
  }

  const EditForm = editingEvent ? FORM_BY_TYPE[editingEvent.eventType] : null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TYPE_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              typeFilter === key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {DATE_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setDateFilter(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              dateFilter === key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {events.length === 0 ? "No events logged yet" : "No events match your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((ev) => (
            <div
              key={`${ev.eventType}-${ev.id}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <button
                className="flex flex-1 items-center gap-3 text-left"
                onClick={() => setEditingEvent(ev)}
              >
                <span className="text-xl">{ICON_BY_TYPE[ev.eventType]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {eventDetail(ev)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(ev.sortTime)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {(ev.eventType === "feed" || ev.eventType === "sleep") &&
                      ev.ended_at && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDuration(ev.started_at, ev.ended_at)}
                        </span>
                      )}
                    {ev.user_id && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {getUserName(ev.user_id)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <button
                onClick={() => setDeletingEvent(ev)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                aria-label="Delete event"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {filteredEvents.length >= 20 && (
        <button
          onClick={() => setLimit((prev) => prev + 50)}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 min-h-[48px] py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Load More
        </button>
      )}

      {deletingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 dark:bg-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Delete this {deletingEvent.eventType === "diaper" ? "nappy" : deletingEvent.eventType} event?
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-600 min-h-[48px] py-3 font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingEvent(null)}
                className="flex-1 rounded-lg border border-gray-300 min-h-[48px] py-3 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEvent && EditForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
              Edit{" "}
              {editingEvent.eventType === "diaper" ? "Nappy" : editingEvent.eventType.charAt(0).toUpperCase() +
                editingEvent.eventType.slice(1)}
            </h3>
            <EditForm
              event={editingEvent}
              onSaved={() => {
                setEditingEvent(null);
                fetchEvents();
              }}
              onCancel={() => setEditingEvent(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
