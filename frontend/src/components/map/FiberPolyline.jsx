import { Polyline } from "react-leaflet";

export function FiberPolyline({ from, to }) {
  if (from?.lat == null || from?.lng == null || to?.lat == null || to?.lng == null)
    return null;
  const positions = [
    [parseFloat(from.lat), parseFloat(from.lng)],
    [parseFloat(to.lat), parseFloat(to.lng)],
  ];
  return (
    <Polyline
      positions={positions}
      pathOptions={{ color: "#1D9E75", weight: 2 }}
    />
  );
}
