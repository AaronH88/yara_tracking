import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import BabySwitcher from "./BabySwitcher";
import PersonaBadge from "./PersonaBadge";

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <BabySwitcher />
        <PersonaBadge />
      </header>

      <main className="pb-20 pt-2">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
