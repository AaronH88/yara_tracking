import { createContext, useContext, useState } from "react";

const PersonaContext = createContext(null);

export function PersonaProvider({ children }) {
  const [persona, setPersona] = useState(() => {
    const stored = localStorage.getItem("persona");
    return stored ? JSON.parse(stored) : null;
  });

  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  return useContext(PersonaContext);
}
