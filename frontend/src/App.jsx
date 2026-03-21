import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { MapPage } from "./pages/MapPage.jsx";
import { ProjectsPage } from "./pages/ProjectsPage.jsx";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.jsx";
import { EquipmentPage } from "./pages/EquipmentPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";

function ProtectedRoute({ children }) {
  const email = localStorage.getItem("fiberops-user-email");
  if (!email) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/map" replace />} />
        <Route path="map" element={<MapPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
