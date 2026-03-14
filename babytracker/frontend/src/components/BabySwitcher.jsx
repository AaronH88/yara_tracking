import { useState, useRef, useEffect } from "react";
import { useBaby } from "../context/BabyContext";
import { differenceInWeeks, differenceInMonths } from "date-fns";

function formatAge(birthdate) {
  const born = new Date(birthdate);
  const now = new Date();
  const months = differenceInMonths(now, born);
  if (months < 1) {
    const weeks = differenceInWeeks(now, born);
    return `${weeks}w`;
  }
  return `${months}mo`;
}

export default function BabySwitcher() {
  const { babies, selectedBaby, setSelectedBaby } = useBaby();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!selectedBaby) return null;

  const hasMultipleBabies = babies.length > 1;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => hasMultipleBabies && setOpen(!open)}
        className={`flex items-center gap-1 text-lg font-semibold text-gray-900 dark:text-white ${
          hasMultipleBabies ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <span>{selectedBaby.name}</span>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({formatAge(selectedBaby.birthdate)})
        </span>
        {hasMultipleBabies && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-5 w-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {babies.map((baby) => (
            <button
              key={baby.id}
              onClick={() => {
                setSelectedBaby(baby);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                baby.id === selectedBaby.id
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <span className="font-medium">{baby.name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatAge(baby.birthdate)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
