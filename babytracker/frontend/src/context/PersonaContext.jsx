import { createContext, useContext, useState, useCallback } from "react";

const PersonaContext = createContext(null);

const PERSONA_KEY = "babytracker_persona";

export function PersonaProvider({ children }) {
  const [persona, setPersonaState] = useState(() => {
    const stored = localStorage.getItem(PERSONA_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const setPersona = useCallback((user) => {
    setPersonaState(user);
    localStorage.setItem(PERSONA_KEY, JSON.stringify(user));
  }, []);

  const clearPersona = useCallback(() => {
    setPersonaState(null);
    localStorage.removeItem(PERSONA_KEY);
  }, []);

  return (
    <PersonaContext.Provider value={{ persona, setPersona, clearPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  return useContext(PersonaContext);
}
