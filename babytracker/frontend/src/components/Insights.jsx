import { useState, useEffect, useCallback } from "react";
import { useBaby } from "../context/BabyContext";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function dirtyLabel(daysSinceDirty) {
  if (daysSinceDirty === 0) return "today";
  if (daysSinceDirty === 1) return "1 day ago";
  if (daysSinceDirty >= 999) return "never";
  return `${daysSinceDirty} days ago`;
}

function dirtyColourClass(daysSinceDirty) {
  if (daysSinceDirty >= 2) return "text-red-600 dark:text-red-400";
  if (daysSinceDirty === 1) return "text-amber-600 dark:text-amber-400";
  return "";
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-40 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

function InsightCard({ title, icon, children, borderColor }) {
  return (
    <div className={`rounded-2xl border ${borderColor} bg-white/90 backdrop-blur-sm p-4 shadow-md dark:bg-gray-800`}>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {icon} {title}
      </h3>
      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        {children}
      </div>
    </div>
  );
}

function AlertChip({ alert }) {
  const isWarning = alert.type === "warning";
  const chipClass = isWarning
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  const icon = isWarning ? "\uD83D\uDEA8" : (alert.message.includes("\uD83C\uDF89") ? "" : "\u2139\uFE0F");

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${chipClass}`}>
      {icon} {alert.message}
    </span>
  );
}

export default function Insights() {
  const { selectedBaby } = useBaby();
  const [insightsData, setInsightsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    if (!selectedBaby?.id) return;
    try {
      const response = await fetch(
        `/api/v1/babies/${selectedBaby.id}/insights`
      );
      if (response.ok) {
        setInsightsData(await response.json());
      }
    } catch {
      // keep current state
    } finally {
      setLoading(false);
    }
  }, [selectedBaby?.id]);

  useEffect(() => {
    setLoading(true);
    fetchInsights();
    const interval = setInterval(fetchInsights, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  if (loading) {
    return (
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3">
          Insights
        </h2>
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    );
  }

  if (!insightsData || !insightsData.has_enough_data) {
    return null;
  }

  const { feeds, sleep, nappies, alerts } = insightsData;

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3">
        Insights
      </h2>
      <div className="space-y-3">
        <InsightCard title="Feeds" icon="\uD83C\uDF7C" borderColor="border-orange-200 dark:border-orange-700">
          <p>Feeds since midnight: {feeds.count_since_midnight}</p>
          <p>This week avg: {feeds.average_per_day_this_week}/day</p>
        </InsightCard>

        <InsightCard title="Sleep" icon="\uD83D\uDE34" borderColor="border-purple-200 dark:border-purple-700">
          <p>Sleep last 24h: {formatMinutes(sleep.total_last_24h_minutes)}</p>
          <p>Naps today: {sleep.nap_count_today}</p>
          <p>Longest stretch last night: {formatMinutes(sleep.longest_night_stretch_minutes)}</p>
        </InsightCard>

        <InsightCard title="Nappies" icon="\uD83E\uDDF7" borderColor="border-blue-200 dark:border-blue-700">
          <p>Wet nappies today: {nappies.wet_count_today} (avg: {nappies.average_wet_per_day_7day})</p>
          <p>
            Last dirty:{" "}
            <span className={dirtyColourClass(nappies.days_since_dirty)}>
              {dirtyLabel(nappies.days_since_dirty)}
            </span>
          </p>
        </InsightCard>

        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert, index) => (
              <AlertChip key={index} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
