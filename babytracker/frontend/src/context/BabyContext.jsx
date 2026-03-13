import { createContext, useContext, useState } from "react";

const BabyContext = createContext(null);

export function BabyProvider({ children }) {
  const [selectedBaby, setSelectedBaby] = useState(null);

  return (
    <BabyContext.Provider value={{ selectedBaby, setSelectedBaby }}>
      {children}
    </BabyContext.Provider>
  );
}

export function useBaby() {
  return useContext(BabyContext);
}
