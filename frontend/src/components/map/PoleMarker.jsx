import { CircleMarker } from "react-leaflet";

const STATUS_COLORS = {
  PLANNED: "#185FA5",
  ACTIVE: "#15803d",
  DECOMMISSIONED: "#94a3b8",
};

export function PoleMarker({ pole, onClick }) {
  if (pole?.lat == null || pole?.lng == null) return null;
  const lat = parseFloat(pole.lat);
  const lng = parseFloat(pole.lng);
  if (isNaN(lat) || isNaN(lng)) return null;

  const status = pole?.status || "PLANNED";
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.PLANNED;

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={7}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2,
      }}
      eventHandlers={{ click: onClick }}
    />
  );
}
