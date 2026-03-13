import { createContext, useContext, useState, useEffect, useCallback } from "react";

const SettingsContext = createContext(null);

const DARK_MODE_KEY = "darkMode";

function applyDarkClass(isDark) {
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    units: "imperial",
    time_format: "24h",
  });

  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    applyDarkClass(isDark);
  }, [isDark]);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/settings");
      if (response.ok) {
        const serverSettings = await response.json();
        setSettings(serverSettings);
      }
    } catch {
      // Keep defaults if API is unreachable
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    function handleFocus() {
      fetchSettings();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      // Optimistic update stands; next focus will reconcile
    }
  }, []);

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(DARK_MODE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isDark, toggleDark }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
