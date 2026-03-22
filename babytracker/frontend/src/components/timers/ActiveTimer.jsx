import { useTimer } from "../../hooks/useTimer";
import { useSettings } from "../../context/SettingsContext";

function formatStartTime(isoString, timeFormat) {
  const date = new Date(isoString);
  if (timeFormat === "12h") {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${period}`;
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function ActiveTimer({ startedAt, pausedSeconds = 0, isPaused = false, pausedAt = null }) {
  const { elapsed } = useTimer(startedAt, { pausedSeconds, pausedAt });
  const { settings } = useSettings();

  return (
    <div className="flex flex-col items-center py-6">
      <p
        className="text-5xl font-mono font-bold text-blue-600 dark:text-blue-400"
        aria-live="polite"
      >
        {elapsed ?? "0s"}
      </p>
      {isPaused && (
        <span className="mt-2 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          PAUSED
        </span>
      )}
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Started {formatStartTime(startedAt, settings.time_format)}
      </p>
    </div>
  );
}
