import { useState, useEffect, useCallback } from "react";
import { useBaby } from "../context/BabyContext";
import DayTimeline from "../components/DayTimeline";
import FeedForm from "../components/forms/FeedForm";
import SleepForm from "../components/forms/SleepForm";
import DiaperForm from "../components/forms/DiaperForm";
import MilestoneForm from "../components/forms/MilestoneForm";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FORM_BY_TYPE = {
  feed: FeedForm,
  sleep: SleepForm,
  diaper: DiaperForm,
  milestone: MilestoneForm,
};

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let currentWeek = new Array(firstDay).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

function dateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function dayEventToFormEvent(dayEvent) {
  const detail = dayEvent.detail || {};
  const base = { id: dayEvent.id, eventType: dayEvent.event_type };
  switch (dayEvent.event_type) {
    case "feed":
      return { ...base, started_at: detail.started_at, ended_at: detail.ended_at, type: detail.type, amount_oz: detail.amount_oz, user_id: detail.user_id, notes: detail.notes };
    case "sleep":
      return { ...base, started_at: detail.started_at, ended_at: detail.ended_at, type: detail.type, user_id: detail.user_id, notes: detail.notes };
    case "diaper":
      return { ...base, logged_at: detail.logged_at, type: detail.type, user_id: detail.user_id, notes: detail.notes };
    case "milestone":
      return { ...base, occurred_at: detail.occurred_at, title: detail.title, user_id: detail.user_id, notes: detail.notes };
    default:
      return base;
  }
}

function EventDots({ summary }) {
  if (!summary) return null;

  return (
    <div className="mt-0.5 flex items-center justify-center gap-0.5">
      {summary.feed_count > 0 && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
      )}
      {summary.sleep_count > 0 && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
      )}
      {summary.diaper_count > 0 && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
      )}
      {summary.has_milestone && (
        <span className="inline-block h-2 w-2 text-center text-[8px] leading-none">
          ⭐
        </span>
      )}
    </div>
  );
}

export default function Calendar() {
  const { selectedBaby } = useBaby();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [monthData, setMonthData] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayEvents, setDayEvents] = useState([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const today = todayString();
  const weeks = buildCalendarGrid(viewYear, viewMonth);

  const fetchMonth = useCallback(async () => {
    if (!selectedBaby?.id) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/calendar/month?year=${viewYear}&month=${viewMonth + 1}`
      );
      if (!response.ok) return;
      setMonthData(await response.json());
    } finally {
      setLoading(false);
    }
  }, [selectedBaby?.id, viewYear, viewMonth]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  useEffect(() => {
    setSelectedDay(null);
    setDayEvents([]);
  }, [viewYear, viewMonth]);

  const fetchDayEvents = useCallback(
    async (dateStr) => {
      if (!selectedBaby?.id) return;
      setDayLoading(true);
      try {
        const response = await fetch(
          `/api/v1/babies/${selectedBaby.id}/calendar/day?date=${dateStr}`
        );
        if (!response.ok) return;
        setDayEvents(await response.json());
      } finally {
        setDayLoading(false);
      }
    },
    [selectedBaby?.id]
  );

  function handleDayClick(day) {
    if (!day) return;
    const key = dateKey(viewYear, viewMonth, day);
    if (selectedDay === key) {
      setSelectedDay(null);
      setDayEvents([]);
    } else {
      setSelectedDay(key);
      fetchDayEvents(key);
    }
  }

  function handleEventTap(dayEvent) {
    setEditingEvent(dayEventToFormEvent(dayEvent));
  }

  function handleEditSaved() {
    setEditingEvent(null);
    if (selectedDay) fetchDayEvents(selectedDay);
    fetchMonth();
  }

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
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
      {/* Month/year header with navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Previous month"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <button
          onClick={goToNextMonth}
          className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Next month"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_HEADERS.map((day) => (
          <div
            key={day}
            className="pb-1 text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading...
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-px">
          {weeks.flat().map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="min-h-[3rem]" />;
            }

            const key = dateKey(viewYear, viewMonth, day);
            const isToday = key === today;
            const isSelected = key === selectedDay;
            const summary = monthData[key];

            return (
              <button
                key={key}
                onClick={() => handleDayClick(day)}
                className={`flex min-h-[3rem] flex-col items-center rounded-lg py-1 transition-colors ${
                  isSelected
                    ? "bg-blue-100 dark:bg-blue-900/40"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    isToday
                      ? "bg-blue-600 font-bold text-white"
                      : "text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {day}
                </span>
                <EventDots summary={summary} />
              </button>
            );
          })}
        </div>
      )}

      {/* Day timeline below calendar */}
      {selectedDay && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {new Date(selectedDay + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <DayTimeline
            events={dayEvents}
            loading={dayLoading}
            onEventTap={handleEventTap}
          />
        </div>
      )}

      {/* Edit form modal */}
      {editingEvent && EditForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
              Edit{" "}
              {editingEvent.eventType.charAt(0).toUpperCase() +
                editingEvent.eventType.slice(1)}
            </h3>
            <EditForm
              event={editingEvent}
              onSaved={handleEditSaved}
              onCancel={() => setEditingEvent(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
