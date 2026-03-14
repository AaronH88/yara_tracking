import { useSettings } from "../context/SettingsContext";
import { usePersona } from "../context/PersonaContext";

export default function Settings() {
  const { settings, updateSetting, isDark, toggleDark } = useSettings();
  const { persona, clearPersona } = usePersona();

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Dark Mode */}
      <section className="rounded-xl bg-white p-4 shadow dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dark Mode</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isDark ? "On" : "Off"}
            </p>
          </div>
          <button
            onClick={toggleDark}
            role="switch"
            aria-checked={isDark}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
              isDark ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                isDark ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Units */}
      <section className="rounded-xl bg-white p-4 shadow dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Units</h2>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
            <input
              type="radio"
              name="units"
              value="imperial"
              checked={settings.units === "imperial"}
              onChange={() => updateSetting("units", "imperial")}
              className="h-5 w-5 text-blue-600"
            />
            <span className="text-gray-900 dark:text-white">Imperial (oz, lbs, in)</span>
          </label>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
            <input
              type="radio"
              name="units"
              value="metric"
              checked={settings.units === "metric"}
              onChange={() => updateSetting("units", "metric")}
              className="h-5 w-5 text-blue-600"
            />
            <span className="text-gray-900 dark:text-white">Metric (ml, kg, cm)</span>
          </label>
        </div>
      </section>

      {/* Time Format */}
      <section className="rounded-xl bg-white p-4 shadow dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Time Format</h2>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
            <input
              type="radio"
              name="time_format"
              value="24h"
              checked={settings.time_format === "24h"}
              onChange={() => updateSetting("time_format", "24h")}
              className="h-5 w-5 text-blue-600"
            />
            <span className="text-gray-900 dark:text-white">24-hour</span>
          </label>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
            <input
              type="radio"
              name="time_format"
              value="12h"
              checked={settings.time_format === "12h"}
              onChange={() => updateSetting("time_format", "12h")}
              className="h-5 w-5 text-blue-600"
            />
            <span className="text-gray-900 dark:text-white">12-hour</span>
          </label>
        </div>
      </section>

      {/* Who Am I */}
      <section className="rounded-xl bg-white p-4 shadow dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Who Am I</h2>
        <div className="flex items-center justify-between">
          <p className="text-gray-700 dark:text-gray-300">
            Logged in as <span className="font-medium text-gray-900 dark:text-white">{persona?.name}</span>
          </p>
          <button
            onClick={clearPersona}
            className="min-h-[48px] rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Switch User
          </button>
        </div>
      </section>

      {/* About */}
      <section className="rounded-xl bg-white p-4 shadow dark:bg-gray-800">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">About</h2>
        <p className="text-gray-700 dark:text-gray-300">Baby Tracker</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Version 1.0.0</p>
      </section>
    </div>
  );
}
