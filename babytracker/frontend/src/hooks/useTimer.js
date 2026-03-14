import { useState, useEffect } from "react";

function formatElapsed(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds < 120) {
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    }
    return `${seconds}s`;
  }

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m`;
}

export function useTimer(startedAt) {
  const isRunning = startedAt != null;

  const [elapsed, setElapsed] = useState(() => {
    if (!isRunning) return null;
    return formatElapsed(Date.now() - new Date(startedAt).getTime());
  });

  useEffect(() => {
    if (!isRunning) {
      setElapsed(null);
      return;
    }

    function tick() {
      const ms = Date.now() - new Date(startedAt).getTime();
      setElapsed(formatElapsed(Math.max(0, ms)));
    }

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [startedAt, isRunning]);

  return { elapsed, isRunning };
}
