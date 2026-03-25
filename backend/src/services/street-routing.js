const DEFAULT_ROUTING_BASE_URL = "https://router.project-osrm.org";
const DEFAULT_ROUTING_PROFILE = "driving";
const ROUTING_USER_AGENT = "FiberOps/1.0 (Street routing)";

function hasRouteCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_ROUTING_BASE_URL).replace(/\/+$/, "");
}

function buildInstruction(step) {
  const maneuver = step?.maneuver || {};
  const type = maneuver.type || "continue";
  const modifier = maneuver.modifier || "";
  const roadName = step?.name ? ` onto ${step.name}` : "";

  if (type === "depart") return `Start${roadName}`;
  if (type === "arrive") return "Arrive at the pole";
  if (type === "roundabout") {
    const exit = maneuver.exit ? ` and take exit ${maneuver.exit}` : "";
    return `Enter the roundabout${exit}${roadName}`;
  }
  if (type === "turn") {
    return `Turn ${modifier || "ahead"}${roadName}`;
  }
  if (type === "fork") {
    return `Keep ${modifier || "ahead"}${roadName}`;
  }
  if (type === "end of road") {
    return `At the end of the road, turn ${modifier || "ahead"}${roadName}`;
  }
  if (type === "new name") {
    return `Continue${roadName}`;
  }
  if (type === "merge") {
    return `Merge ${modifier || "ahead"}${roadName}`;
  }
  if (type === "notification") {
    return step?.name ? `Continue on ${step.name}` : "Continue";
  }
  return modifier ? `Continue ${modifier}${roadName}` : `Continue${roadName}`;
}

export async function getStreetRoute({ origin, destination, profile = DEFAULT_ROUTING_PROFILE }) {
  const originLat = Number(origin?.lat);
  const originLng = Number(origin?.lng);
  const destinationLat = Number(destination?.lat);
  const destinationLng = Number(destination?.lng);

  if (!hasRouteCoordinates(originLat, originLng) || !hasRouteCoordinates(destinationLat, destinationLng)) {
    throw new Error("Street routing requires valid origin and destination coordinates.");
  }

  const baseUrl = normalizeBaseUrl(process.env.ROUTING_BASE_URL);
  const routeUrl = new URL(
    `/route/v1/${encodeURIComponent(profile)}/${originLng},${originLat};${destinationLng},${destinationLat}`,
    `${baseUrl}/`
  );
  routeUrl.searchParams.set("alternatives", "false");
  routeUrl.searchParams.set("overview", "full");
  routeUrl.searchParams.set("steps", "true");
  routeUrl.searchParams.set("geometries", "geojson");

  const response = await fetch(routeUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": ROUTING_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Street routing request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;

  if (!route || !Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("No street route was found for this pole.");
  }

  const legs = Array.isArray(route.legs) ? route.legs : [];
  const steps = legs.flatMap((leg) =>
    Array.isArray(leg?.steps)
      ? leg.steps.map((step, index) => ({
          id: `${leg.summary || "leg"}:${index}`,
          instruction: buildInstruction(step),
          distanceMeters: Number(step?.distance) || 0,
          durationSeconds: Number(step?.duration) || 0,
          name: step?.name || null,
          mode: step?.mode || profile,
        }))
      : []
  );

  return {
    provider: "osrm",
    profile,
    distanceMeters: Number(route.distance) || 0,
    durationSeconds: Number(route.duration) || 0,
    coordinates: coordinates
      .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
      .filter((point) => hasRouteCoordinates(point.lat, point.lng)),
    steps,
  };
}
