import { useState } from "react";
import FeedForm from "./forms/FeedForm";
import SleepForm from "./forms/SleepForm";
import DiaperForm from "./forms/DiaperForm";
import PumpForm from "./forms/PumpForm";
import MilestoneForm from "./forms/MilestoneForm";
import MeasurementForm from "./forms/MeasurementForm";

const EVENT_TYPES = [
  { key: "feed", label: "Feed", icon: "🍼" },
  { key: "sleep", label: "Sleep", icon: "😴" },
  { key: "diaper", label: "Nappy", icon: "🧷" },
  { key: "pump", label: "Pump", icon: "🧴" },
  { key: "milestone", label: "Milestone", icon: "⭐" },
  { key: "measurement", label: "Measurement", icon: "📏" },
];

const FORM_COMPONENTS = {
  feed: FeedForm,
  sleep: SleepForm,
  diaper: DiaperForm,
  pump: PumpForm,
  milestone: MilestoneForm,
  measurement: MeasurementForm,
};

export default function LogPastEventModal({ onClose }) {
  const [selectedType, setSelectedType] = useState(null);

  function handleSaved() {
    onClose(true);
  }

  function handleCancel() {
    if (selectedType) {
      setSelectedType(null);
    } else {
      onClose(false);
    }
  }

  const FormComponent = selectedType ? FORM_COMPONENTS[selectedType] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-white dark:bg-gray-900 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {selectedType
              ? `Log Past ${EVENT_TYPES.find((t) => t.key === selectedType)?.label}`
              : "Log Past Event"}
          </h2>
          <button
            onClick={handleCancel}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {selectedType ? "← Back" : "✕"}
          </button>
        </div>

        <div className="p-4">
          {!selectedType && (
            <div className="grid grid-cols-2 gap-3">
              {EVENT_TYPES.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className="flex flex-col items-center justify-center rounded-xl border-2
                    border-gray-200 bg-white py-5 text-sm font-semibold text-gray-800
                    hover:border-purple-400 hover:bg-purple-50
                    dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
                    dark:hover:border-purple-500 dark:hover:bg-gray-700
                    active:scale-95 transition-transform min-h-[80px]"
                >
                  <span className="text-2xl mb-1">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}

          {FormComponent && (
            <FormComponent onSaved={handleSaved} onCancel={handleCancel} />
          )}
        </div>
      </div>
    </div>
  );
}
