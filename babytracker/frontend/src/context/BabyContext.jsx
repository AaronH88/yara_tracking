import { createContext, useContext, useState, useEffect, useCallback } from "react";

const BabyContext = createContext(null);

const SELECTED_BABY_KEY = "selectedBabyId";

export function BabyProvider({ children }) {
  const [babies, setBabies] = useState([]);
  const [selectedBaby, setSelectedBabyState] = useState(null);

  const refreshBabies = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/babies");
      if (!response.ok) return;
      const fetchedBabies = await response.json();
      setBabies(fetchedBabies);

      const storedId = localStorage.getItem(SELECTED_BABY_KEY);
      const storedBaby = storedId
        ? fetchedBabies.find((b) => b.id === Number(storedId))
        : null;

      if (storedBaby) {
        setSelectedBabyState(storedBaby);
      } else if (fetchedBabies.length > 0) {
        setSelectedBabyState(fetchedBabies[0]);
        localStorage.setItem(SELECTED_BABY_KEY, String(fetchedBabies[0].id));
      }
    } catch {
      // Keep empty state if API is unreachable
    }
  }, []);

  useEffect(() => {
    refreshBabies();
  }, [refreshBabies]);

  const setSelectedBaby = useCallback((baby) => {
    setSelectedBabyState(baby);
    if (baby) {
      localStorage.setItem(SELECTED_BABY_KEY, String(baby.id));
    } else {
      localStorage.removeItem(SELECTED_BABY_KEY);
    }
  }, []);

  return (
    <BabyContext.Provider value={{ babies, selectedBaby, setSelectedBaby, refreshBabies }}>
      {children}
    </BabyContext.Provider>
  );
}

export function useBaby() {
  return useContext(BabyContext);
}
