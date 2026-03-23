import L from "leaflet";
import { Marker, Tooltip } from "react-leaflet";
import { isSplitterPole } from "./distribution-pole.js";

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

const DISTRIBUTION_STYLE = {
  fill: "#f97316",
  border: "#c2410c",
  halo: "rgba(249, 115, 22, 0.25)",
};

/** Regular poles / OTE / terminal (non-distribution, non-splitter). */
const REGULAR_POLE_STYLE = {
  fill: "#3b82f6",
  border: "#1d4ed8",
  halo: "rgba(59, 130, 246, 0.22)",
};

const SPLITTER_STYLE = {
  fill: "#a855f7",
  border: "#7e22ce",
  halo: "rgba(168, 85, 247, 0.22)",
};

function getPoleMarkerMeta(pole) {
  const isDistribution = pole?.distribution?.isDistribution;
  const isSplitter = !isDistribution && isSplitterPole(pole);
  const directServedPoleCount = pole?.distribution?.directServedPoleCount || 0;
  const connectionCount = pole?.summary?.connectedPoleCount || 0;
  const isEndPole = !isDistribution && !isSplitter && connectionCount <= 1;
  const taskCount = pole?.work?.taskCount || 0;

  if (isDistribution) {
    return {
      isDistribution,
      isSplitter,
      badgeCount: directServedPoleCount,
      label: "Distribution pole",
      detail: directServedPoleCount > 0
        ? `Sending signal directly to ${directServedPoleCount} pole${directServedPoleCount === 1 ? "" : "s"}`
        : "No direct served poles found",
    };
  }

  return {
    isDistribution,
    isSplitter,
    isEndPole,
    badgeCount: taskCount,
    label: isSplitter ? "Splitter pole" : isEndPole ? "End pole" : null,
    detail: taskCount > 0
      ? `${taskCount} task${taskCount > 1 ? "s" : ""} waiting at this pole`
      : pole?.summary?.activeCount > 0
        ? `${pole.summary.activeCount} active fiber${pole.summary.activeCount > 1 ? "s" : ""}`
        : "No pending fiber tasks",
  };
}

function buildTrianglePoints(size, inset = 0) {
  const halfSize = size / 2;
  const topY = inset;
  const bottomY = size - inset;
  const horizontalInset = inset;

  return [
    `${halfSize},${topY}`,
    `${size - horizontalInset},${bottomY}`,
    `${horizontalInset},${bottomY}`,
  ].join(" ");
}

function getPoleBadgeText(pole) {
  const poleNumber = String(pole?.poleNumber || "").trim();
  const trailingDigits = poleNumber.match(/(\d+)$/);

  if (!trailingDigits?.[1]) return null;

  return trailingDigits[1].slice(-3);
}

function createPoleIcon(pole, isSelected = false) {
  const markerMeta = getPoleMarkerMeta(pole);
  const markerStyle = markerMeta.isDistribution
    ? DISTRIBUTION_STYLE
    : markerMeta.isSplitter
      ? SPLITTER_STYLE
      : REGULAR_POLE_STYLE;
  const badgeText = getPoleBadgeText(pole);
  const hasBadge = Boolean(badgeText);
  const size = hasBadge ? 24 : 16;
  const markerSize = isSelected ? size + 6 : size;
  const badgeSize = badgeText?.length > 3 ? 24 : badgeText?.length > 2 ? 22 : 18;
  const iconSize = markerSize + (isSelected ? 20 : 12);
  const halo = isSelected ? "rgba(15, 23, 42, 0.22)" : markerStyle.halo;
  const outline = isSelected ? "#f8fafc" : markerStyle.border;
  const glow = isSelected ? "0 0 0 9px rgba(250, 204, 21, 0.45), 0 0 22px rgba(15, 23, 42, 0.28)" : `0 0 0 7px ${halo}`;
  const fill = markerStyle.fill;
  const triangleStroke = isSelected ? 6 : 4;
  const triangleInset = isSelected ? 3 : 2;
  const markerHtml = markerMeta.isSplitter
    ? `
        <svg width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}" style="overflow: visible; transform: ${isSelected ? "scale(1.05)" : "scale(1)"};">
          <polygon
            points="${buildTrianglePoints(markerSize)}"
            fill="none"
            stroke="${isSelected ? "rgba(250, 204, 21, 0.55)" : halo}"
            stroke-width="${isSelected ? 10 : 7}"
            stroke-linejoin="round"
          />
          ${
            isSelected
              ? `<polygon
                  points="${buildTrianglePoints(markerSize)}"
                  fill="none"
                  stroke="rgba(15, 23, 42, 0.28)"
                  stroke-width="13"
                  stroke-linejoin="round"
                />`
              : ""
          }
          <polygon
            points="${buildTrianglePoints(markerSize)}"
            fill="${fill}"
            stroke="${outline}"
            stroke-width="${triangleStroke}"
            stroke-linejoin="round"
          />
          <polygon
            points="${buildTrianglePoints(markerSize, triangleInset)}"
            fill="${fill}"
            stroke="none"
          />
        </svg>
      `
    : `
        <div style="
          width: ${markerSize}px;
          height: ${markerSize}px;
          border-radius: ${markerMeta.isDistribution ? "6px" : "999px"};
          background: ${fill};
          border: ${isSelected ? 4 : 3}px solid ${outline};
          box-shadow: ${glow};
          transform: ${isSelected ? "scale(1.05)" : "scale(1)"};
        "></div>
      `;

  return L.divIcon({
    className: "",
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    html: `
      <div style="position: relative; width: ${iconSize}px; height: ${iconSize}px; display: flex; align-items: center; justify-content: center;">
        ${markerHtml}
        ${
          hasBadge
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
              ">${badgeText}</div>`
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
