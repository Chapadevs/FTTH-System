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

function getPoleMarkerMeta(pole) {
  const isDistribution = pole?.distribution?.isDistribution;
  const directServedPoleCount = pole?.distribution?.directServedPoleCount || 0;
  const taskCount = pole?.work?.taskCount || 0;

  if (isDistribution) {
    return {
      isDistribution,
      badgeCount: directServedPoleCount,
      label: "Distribution pole",
      detail: directServedPoleCount > 0
        ? `Sending signal directly to ${directServedPoleCount} pole${directServedPoleCount === 1 ? "" : "s"}`
        : "No direct served poles found",
    };
  }

  return {
    isDistribution,
    badgeCount: taskCount,
    label: null,
    detail: taskCount > 0
      ? `${taskCount} task${taskCount > 1 ? "s" : ""} waiting at this pole`
      : pole?.summary?.activeCount > 0
        ? `${pole.summary.activeCount} active fiber${pole.summary.activeCount > 1 ? "s" : ""}`
        : "No pending fiber tasks",
  };
}

function createPoleIcon(pole, isSelected = false) {
  const workStatus = pole?.work?.status || "NO_DATA";
  const style = WORK_STYLES[workStatus] || WORK_STYLES.NO_DATA;
  const markerMeta = getPoleMarkerMeta(pole);
  const badgeCount = markerMeta.badgeCount;
  const size = badgeCount > 0 ? 28 : 20;
  const markerSize = isSelected ? size + 8 : size;
  const badgeSize = badgeCount > 9 ? 22 : 18;
  const iconSize = markerSize + (isSelected ? 24 : 16);
  const halo = isSelected ? "rgba(15, 23, 42, 0.22)" : style.halo;
  const outline = isSelected ? "#f8fafc" : style.border;
  const glow = isSelected ? "0 0 0 9px rgba(250, 204, 21, 0.45), 0 0 22px rgba(15, 23, 42, 0.28)" : `0 0 0 7px ${halo}`;

  return L.divIcon({
    className: "",
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    html: `
      <div style="position: relative; width: ${iconSize}px; height: ${iconSize}px; display: flex; align-items: center; justify-content: center;">
        <div style="
          width: ${markerSize}px;
          height: ${markerSize}px;
          border-radius: 999px;
          background: ${style.fill};
          border: ${isSelected ? 4 : 3}px solid ${outline};
          box-shadow: ${glow};
          transform: ${isSelected ? "scale(1.05)" : "scale(1)"};
        "></div>
        ${
          badgeCount > 0
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
              ">${badgeCount}</div>`
            : ""
        }
      </div>
    `,
  });
}

export function PoleMarker({ pole, onClick, isSelected = false }) {
  if (pole?.lat == null || pole?.lng == null) return null;
  const lat = parseFloat(pole.lat);
  const lng = parseFloat(pole.lng);
  if (isNaN(lat) || isNaN(lng)) return null;

  const workStatus = pole?.work?.status || "NO_DATA";
  const style = WORK_STYLES[workStatus] || WORK_STYLES.NO_DATA;
  const markerMeta = getPoleMarkerMeta(pole);

  return (
    <Marker
      position={[lat, lng]}
      icon={createPoleIcon(pole, isSelected)}
      zIndexOffset={isSelected ? 1000 : 0}
      eventHandlers={{ click: onClick }}
    >
      <Tooltip direction="top" offset={[0, -18]}>
        <div style={{ minWidth: "170px" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0f172a" }}>{pole.poleNumber}</div>
          <div style={{ marginTop: "0.2rem", fontSize: "0.74rem", color: "#475569" }}>{markerMeta.label || style.label}</div>
          <div style={{ marginTop: "0.3rem", fontSize: "0.74rem", color: "#334155" }}>
            {markerMeta.detail}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}
