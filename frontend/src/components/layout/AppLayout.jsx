import { Outlet } from "react-router-dom";
import { AppSidebar } from "../sidebar/AppSidebar.jsx";

export function AppLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AppSidebar />
      <main style={{ flex: 1, padding: "1rem", overflow: "auto", position: "relative" }}>
        <Outlet />
        <div id="pole-map-popover-root" style={{ pointerEvents: "none" }} />
      </main>
    </div>
  );
}
