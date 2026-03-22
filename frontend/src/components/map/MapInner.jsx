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

function MapLayers({ onSelect, projectIds, showPoles, showEquipment, showRoutes }) {
  const { data } = useQuery(
    trpc.map.getData.queryOptions({
      projectIds: projectIds?.length ? projectIds : undefined,
    })
  );

  const poles = data?.poles ?? [];
  const equipment = data?.equipment ?? [];
  const segments = data?.segments ?? [];

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
        poles.map((pole) => (
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
          projectIds={projectIds}
          showPoles={showPoles}
          showEquipment={showEquipment}
          showRoutes={showRoutes}
        />
      </MapContainer>
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
        />
      </div>
    </div>
  );
}
