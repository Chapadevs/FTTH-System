import { CircleMarker } from "react-leaflet";

export function EquipmentMarker({ equipment, onClick }) {
  const pole = equipment?.pole;
  if (pole?.lat == null || pole?.lng == null) return null;
  const lat = parseFloat(pole.lat);
  const lng = parseFloat(pole.lng);
  if (isNaN(lat) || isNaN(lng)) return null;

  const isSplitter = equipment?.equipType === "SPLITTER";
  const color = isSplitter ? "#BA7517" : "#993C1D";

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={8}
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
