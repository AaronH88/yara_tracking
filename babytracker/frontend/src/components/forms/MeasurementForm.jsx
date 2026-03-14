import { useState, useEffect } from "react";
import { useBaby } from "../../context/BabyContext";
import { usePersona } from "../../context/PersonaContext";
import { useSettings } from "../../context/SettingsContext";

const OZ_PER_LB = 16;
const OZ_PER_KG = 35.274;
const IN_PER_CM = 0.393701;

function ozToLbsOz(totalOz) {
  if (totalOz == null) return { lbs: "", oz: "" };
  const lbs = Math.floor(totalOz / OZ_PER_LB);
  const oz = Math.round((totalOz % OZ_PER_LB) * 10) / 10;
  return { lbs: String(lbs), oz: String(oz) };
}

function ozToKg(totalOz) {
  if (totalOz == null) return "";
  return String(Math.round((totalOz / OZ_PER_KG) * 100) / 100);
}

function inToCm(inches) {
  if (inches == null) return "";
  return String(Math.round((inches / IN_PER_CM) * 10) / 10);
}

export default function MeasurementForm({ event, onSaved, onCancel }) {
  const { selectedBaby } = useBaby();
  const { persona } = usePersona();
  const { settings } = useSettings();
  const isMetric = settings.units === "metric";

  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(event?.user_id ?? persona?.id ?? "");
  const [measuredAt, setMeasuredAt] = useState(
    event?.measured_at ?? new Date().toISOString().slice(0, 10)
  );

  const [weightLbs, setWeightLbs] = useState(() => {
    if (!event || isMetric) return "";
    return ozToLbsOz(event.weight_oz).lbs;
  });
  const [weightOzPart, setWeightOzPart] = useState(() => {
    if (!event || isMetric) return "";
    return ozToLbsOz(event.weight_oz).oz;
  });
  const [weightKg, setWeightKg] = useState(() => {
    if (!event || !isMetric) return "";
    return ozToKg(event.weight_oz);
  });

  const [height, setHeight] = useState(() => {
    if (!event) return "";
    if (isMetric) return inToCm(event.height_in);
    return event.height_in != null ? String(event.height_in) : "";
  });
  const [headCm, setHeadCm] = useState(
    event?.head_cm != null ? String(event.head_cm) : ""
  );
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/v1/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedBaby?.id) return;
    setSubmitting(true);
    try {
      const body = {
        user_id: Number(userId),
        measured_at: measuredAt,
        notes: notes.trim() || null,
      };

      if (isMetric) {
        const kg = parseFloat(weightKg);
        if (!isNaN(kg) && kg > 0) {
          body.weight_oz = Math.round(kg * OZ_PER_KG * 100) / 100;
        }
        const cm = parseFloat(height);
        if (!isNaN(cm) && cm > 0) {
          body.height_in = Math.round(cm * IN_PER_CM * 100) / 100;
        }
      } else {
        const lbs = parseFloat(weightLbs) || 0;
        const ozPart = parseFloat(weightOzPart) || 0;
        const totalOz = lbs * OZ_PER_LB + ozPart;
        if (totalOz > 0) {
          body.weight_oz = totalOz;
        }
        const inches = parseFloat(height);
        if (!isNaN(inches) && inches > 0) {
          body.height_in = inches;
        }
      }

      const parsedHead = parseFloat(headCm);
      if (!isNaN(parsedHead) && parsedHead > 0) {
        body.head_cm = parsedHead;
      }

      const url = event
        ? `/api/v1/babies/${selectedBaby.id}/measurements/${event.id}`
        : `/api/v1/babies/${selectedBaby.id}/measurements`;
      const method = event ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok && onSaved) {
        onSaved(await response.json());
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Logged by
        </label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Measured at
        </label>
        <input
          type="date"
          value={measuredAt}
          onChange={(e) => setMeasuredAt(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Weight {isMetric ? "(kg)" : "(lbs + oz)"}
        </label>
        {isMetric ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="kg"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
              dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        ) : (
          <div className="mt-1 grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              placeholder="lbs"
              className="block w-full rounded-md border border-gray-300 px-3 py-2
                dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <input
              type="number"
              step="0.1"
              min="0"
              max="15.9"
              value={weightOzPart}
              onChange={(e) => setWeightOzPart(e.target.value)}
              placeholder="oz"
              className="block w-full rounded-md border border-gray-300 px-3 py-2
                dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Height ({isMetric ? "cm" : "in"})
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Head circumference (cm)
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          value={headCm}
          onChange={(e) => setHeadCm(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
            dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-blue-600 min-h-[48px] py-3 text-white font-medium
            hover:bg-blue-700 disabled:opacity-50"
        >
          {event ? "Update" : "Create"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 min-h-[48px] py-3 text-gray-700 font-medium
              hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
