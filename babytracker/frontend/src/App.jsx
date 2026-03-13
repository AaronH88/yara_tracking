import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PersonaProvider } from "./context/PersonaContext";
import { BabyProvider } from "./context/BabyContext";
import { SettingsProvider } from "./context/SettingsContext";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Calendar from "./pages/Calendar";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";

function App() {
  return (
    <PersonaProvider>
      <BabyProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </BabyProvider>
    </PersonaProvider>
  );
}

export default App;
