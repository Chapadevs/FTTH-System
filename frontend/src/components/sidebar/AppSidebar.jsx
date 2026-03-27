import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/map", label: "Map" },
  { to: "/projects", label: "Projects" },
  { to: "/equipment", label: "Equipment" },
  { to: "/settings", label: "Settings" },
];

export function AppSidebar() {
  return (
    <aside
      style={{
        width: "220px",
        borderRight: "1px solid #e2e8f0",
        padding: "1rem",
        background: "#f8fafc",
      }}
    >
      <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem" }}>FiberOps</h2>
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              textDecoration: "none",
              color: isActive ? "#0f172a" : "#64748b",
              background: isActive ? "#e2e8f0" : "transparent",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
