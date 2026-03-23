/**
 * Coordinates that should be drawn on the map (excludes placeholder 0,0 from imports).
 */
export function hasRenderableCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}
