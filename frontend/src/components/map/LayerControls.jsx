export function LayerControls({
  showPoles,
  setShowPoles,
  showEquipment,
  setShowEquipment,
  showRoutes,
  setShowRoutes,
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        padding: "0.65rem 0.75rem",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.82rem", color: "#0f172a" }}>
        <input
          type="checkbox"
          checked={showPoles}
          onChange={(e) => setShowPoles(e.target.checked)}
        />
        <span>Poles</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.82rem", color: "#0f172a" }}>
        <input
          type="checkbox"
          checked={showEquipment}
          onChange={(e) => setShowEquipment(e.target.checked)}
        />
        <span>Equipment</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.82rem", color: "#0f172a" }}>
        <input
          type="checkbox"
          checked={showRoutes}
          onChange={(e) => setShowRoutes(e.target.checked)}
        />
        <span>Routes</span>
      </label>
    </div>
  );
}
