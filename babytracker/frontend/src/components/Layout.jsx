import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import BabySwitcher from "./BabySwitcher";
import PersonaBadge from "./PersonaBadge";

function ApiErrorBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkApi() {
      try {
        const response = await fetch("/api/v1/settings");
        if (mounted) setOffline(!response.ok);
      } catch {
        if (mounted) setOffline(true);
      }
    }

    checkApi();
    const interval = setInterval(checkApi, 15_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
      Unable to reach server. Some features may not work.
    </div>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <BabySwitcher />
        <PersonaBadge />
      </header>

      <ApiErrorBanner />

      <main className="pb-20 pt-2">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
