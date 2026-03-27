const barCardStyle = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderTop: "none",
  borderRadius: "0 0 12px 12px",
  padding: "0.28rem 0.36rem",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
  backdropFilter: "blur(12px)",
  width: "100%",
  boxSizing: "border-box",
};

const focusTabTones = {
  all: {
    background: "#f8fafc",
    border: "#cbd5e1",
    text: "#334155",
    muted: "#475569",
  },
  ote: {
    background: "#eff6ff",
    border: "#bfdbfe",
    text: "#1d4ed8",
    muted: "#1e40af",
  },
  distribution: {
    background: "#f0fdf4",
    border: "#86efac",
    text: "#15803d",
    muted: "#166534",
  },
  splitter: {
    background: "#fffbeb",
    border: "#fcd34d",
    text: "#b45309",
    muted: "#92400e",
  },
};

function PoleTypeButton({ label, count, tone, active, onClick }) {
  const style = focusTabTones[tone] || focusTabTones.all;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.34rem",
        border: active ? "1px solid #0f172a" : `1px solid ${style.border}`,
        background: active ? "#0f172a" : style.background,
        color: active ? "#ffffff" : style.text,
        borderRadius: "999px",
        padding: "0.3rem 0.54rem",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontSize: "0.64rem",
          fontWeight: 700,
          color: active ? "rgba(255,255,255,0.78)" : style.muted,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "0.76rem", fontWeight: 800 }}>
        {count}
      </span>
    </button>
  );
}

/**
 * Filters map poles by structural type (OTE vs distribution vs splitter), with an All option.
 */
export function PoleTypeFilterBar({ counts, poleTypeFilter, setPoleTypeFilter }) {
  return (
    <div style={barCardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.35rem",
          flexWrap: "nowrap",
          overflowX: "auto",
          scrollbarWidth: "thin",
        }}
      >
        <span
          style={{
            flexShrink: 0,
            padding: "0 0.1rem",
            fontSize: "0.62rem",
            fontWeight: 800,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Filter
        </span>
        <PoleTypeButton
          label="All"
          count={counts.total}
          tone="all"
          active={poleTypeFilter === "all"}
          onClick={() => setPoleTypeFilter("all")}
        />
        <PoleTypeButton
          label="OTE"
          count={counts.ote}
          tone="ote"
          active={poleTypeFilter === "ote"}
          onClick={() => setPoleTypeFilter("ote")}
        />
        <PoleTypeButton
          label="Distribution"
          count={counts.distribution}
          tone="distribution"
          active={poleTypeFilter === "distribution"}
          onClick={() => setPoleTypeFilter("distribution")}
        />
        <PoleTypeButton
          label="Splitters"
          count={counts.splitter}
          tone="splitter"
          active={poleTypeFilter === "splitter"}
          onClick={() => setPoleTypeFilter("splitter")}
        />
      </div>
    </div>
  );
}
