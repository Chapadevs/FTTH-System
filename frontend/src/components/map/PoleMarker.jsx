import L from "leaflet";
import { Marker, Tooltip } from "react-leaflet";

const WORK_STYLES = {
  NEEDS_WORK: {
    fill: "#f97316",
    border: "#c2410c",
    halo: "rgba(249, 115, 22, 0.25)",
    label: "Needs work",
  },
  CONNECTED: {
    fill: "#22c55e",
    border: "#15803d",
    halo: "rgba(34, 197, 94, 0.18)",
    label: "Connected",
  },
  DARK_ONLY: {
    fill: "#94a3b8",
    border: "#64748b",
    halo: "rgba(148, 163, 184, 0.18)",
    label: "Dark only",
  },
  NO_DATA: {
    fill: "#60a5fa",
    border: "#2563eb",
    halo: "rgba(96, 165, 250, 0.18)",
    label: "No fiber data",
  },
};

function createPoleIcon(pole) {
  const workStatus = pole?.work?.status || "NO_DATA";
  const style = WORK_STYLES[workStatus] || WORK_STYLES.NO_DATA;
  const taskCount = pole?.work?.taskCount || 0;
  const size = taskCount > 0 ? 28 : 20;
  const badgeSize = taskCount > 9 ? 22 : 18;
  const iconSize = size + 16;

  return L.divIcon({
    className: "",
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    html: `
      <div style="position: relative; width: ${iconSize}px; height: ${iconSize}px; display: flex; align-items: center; justify-content: center;">
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 999px;
          background: ${style.fill};
          border: 3px solid ${style.border};
          box-shadow: 0 0 0 7px ${style.halo};
        "></div>
        ${
          taskCount > 0
            ? `<div style="
                position: absolute;
                top: -1px;
                right: -1px;
                min-width: ${badgeSize}px;
                height: ${badgeSize}px;
                padding: 0 4px;
                border-radius: 999px;
                background: #7f1d1d;
                border: 2px solid white;
                color: white;
                font-size: 11px;
                font-weight: 700;
                line-height: ${badgeSize - 4}px;
                text-align: center;
                box-sizing: border-box;
              ">${taskCount}</div>`
            : ""
        }
      </div>
    `,
  });
}

export function PoleMarker({ pole, onClick }) {
  if (pole?.lat == null || pole?.lng == null) return null;
  const lat = parseFloat(pole.lat);
  const lng = parseFloat(pole.lng);
  if (isNaN(lat) || isNaN(lng)) return null;

  const workStatus = pole?.work?.status || "NO_DATA";
  const style = WORK_STYLES[workStatus] || WORK_STYLES.NO_DATA;
  const taskCount = pole?.work?.taskCount || 0;

  return (
    <Marker
      position={[lat, lng]}
      icon={createPoleIcon(pole)}
      eventHandlers={{ click: onClick }}
    >
      <Tooltip direction="top" offset={[0, -18]}>
        <div style={{ minWidth: "170px" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0f172a" }}>{pole.poleNumber}</div>
          <div style={{ marginTop: "0.2rem", fontSize: "0.74rem", color: "#475569" }}>{style.label}</div>
          <div style={{ marginTop: "0.3rem", fontSize: "0.74rem", color: "#334155" }}>
            {taskCount > 0
              ? `${taskCount} task${taskCount > 1 ? "s" : ""} waiting at this pole`
              : pole?.summary?.activeCount > 0
                ? `${pole.summary.activeCount} active fiber${pole.summary.activeCount > 1 ? "s" : ""}`
                : "No pending fiber tasks"}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}
