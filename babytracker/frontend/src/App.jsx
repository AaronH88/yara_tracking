import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PersonaProvider } from "./context/PersonaContext";
import { BabyProvider } from "./context/BabyContext";
import { SettingsProvider } from "./context/SettingsContext";
import PersonaGate from "./components/PersonaGate";
import Layout from "./components/Layout";
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
            <PersonaGate>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Routes>
            </PersonaGate>
          </BrowserRouter>
        </SettingsProvider>
      </BabyProvider>
    </PersonaProvider>
  );
}

export default App;
