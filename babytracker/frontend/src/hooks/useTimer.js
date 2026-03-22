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

export function useTimer(startedAt, { pausedSeconds = 0, pausedAt = null } = {}) {
  const isRunning = startedAt != null;

  const [elapsed, setElapsed] = useState(() => {
    if (!isRunning) return null;
    const pauseOffsetMs = (pausedSeconds || 0) * 1000;
    if (pausedAt) {
      const ms = new Date(pausedAt).getTime() - new Date(startedAt).getTime() - pauseOffsetMs;
      return formatElapsed(Math.max(0, ms));
    }
    return formatElapsed(Math.max(0, Date.now() - new Date(startedAt).getTime() - pauseOffsetMs));
  });

  useEffect(() => {
    if (!isRunning) {
      setElapsed(null);
      return;
    }

    const pauseOffsetMs = (pausedSeconds || 0) * 1000;

    function tick() {
      if (pausedAt) {
        const ms = new Date(pausedAt).getTime() - new Date(startedAt).getTime() - pauseOffsetMs;
        setElapsed(formatElapsed(Math.max(0, ms)));
      } else {
        const ms = Date.now() - new Date(startedAt).getTime() - pauseOffsetMs;
        setElapsed(formatElapsed(Math.max(0, ms)));
      }
    }

    tick();
    if (pausedAt) return;
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [startedAt, isRunning, pausedSeconds, pausedAt]);

  return { elapsed, isRunning };
}
