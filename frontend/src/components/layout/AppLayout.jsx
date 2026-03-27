import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "../sidebar/AppSidebar.jsx";

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

export function AppLayout() {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) return true;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem("sidebar-collapsed", String(isCollapsed));
    }
  }, [isCollapsed, isMobile]);

  useEffect(() => {
    if (isMobile) setIsCollapsed(true);
  }, [isMobile]);

  const handleToggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleNavigate = useCallback(() => {
    if (isMobile) setIsCollapsed(true);
  }, [isMobile]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AppSidebar
        isCollapsed={isCollapsed}
        isMobile={isMobile}
        onToggle={handleToggle}
        onNavigate={handleNavigate}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {isMobile && (
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.5rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Open menu"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                border: "none",
                borderRadius: "8px",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ display: "block", width: "20px", height: "2px", background: "#334155", borderRadius: "2px" }} />
                <span style={{ display: "block", width: "20px", height: "2px", background: "#334155", borderRadius: "2px" }} />
                <span style={{ display: "block", width: "20px", height: "2px", background: "#334155", borderRadius: "2px" }} />
              </span>
            </button>
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>FiberOps</span>
          </header>
        )}

        <main style={{ flex: 1, padding: "1rem", overflow: "auto", position: "relative" }}>
          <Outlet />
          <div id="pole-map-popover-root" style={{ pointerEvents: "none" }} />
        </main>
      </div>
    </div>
  );
}
