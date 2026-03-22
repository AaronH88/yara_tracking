import { useState, useEffect } from "react";

export default function Toast({ message, onDismiss }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2700);
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      onClick={() => {
        setVisible(false);
        onDismiss();
      }}
      className={`fixed top-4 left-4 right-4 z-50 cursor-pointer rounded-xl bg-gray-800 px-4 py-3
        text-center text-sm font-medium text-white shadow-lg
        dark:bg-gray-200 dark:text-gray-900
        transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      {message}
    </div>
  );
}
