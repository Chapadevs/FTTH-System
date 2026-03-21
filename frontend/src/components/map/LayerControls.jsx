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
        background: "white",
        padding: "0.75rem",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={showPoles}
          onChange={(e) => setShowPoles(e.target.checked)}
        />
        <span>Poles</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={showEquipment}
          onChange={(e) => setShowEquipment(e.target.checked)}
        />
        <span>Equipment</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
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
