import { CircleMarker } from "react-leaflet";

export function PoleMarker({ pole, onClick }) {
  if (pole?.lat == null || pole?.lng == null) return null;
  const lat = parseFloat(pole.lat);
  const lng = parseFloat(pole.lng);
  if (isNaN(lat) || isNaN(lng)) return null;

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={7}
      pathOptions={{
        color: "#185FA5",
        fillColor: "#185FA5",
        fillOpacity: 0.8,
        weight: 2,
      }}
      eventHandlers={{ click: onClick }}
    />
  );
}
