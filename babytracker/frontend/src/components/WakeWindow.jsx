import { useState, useEffect, useCallback } from "react";
import { useBaby } from "../context/BabyContext";

export const WAKE_WINDOWS = [
  { maxWeeks: 2, idealMin: 45, idealMax: 60, alertAt: 75 },
  { maxWeeks: 4, idealMin: 60, idealMax: 75, alertAt: 90 },
  { maxWeeks: 8, idealMin: 60, idealMax: 90, alertAt: 105 },
  { maxWeeks: 13, idealMin: 75, idealMax: 120, alertAt: 135 },
  { maxWeeks: 17, idealMin: 90, idealMax: 120, alertAt: 150 },
  { maxWeeks: 21, idealMin: 90, idealMax: 150, alertAt: 180 },
  { maxWeeks: 26, idealMin: 120, idealMax: 180, alertAt: 210 },
  { maxWeeks: 39, idealMin: 150, idealMax: 210, alertAt: 240 },
  { maxWeeks: 999, idealMin: 180, idealMax: 240, alertAt: 270 },
];

export function getThresholdForAge(birthdate) {
  const ageMs = Date.now() - new Date(birthdate).getTime();
  const ageWeeks = ageMs / (7 * 24 * 60 * 60 * 1000);
  return WAKE_WINDOWS.find((w) => ageWeeks < w.maxWeeks) || WAKE_WINDOWS[WAKE_WINDOWS.length - 1];
}

export function getWakeColour(awakeMinutes, threshold) {
  if (awakeMinutes >= threshold.alertAt) return "red";
  if (awakeMinutes >= threshold.alertAt - 15) return "amber";
  return "green";
}

function formatElapsed(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

function elapsedMinutesSince(isoString) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
}

const COLOUR_DOT = {
  green: "text-green-500",
  amber: "text-yellow-500",
  red: "text-red-500",
};

const POLL_INTERVAL_MS = 60_000;
const TICK_INTERVAL_MS = 60_000;

export default function WakeWindow() {
  const { selectedBaby } = useBaby();
  const [wakeData, setWakeData] = useState(null);
  const [tickCounter, setTickCounter] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  const fetchWakeWindow = useCallback(async () => {
    if (!selectedBaby?.id) return;
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/wake-window`
      );
      if (response.ok) {
        setWakeData(await response.json());
      }
    } catch {
      // keep current state
    }
  }, [selectedBaby?.id]);

  useEffect(() => {
    fetchWakeWindow();
    const interval = setInterval(fetchWakeWindow, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchWakeWindow]);

  useEffect(() => {
    const interval = setInterval(() => setTickCounter((c) => c + 1), TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!wakeData || !selectedBaby?.birthdate) return null;

  const threshold = getThresholdForAge(selectedBaby.birthdate);

  if (wakeData.is_sleeping) {
    const sleepMinutes = elapsedMinutesSince(wakeData.sleep_started_at);
    return (
      <div className="rounded-2xl border border-purple-200 bg-pastel-lavender/50 p-4 shadow-md dark:border-purple-700 dark:bg-purple-900/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
            Sleeping
          </span>
          <span className="text-lg font-bold text-purple-800 dark:text-purple-200">
            {formatElapsed(sleepMinutes)}
          </span>
        </div>
      </div>
    );
  }

  const awakeMinutes = wakeData.awake_since
    ? elapsedMinutesSince(wakeData.awake_since)
    : wakeData.awake_minutes;
  const colour = getWakeColour(awakeMinutes, threshold);

  return (
    <div className="rounded-2xl border border-blue-200 bg-pastel-sky/50 p-4 shadow-md dark:border-blue-700 dark:bg-blue-900/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          Awake for {formatElapsed(awakeMinutes)}
        </span>
        <span
          className={`relative cursor-pointer text-xl ${COLOUR_DOT[colour]}`}
          onClick={() => setShowTooltip((s) => !s)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          role="button"
          aria-label={`Wake window status: ${colour}`}
        >
          {colour === "green" && "\u{1F7E2}"}
          {colour === "amber" && "\u{1F7E1}"}
          {colour === "red" && "\u{1F534}"}
          {showTooltip && (
            <span className="absolute right-0 top-8 z-10 w-56 rounded-lg bg-gray-800 px-3 py-2 text-xs font-normal text-white shadow-lg dark:bg-gray-700">
              Ideal wake window for age: {threshold.idealMin}&ndash;{threshold.idealMax} min
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
