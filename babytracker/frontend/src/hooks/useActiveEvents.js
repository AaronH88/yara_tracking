import { useState, useEffect, useCallback, useRef } from "react";

const POLL_INTERVAL_MS = 10_000;

export function useActiveEvents(babyId) {
  const [activeFeed, setActiveFeed] = useState(null);
  const [activeSleep, setActiveSleep] = useState(null);
  const [activeBurp, setActiveBurp] = useState(null);
  const intervalRef = useRef(null);

  const fetchActiveEvents = useCallback(async () => {
    if (!babyId) {
      setActiveFeed(null);
      setActiveSleep(null);
      setActiveBurp(null);
      return;
    }

    try {
      const [feedResponse, sleepResponse, burpResponse] = await Promise.all([
        fetch(`/api/v1/babies/${babyId}/feeds/active`),
        fetch(`/api/v1/babies/${babyId}/sleeps/active`),
        fetch(`/api/v1/babies/${babyId}/burps/active`),
      ]);

      setActiveFeed(feedResponse.ok ? await feedResponse.json() : null);
      setActiveSleep(sleepResponse.ok ? await sleepResponse.json() : null);
      setActiveBurp(burpResponse.ok ? await burpResponse.json() : null);
    } catch {
      // Keep current state if API is unreachable
    }
  }, [babyId]);

  useEffect(() => {
    if (!babyId) {
      setActiveFeed(null);
      setActiveSleep(null);
      setActiveBurp(null);
      return;
    }

    fetchActiveEvents();
    intervalRef.current = setInterval(fetchActiveEvents, POLL_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [babyId, fetchActiveEvents]);

  return { activeFeed, activeSleep, activeBurp, refetch: fetchActiveEvents };
}
