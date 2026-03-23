import L from "leaflet";
import { Marker } from "react-leaflet";

const SPLITTER_ICON = L.divIcon({
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 8],
  html: `
    <div style="
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 10px solid #0EA5E9;
      filter: drop-shadow(0 0 2px rgba(14, 165, 233, 0.45));
    "></div>
  `,
});

const DEFAULT_EQUIPMENT_ICON = L.divIcon({
  className: "",
  iconSize: [8, 8],
  iconAnchor: [4, 4],
  html: `
    <div style="
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #9A3412;
      border: 1px solid rgba(255,255,255,0.8);
      box-shadow: 0 0 0 1px rgba(154, 52, 18, 0.25);
    "></div>
  `,
});

export function EquipmentMarker({ equipment, onClick }) {
  const pole = equipment?.pole;
  if (pole?.lat == null || pole?.lng == null) return null;
  const lat = parseFloat(pole.lat);
  const lng = parseFloat(pole.lng);
  if (isNaN(lat) || isNaN(lng)) return null;

  const isSplitter = equipment?.equipType === "SPLITTER";

  return (
    <Marker
      position={[lat, lng]}
      icon={isSplitter ? SPLITTER_ICON : DEFAULT_EQUIPMENT_ICON}
      zIndexOffset={isSplitter ? 450 : 300}
      eventHandlers={{ click: onClick }}
    />
  );
}
