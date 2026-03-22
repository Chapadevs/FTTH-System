import { useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, TileLayer } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";
import { PoleMarker } from "./PoleMarker.jsx";
import { EquipmentMarker } from "./EquipmentMarker.jsx";
import { FiberPolyline } from "./FiberPolyline.jsx";
import { LayerControls } from "./LayerControls.jsx";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const defaultCenter = [
  parseFloat(import.meta.env.VITE_MAP_LAT || "39.246"),
  parseFloat(import.meta.env.VITE_MAP_LNG || "-82.478"),
];
const defaultZoom = parseInt(import.meta.env.VITE_MAP_ZOOM || "13", 10);

function PoleFocusButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
        background: active ? "#0f172a" : "#ffffff",
        color: active ? "#ffffff" : "#475569",
        borderRadius: "999px",
        padding: "0.35rem 0.7rem",
        fontSize: "0.74rem",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function WorkSummaryCard({ counts, poleFocus, setPoleFocus }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.95)",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "0.8rem 0.9rem",
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
        backdropFilter: "blur(10px)",
        minWidth: "280px",
      }}
    >
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Worker view
      </div>
      <div style={{ marginTop: "0.18rem", fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
        Show the poles that need action first
      </div>
      <div style={{ marginTop: "0.6rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.45rem" }}>
        <div style={{ padding: "0.55rem", borderRadius: "10px", background: "#fff7ed", border: "1px solid #fdba74" }}>
          <div style={{ fontSize: "0.68rem", color: "#9a3412" }}>Needs work</div>
          <div style={{ marginTop: "0.15rem", fontSize: "1rem", fontWeight: 700, color: "#c2410c" }}>{counts.needsWork}</div>
        </div>
        <div style={{ padding: "0.55rem", borderRadius: "10px", background: "#f0fdf4", border: "1px solid #86efac" }}>
          <div style={{ fontSize: "0.68rem", color: "#166534" }}>Connected</div>
          <div style={{ marginTop: "0.15rem", fontSize: "1rem", fontWeight: 700, color: "#15803d" }}>{counts.connected}</div>
        </div>
        <div style={{ padding: "0.55rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
          <div style={{ fontSize: "0.68rem", color: "#475569" }}>Dark only</div>
          <div style={{ marginTop: "0.15rem", fontSize: "1rem", fontWeight: 700, color: "#334155" }}>{counts.darkOnly}</div>
        </div>
      </div>
      <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
        <PoleFocusButton label="Needs work" active={poleFocus === "needs-work"} onClick={() => setPoleFocus("needs-work")} />
        <PoleFocusButton label="All poles" active={poleFocus === "all"} onClick={() => setPoleFocus("all")} />
        <PoleFocusButton label="Connected" active={poleFocus === "connected"} onClick={() => setPoleFocus("connected")} />
        <PoleFocusButton label="Dark only" active={poleFocus === "dark-only"} onClick={() => setPoleFocus("dark-only")} />
      </div>
    </div>
  );
}

function matchesPoleFocus(pole, poleFocus) {
  if (poleFocus === "needs-work") return (pole?.work?.taskCount || 0) > 0;
  if (poleFocus === "connected") return pole?.work?.status === "CONNECTED";
  if (poleFocus === "dark-only") return pole?.work?.status === "DARK_ONLY";
  return true;
}

function MapLayers({ onSelect, poles, equipment, segments, showPoles, showEquipment, showRoutes, poleFocus }) {
  const filteredPoles = poles.filter((pole) => matchesPoleFocus(pole, poleFocus));

  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {showRoutes &&
        segments.map((seg) => (
          <FiberPolyline
            key={seg.id}
            from={seg.fromPole}
            to={seg.toPole}
          />
        ))}
      {showPoles &&
        filteredPoles.map((pole) => (
          <PoleMarker
            key={pole.id}
            pole={pole}
            onClick={() => onSelect?.({ type: "pole", data: pole })}
          />
        ))}
      {showEquipment &&
        equipment.map((eq) => (
          <EquipmentMarker
            key={eq.id}
            equipment={eq}
            onClick={() => onSelect?.({ type: "equipment", data: eq })}
          />
        ))}
    </>
  );
}

export default function MapInner({ onSelect, projectIds }) {
  const [showPoles, setShowPoles] = useState(true);
  const [showEquipment, setShowEquipment] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [poleFocus, setPoleFocus] = useState("needs-work");
  const { data } = useQuery(
    trpc.map.getData.queryOptions({
      projectIds: projectIds?.length ? projectIds : undefined,
    })
  );

  const poles = data?.poles ?? [];
  const equipment = data?.equipment ?? [];
  const segments = data?.segments ?? [];
  const workCounts = poles.reduce(
    (acc, pole) => {
      if ((pole?.work?.taskCount || 0) > 0) acc.needsWork += 1;
      else if (pole?.work?.status === "CONNECTED") acc.connected += 1;
      else if (pole?.work?.status === "DARK_ONLY") acc.darkOnly += 1;
      else acc.noData += 1;
      return acc;
    },
    { needsWork: 0, connected: 0, darkOnly: 0, noData: 0 }
  );

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <MapLayers
          onSelect={onSelect}
          poles={poles}
          equipment={equipment}
          segments={segments}
          showPoles={showPoles}
          showEquipment={showEquipment}
          showRoutes={showRoutes}
          poleFocus={poleFocus}
        />
      </MapContainer>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
        }}
      >
        <WorkSummaryCard counts={workCounts} poleFocus={poleFocus} setPoleFocus={setPoleFocus} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "1rem",
          right: "1rem",
          zIndex: 1000,
        }}
      >
        <LayerControls
          showPoles={showPoles}
          setShowPoles={setShowPoles}
          showEquipment={showEquipment}
          setShowEquipment={setShowEquipment}
          showRoutes={showRoutes}
          setShowRoutes={setShowRoutes}
          poleFocus={poleFocus}
        />
      </div>
    </div>
  );
}
