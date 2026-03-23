import L from "leaflet";
import { Circle, Marker, Tooltip } from "react-leaflet";

const userLocationIcon = L.divIcon({
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: `
    <div style="
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: #2563eb;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 7px rgba(37, 99, 235, 0.18), 0 8px 18px rgba(15, 23, 42, 0.18);
    "></div>
  `,
});

export function UserLocationMarker({ location }) {
  const lat = parseFloat(location?.lat);
  const lng = parseFloat(location?.lng);
  const accuracy = Number.isFinite(location?.accuracy) ? location.accuracy : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return (
    <>
      {accuracy && accuracy > 0 && (
        <Circle
          center={[lat, lng]}
          radius={accuracy}
          pathOptions={{
            color: "#60a5fa",
            weight: 1.5,
            fillColor: "#93c5fd",
            fillOpacity: 0.18,
          }}
        />
      )}
      <Marker position={[lat, lng]} icon={userLocationIcon} zIndexOffset={900}>
        <Tooltip direction="top" offset={[0, -12]}>
          <div style={{ minWidth: "120px" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0f172a" }}>
              You are here
            </div>
            {accuracy && (
              <div style={{ marginTop: "0.2rem", fontSize: "0.74rem", color: "#475569" }}>
                Accuracy about {Math.round(accuracy)} m
              </div>
            )}
          </div>
        </Tooltip>
      </Marker>
    </>
  );
}
