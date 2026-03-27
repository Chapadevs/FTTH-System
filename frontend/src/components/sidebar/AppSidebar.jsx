import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/map", label: "Map", icon: "🗺" },
  { to: "/projects", label: "Projects", icon: "📁" },
  { to: "/equipment", label: "Equipment", icon: "⚙" },
  { to: "/settings", label: "Settings", icon: "🔧" },
];

function HamburgerIcon({ isOpen }) {
  const bar = {
    display: "block",
    width: "20px",
    height: "2px",
    background: "#334155",
    borderRadius: "2px",
    transition: "transform 0.25s ease, opacity 0.25s ease",
  };

  return (
    <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span
        style={{
          ...bar,
          transform: isOpen ? "translateY(6px) rotate(45deg)" : "none",
        }}
      />
      <span
        style={{
          ...bar,
          opacity: isOpen ? 0 : 1,
        }}
      />
      <span
        style={{
          ...bar,
          transform: isOpen ? "translateY(-6px) rotate(-45deg)" : "none",
        }}
      />
    </span>
  );
}

export function AppSidebar({ isCollapsed, isMobile, onToggle, onNavigate }) {
  const sidebarWidth = isCollapsed && !isMobile ? "64px" : "220px";

  return (
    <>
      {isMobile && !isCollapsed && (
        <div
          onClick={onToggle}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 40,
            transition: "opacity 0.2s ease",
          }}
        />
      )}

      <aside
        style={{
          position: isMobile ? "fixed" : "relative",
          top: 0,
          left: 0,
          bottom: 0,
          width: sidebarWidth,
          minWidth: sidebarWidth,
          transform: isMobile && isCollapsed ? "translateX(-100%)" : "translateX(0)",
          borderRight: "1px solid #e2e8f0",
          padding: "1rem",
          background: "#f8fafc",
          transition: "width 0.2s ease, transform 0.25s ease",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed && !isMobile ? "center" : "space-between",
            marginBottom: "1.25rem",
          }}
        >
          {(!isCollapsed || isMobile) && (
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, whiteSpace: "nowrap" }}>
              FiberOps
            </h2>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
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
              flexShrink: 0,
            }}
          >
            <HamburgerIcon isOpen={!isCollapsed || (isMobile && !isCollapsed)} />
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={isMobile ? onNavigate : undefined}
              title={isCollapsed && !isMobile ? label : undefined}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                textDecoration: "none",
                color: isActive ? "#0f172a" : "#64748b",
                background: isActive ? "#e2e8f0" : "transparent",
                fontWeight: isActive ? 600 : 400,
                whiteSpace: "nowrap",
                justifyContent: isCollapsed && !isMobile ? "center" : "flex-start",
                transition: "background 0.15s ease",
              })}
            >
              <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{icon}</span>
              {(!isCollapsed || isMobile) && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
