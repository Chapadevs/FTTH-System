const GEOCODE_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "FiberOps/1.0 (Cursor local dev)";
const streetCache = new Map();
const activeProjectEnrichments = new Set();

let nextRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundedCoordinateKey(lat, lng) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function hasGeocodableCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}

export function pickStreetName(payload) {
  const address = payload?.address || {};
  return (
    address.road ||
    address.pedestrian ||
    address.footway ||
    address.path ||
    address.neighbourhood ||
    address.suburb ||
    address.hamlet ||
    address.village ||
    address.town ||
    address.city ||
    payload?.name ||
    payload?.display_name?.split(",")?.[0]?.trim() ||
    null
  );
}

async function rateLimitedFetch(url, options) {
  const waitMs = Math.max(0, nextRequestAt - Date.now());
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  nextRequestAt = Date.now() + 1100;
  return fetch(url, options);
}

export async function reverseGeocodeStreetName(lat, lng) {
  if (!hasGeocodableCoordinates(lat, lng)) return null;

  const cacheKey = roundedCoordinateKey(lat, lng);
  if (streetCache.has(cacheKey)) {
    return streetCache.get(cacheKey);
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const response = await rateLimitedFetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const streetName = pickStreetName(payload);
  if (streetName) {
    streetCache.set(cacheKey, streetName);
  }
  return streetName;
}

export async function ensurePoleStreetName(prismaClient, pole) {
  if (!pole || pole.streetName) return pole?.streetName || null;
  if (!hasGeocodableCoordinates(pole.lat, pole.lng)) return null;

  try {
    const streetName = await reverseGeocodeStreetName(pole.lat, pole.lng);
    if (!streetName) return null;

    await prismaClient.pole.update({
      where: { id: pole.id },
      data: { streetName },
    });
    return streetName;
  } catch (error) {
    console.warn("Reverse geocoding failed for pole", pole?.poleNumber, error?.message || error);
    return null;
  }
}

export async function enrichProjectPoleStreetNames(prismaClient, projectId) {
  if (!projectId || activeProjectEnrichments.has(projectId)) return;
  activeProjectEnrichments.add(projectId);

  try {
    const poles = await prismaClient.pole.findMany({
      where: {
        projectId,
        streetName: null,
      },
      select: {
        id: true,
        poleNumber: true,
        lat: true,
        lng: true,
        streetName: true,
      },
    });

    for (const pole of poles) {
      if (!hasGeocodableCoordinates(pole.lat, pole.lng)) continue;
      await ensurePoleStreetName(prismaClient, pole);
    }
  } finally {
    activeProjectEnrichments.delete(projectId);
  }
}
