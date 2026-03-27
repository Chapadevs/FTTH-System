import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "react-leaflet-markercluster/styles";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";
import { PoleMarker } from "./PoleMarker.jsx";
import { EquipmentMarker } from "./EquipmentMarker.jsx";
import { FiberPolyline } from "./FiberPolyline.jsx";
import { UserLocationMarker } from "./UserLocationMarker.jsx";
import { PoleDetailContent } from "../detail/DetailSheet.jsx";
import {
  buildDirectServedPoleLookup,
  buildPoleConnectionCountLookup,
  decorateMapPole,
  isSplitterPole,
} from "./distribution-pole.js";

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
const searchFocusZoom = Math.max(defaultZoom, 17);
const maxSearchResults = 7;
const geolocationOptions = {
  enableHighAccuracy: false,
  maximumAge: 120000,
  timeout: 30000,
};
const cachedGeolocationOptions = {
  enableHighAccuracy: false,
  maximumAge: Infinity,
  timeout: 10000,
};
const lastKnownLocationStorageKey = "fiberops-last-known-location";

const overlayCardStyle = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "0.7rem",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.1)",
  backdropFilter: "blur(12px)",
  width: "100%",
  boxSizing: "border-box",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hasRenderableLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return null;
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  if (distanceMeters >= 10000) return `${Math.round(distanceMeters / 1000)} km`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return null;
  if (durationSeconds < 60) return `${Math.max(1, Math.round(durationSeconds))} sec`;
  const roundedMinutes = Math.round(durationSeconds / 60);
  if (roundedMinutes < 60) return `${roundedMinutes} min`;
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function getBearingDegrees(fromLat, fromLng, toLat, toLng) {
  const fromLatRad = (fromLat * Math.PI) / 180;
  const toLatRad = (toLat * Math.PI) / 180;
  const deltaLngRad = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(deltaLngRad) * Math.cos(toLatRad);
  const x =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLngRad);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function getBearingLabel(bearingDegrees) {
  if (!Number.isFinite(bearingDegrees)) return null;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const directionIndex = Math.round(bearingDegrees / 45) % directions.length;
  return directions[directionIndex];
}

function getGeolocationErrorMessage(error) {
  switch (error?.code) {
    case 1:
      return "Location permission was denied. Enable it in your browser to guide yourself to poles.";
    case 2:
      return "Your location could not be determined right now. Move to an open area and try again.";
    case 3:
      return "Using the last known location while the browser keeps trying to update.";
    default:
      return "Live location is unavailable right now.";
  }
}

function readLastKnownLocation() {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(lastKnownLocationStorageKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    if (!hasRenderableLatLng(parsed?.lat, parsed?.lng)) return null;

    return {
      lat: Number(parsed.lat),
      lng: Number(parsed.lng),
      accuracy: Number.isFinite(parsed?.accuracy) ? parsed.accuracy : null,
      heading: Number.isFinite(parsed?.heading) ? parsed.heading : null,
      speed: Number.isFinite(parsed?.speed) ? parsed.speed : null,
      timestamp: Number.isFinite(parsed?.timestamp) ? parsed.timestamp : Date.now(),
      source: parsed?.source === "ip" ? "ip" : "gps",
    };
  } catch {
    return null;
  }
}

function storeLastKnownLocation(location) {
  if (typeof window === "undefined") return;
  if (!hasRenderableLatLng(location?.lat, location?.lng)) return;

  try {
    window.localStorage.setItem(lastKnownLocationStorageKey, JSON.stringify(location));
  } catch {
    // Ignore storage failures and keep the in-memory location instead.
  }
}

function toUserPosition(position, source = "gps") {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
    speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
    timestamp: position.timestamp,
    source,
  };
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function fetchApproximateLocation() {
  const response = await fetch("https://ipwho.is/");
  if (!response.ok) {
    throw new Error("Approximate location request failed.");
  }

  const payload = await response.json();
  const lat = Number(payload?.latitude);
  const lng = Number(payload?.longitude);
  if (!payload?.success || !hasRenderableLatLng(lat, lng)) {
    throw new Error("Approximate location was unavailable.");
  }

  return {
    lat,
    lng,
    accuracy: 25000,
    heading: null,
    speed: null,
    timestamp: Date.now(),
    source: "ip",
  };
}

/** One-time fit to all poles when the page loads and data arrives (matches backend map filter). */
function MapInitialFitController({ poles, focusTarget, projectFocusRequest }) {
  const map = useMap();
  const doneRef = useRef(false);
  const focusRef = useRef(focusTarget);
  const projectFocusRef = useRef(projectFocusRequest);
  focusRef.current = focusTarget;
  projectFocusRef.current = projectFocusRequest;

  useEffect(() => {
    if (doneRef.current) return;
    if (focusTarget || projectFocusRequest) {
      doneRef.current = true;
      return;
    }
    if (!poles?.length) return;

    const latLngs = [];
    for (const pole of poles) {
      const lat = parseFloat(pole.lat);
      const lng = parseFloat(pole.lng);
      if (hasRenderableLatLng(lat, lng)) latLngs.push(L.latLng(lat, lng));
    }
    if (latLngs.length === 0) {
      doneRef.current = true;
      return;
    }

    const bounds = L.latLngBounds(latLngs);
    let frameId = 0;
    let timeoutId = 0;

    const run = () => {
      if (doneRef.current) return;
      if (focusRef.current || projectFocusRef.current) {
        doneRef.current = true;
        return;
      }
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: false });
      doneRef.current = true;
    };

    frameId = requestAnimationFrame(() => {
      timeoutId = window.setTimeout(run, 50);
    });

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [poles, focusTarget, projectFocusRequest, map]);

  return null;
}

function matchesPoleTypeFilter(pole, poleTypeFilter) {
  if (poleTypeFilter === "all") return true;
  const isDistribution = pole?.distribution?.isDistribution;
  const isSplitter = !isDistribution && isSplitterPole(pole);
  if (poleTypeFilter === "distribution") return !!isDistribution;
  if (poleTypeFilter === "splitter") return isSplitter;
  if (poleTypeFilter === "ote") return !isDistribution && !isSplitter;
  return true;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function extractDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function uniqueValues(values) {
  const seen = new Set();

  return values.filter((value) => {
    const normalized = normalizeSearchText(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function getBestSearchMatch(values, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  const queryDigits = extractDigits(query);

  if (!query) return null;

  let bestMatch = null;

  for (const value of values) {
    const normalizedValue = normalizeSearchText(value);
    if (!normalizedValue) continue;

    const valueDigits = extractDigits(normalizedValue);
    const candidates = [];

    if (normalizedValue === query) {
      candidates.push({ score: 0, value });
    }

    if (queryDigits && valueDigits && valueDigits === queryDigits) {
      candidates.push({ score: 1, value });
    }

    if (queryDigits && valueDigits && valueDigits.endsWith(queryDigits)) {
      candidates.push({ score: 2, value });
    }

    if (normalizedValue.startsWith(query)) {
      candidates.push({ score: 3, value });
    }

    if (normalizedValue.includes(query)) {
      candidates.push({ score: 4, value });
    }

    if (queryDigits && valueDigits && valueDigits.includes(queryDigits)) {
      candidates.push({ score: 5, value });
    }

    for (const candidate of candidates) {
      if (
        !bestMatch ||
        candidate.score < bestMatch.score ||
        (candidate.score === bestMatch.score &&
          String(candidate.value || "").length < String(bestMatch.value || "").length)
      ) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}

function buildSearchEntries(poles) {
  return poles
    .map((pole) => {
      const lat = parseFloat(pole?.lat);
      const lng = parseFloat(pole?.lng);
      if (isNaN(lat) || isNaN(lng)) return null;

      return {
        id: `pole:${pole.id}`,
        label: pole.poleNumber || "Unnamed pole",
        subtitle: pole.streetName || null,
        pole,
        lat,
        lng,
        searchValues: uniqueValues([pole.poleNumber, pole.streetName]),
      };
    })
    .filter(Boolean);
}

function MapFocusController({ focusTarget, projectFocusRequest, onProjectFocusConsumed }) {
  const map = useMap();

  useEffect(() => {
    if (!projectFocusRequest) return;
    const corners = projectFocusRequest.fitBounds;
    const b = L.latLngBounds(corners[0], corners[1]);
    map.fitBounds(b, { padding: [36, 36], maxZoom: 17, animate: true });
    const done = () => {
      onProjectFocusConsumed?.();
    };
    map.once("moveend", done);
    return () => {
      map.off("moveend", done);
    };
  }, [projectFocusRequest, map, onProjectFocusConsumed]);

  useEffect(() => {
    if (projectFocusRequest) return;
    if (!focusTarget) return;

    map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom || searchFocusZoom, {
      duration: 0.8,
    });
  }, [focusTarget, projectFocusRequest, map]);

  return null;
}

function MapResizeController() {
  const map = useMap();

  useEffect(() => {
    const resize = () => map.invalidateSize();
    const container = map.getContainer();
    const observer = new ResizeObserver(resize);

    resize();
    const frameId = requestAnimationFrame(resize);
    const timeoutId = window.setTimeout(resize, 200);
    observer.observe(container);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [map]);

  return null;
}

function UserLocationFocusController({ userPosition, followUser, centerRequestToken }) {
  const map = useMap();
  const lastFollowPointRef = useRef(null);
  const lastCenterTokenRef = useRef(centerRequestToken);

  useEffect(() => {
    if (!followUser || !userPosition) return;
    const nextPoint = L.latLng(userPosition.lat, userPosition.lng);
    if (lastFollowPointRef.current?.distanceTo(nextPoint) < 4) return;
    lastFollowPointRef.current = nextPoint;
    map.panTo(nextPoint, { animate: true, duration: 0.5 });
  }, [followUser, map, userPosition]);

  useEffect(() => {
    if (!userPosition) return;
    if (centerRequestToken === lastCenterTokenRef.current) return;
    lastCenterTokenRef.current = centerRequestToken;
    map.flyTo([userPosition.lat, userPosition.lng], Math.max(map.getZoom(), 18), {
      duration: 0.7,
    });
  }, [centerRequestToken, map, userPosition]);

  return null;
}

function MapSearchCard({
  searchQuery,
  onSearchQueryChange,
  results,
  highlightedIndex,
  onHighlightChange,
  onSelectResult,
  onCloseResults,
}) {
  const hasQuery = searchQuery.trim().length > 0;

  function handleKeyDown(event) {
    if (!results.length) {
      if (event.key === "Escape") {
        onCloseResults();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onHighlightChange((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onHighlightChange((current) => (current - 1 + results.length) % results.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      onSelectResult(results[Math.max(highlightedIndex, 0)] || results[0]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCloseResults();
    }
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {hasQuery && (
        <div
          style={{
            ...overlayCardStyle,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "calc(100% + 0.5rem)",
            padding: "0.55rem",
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {results.length > 0 ? (
            results.map((result, index) => {
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={result.id}
                  type="button"
                  onMouseEnter={() => onHighlightChange(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelectResult(result);
                  }}
                  style={{
                    display: "grid",
                    gap: "0.28rem",
                    textAlign: "left",
                    padding: "0.7rem 0.75rem",
                    borderRadius: "12px",
                    border: isHighlighted ? "1px solid #0f172a" : "1px solid #e2e8f0",
                    background: isHighlighted ? "#f8fafc" : "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#0f172a" }}>
                      {result.label}
                    </span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>Pole</span>
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "#475569" }}>
                    {result.subtitle || "Map location available"}
                  </div>
                  {result.matchValue && result.matchValue !== result.label && (
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      Match: {result.matchValue}
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: "0.78rem",
                color: "#475569",
              }}
            >
              No visible-project poles matched this search.
            </div>
          )}
        </div>
      )}

      <div style={{ ...overlayCardStyle, padding: "0.6rem 0.7rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <span
            style={{
              flexShrink: 0,
              fontSize: "0.62rem",
              fontWeight: 800,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onFocus={() => {
              if (hasQuery) onHighlightChange(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a pole number"
            autoComplete="off"
            style={{
              flex: 1,
              minWidth: 0,
              padding: "0.48rem 0.62rem",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              outline: "none",
              fontSize: "0.8rem",
              color: "#0f172a",
              boxSizing: "border-box",
            }}
          />
          {hasQuery && (
            <button
              type="button"
              onClick={onCloseResults}
              style={{
                flexShrink: 0,
                border: "none",
                background: "#f8fafc",
                color: "#64748b",
                borderRadius: "999px",
                width: "1.7rem",
                height: "1.7rem",
                cursor: "pointer",
                fontSize: "0.82rem",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PolePopupPositionController({ selected, onPositionChange }) {
  const map = useMap();

  useEffect(() => {
    if (selected?.type !== "pole") {
      onPositionChange(null);
      return undefined;
    }

    const lat = parseFloat(selected?.data?.lat);
    const lng = parseFloat(selected?.data?.lng);
    if (isNaN(lat) || isNaN(lng)) {
      onPositionChange(null);
      return undefined;
    }

    const updatePosition = () => {
      const size = map.getSize();
      const point = map.latLngToContainerPoint([lat, lng]);
      const containerRect = map.getContainer().getBoundingClientRect();
      const viewportWidth = window.innerWidth || size.x;
      const viewportHeight = window.innerHeight || size.y;
      // Map popover should stay compact so it doesn't cover the map too much.
      const width = clamp(Math.min(240, size.x - 20, viewportWidth - 24), 190, 240);
      const placement = point.x < size.x * 0.56 ? "right" : "left";
      const left = placement === "right"
        ? clamp(point.x + 28, 12, size.x - width - 12)
        : clamp(point.x - width - 28, 12, size.x - width - 12);
      const top = clamp(point.y - 44, 60, Math.max(60, size.y - 180));
      const fixedLeft = clamp(containerRect.left + left, 8, Math.max(8, viewportWidth - width - 8));
      const fixedTop = clamp(containerRect.top + top, 72, Math.max(72, viewportHeight - 176));
      const maxHeight = Math.max(130, Math.min(size.y - top - 12, viewportHeight - fixedTop - 12));
      const pointerTop = clamp(containerRect.top + point.y - fixedTop, 18, Math.max(18, maxHeight - 18));

      onPositionChange({
        fixedLeft,
        fixedTop,
        width,
        maxHeight,
        placement,
        pointerTop,
        containerRect,
      });
    };

    updatePosition();
    map.on("move", updatePosition);
    map.on("zoom", updatePosition);
    map.on("resize", updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      map.off("move", updatePosition);
      map.off("zoom", updatePosition);
      map.off("resize", updatePosition);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [map, onPositionChange, selected]);

  return null;
}

function PoleDetailPopover({
  selected,
  position,
  onClose,
  onNavigateToPole,
  onFindRoute,
  onClearRoute,
  hasStreetRoute,
  isFindingRoute,
  canFindRoute,
  routeError,
  portalRoot,
}) {
  if (selected?.type !== "pole" || !position) return null;
  if (!portalRoot) return null;

  const isRight = position.placement === "right";
  const isDistribution = selected?.data?.distribution?.isDistribution;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: position.fixedLeft,
        top: position.fixedTop,
        width: position.width,
        maxWidth: "calc(100vw - 1rem)",
        maxHeight: position.maxHeight,
        background: "rgba(255,255,255,0.98)",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        boxShadow: "0 16px 32px rgba(15, 23, 42, 0.16)",
        backdropFilter: "blur(14px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 760,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: position.pointerTop,
          [isRight ? "left" : "right"]: "-8px",
          width: "16px",
          height: "16px",
          background: "rgba(255,255,255,0.98)",
          borderTop: "1px solid #e2e8f0",
          borderLeft: "1px solid #e2e8f0",
          transform: isRight ? "translateY(-50%) rotate(-45deg)" : "translateY(-50%) rotate(135deg)",
        }}
      />
      <div
        style={{
          padding: "0.45rem 0.6rem",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "0.64rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {isDistribution ? "Distribution" : "Pole"}
          </div>
          <div style={{ marginTop: "0.08rem", fontSize: "0.86rem", fontWeight: 800, color: "#0f172a" }}>
            {selected?.data?.poleNumber || "Pole detail"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "none",
            background: "#f8fafc",
            color: "#475569",
            borderRadius: "999px",
            width: "1.6rem",
            height: "1.6rem",
            cursor: "pointer",
            fontSize: "0.95rem",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: "0.5rem 0.6rem 0.6rem", overflow: "auto", minHeight: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.55rem" }}>
          <button
            type="button"
            onClick={onFindRoute}
            disabled={!canFindRoute || isFindingRoute}
            style={{
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#ffffff",
              borderRadius: "999px",
              padding: "0.38rem 0.55rem",
              fontSize: "0.68rem",
              fontWeight: 700,
              cursor: !canFindRoute || isFindingRoute ? "not-allowed" : "pointer",
              opacity: !canFindRoute || isFindingRoute ? 0.6 : 1,
            }}
          >
            {isFindingRoute ? "Finding route..." : hasStreetRoute ? "Recalculate route" : "Find routes"}
          </button>
          {hasStreetRoute && (
            <button
              type="button"
              onClick={onClearRoute}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                borderRadius: "999px",
                padding: "0.38rem 0.55rem",
                fontSize: "0.68rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear route
            </button>
          )}
        </div>
        {routeError && (
          <div style={{ marginBottom: "0.75rem", fontSize: "0.74rem", color: "#b91c1c", lineHeight: 1.4 }}>
            {routeError}
          </div>
        )}
        <PoleDetailContent data={selected.data} compact variant="mapPopover" onNavigateToPole={onNavigateToPole} />
      </div>
    </div>,
    portalRoot
  );
}

function LocationGuidanceCard({
  isTracking,
  permissionState,
  locationError,
  routeError,
  userPosition,
  selectedPole,
  guidanceMetrics,
  streetRoute,
  routeNeedsRefresh,
  onFindRoute,
  onClearRoute,
  isFindingRoute,
  followUser,
  onStartTracking,
  onStopTracking,
  onToggleFollowUser,
  onCenterOnUser,
}) {
  const hasPoleTarget = Boolean(selectedPole);
  const hasLocation = Boolean(userPosition);
  const hasStreetRoute = Boolean(streetRoute?.coordinates?.length);
  const actionButtonStyle = {
    borderRadius: "999px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0.32rem 0.55rem",
    fontSize: "0.72rem",
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1.1,
  };
  const mutedButtonStyle = {
    ...actionButtonStyle,
    color: "#94a3b8",
    cursor: "not-allowed",
  };
  const gpsButtonStyle = {
    ...actionButtonStyle,
    minWidth: "2.1rem",
    justifyContent: "center",
    padding: "0.32rem 0.45rem",
    background: "#0f172a",
    borderColor: "#0f172a",
    color: "#ffffff",
  };
  const shouldShowMetrics = Boolean(guidanceMetrics || hasStreetRoute || locationError || routeError || permissionState === "denied" || permissionState === "unsupported");

  return (
    <div style={{ ...overlayCardStyle, padding: "0.45rem 0.5rem", display: "grid", gap: "0.35rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <div>
          <div style={{ fontSize: "0.56rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Guide
          </div>
          {hasPoleTarget && (
            <div style={{ marginTop: "0.08rem", fontSize: "0.78rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
              {selectedPole.poleNumber || "Selected pole"}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "0.18rem 0.42rem",
            borderRadius: "999px",
            fontSize: "0.62rem",
            fontWeight: 800,
            color: isTracking ? "#166534" : "#475569",
            background: isTracking ? "#dcfce7" : "#f8fafc",
            border: `1px solid ${isTracking ? "#86efac" : "#e2e8f0"}`,
            whiteSpace: "nowrap",
          }}
        >
          {isTracking ? "Tracking on" : "Tracking off"}
        </div>
      </div>

      {shouldShowMetrics && (
        <div
          style={{
            display: "grid",
            gap: "0.24rem",
            padding: "0.42rem 0.48rem",
            borderRadius: "10px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
        {guidanceMetrics ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.68rem", color: "#475569" }}>Distance</span>
              <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#0f172a" }}>
                {guidanceMetrics.distanceLabel}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.68rem", color: "#475569" }}>Direction</span>
              <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#0f172a" }}>
                {guidanceMetrics.bearingLabel} ({Math.round(guidanceMetrics.bearingDegrees)}deg)
              </span>
            </div>
            {hasStreetRoute && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.68rem", color: "#475569" }}>Street route</span>
                  <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#0f172a" }}>
                    {streetRoute.distanceLabel || "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.68rem", color: "#475569" }}>ETA</span>
                  <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#0f172a" }}>
                    {streetRoute.durationLabel || "—"}
                  </span>
                </div>
                {streetRoute.nextInstruction && (
                  <div style={{ marginTop: "0.12rem", fontSize: "0.68rem", color: "#1e293b", lineHeight: 1.35 }}>
                    Next: {streetRoute.nextInstruction}
                  </div>
                )}
                {routeNeedsRefresh && (
                  <div style={{ fontSize: "0.66rem", color: "#92400e", lineHeight: 1.35 }}>
                    Your live position moved since the last route. Recalculate for the latest streets.
                  </div>
                )}
              </>
            )}
          </>
        ) : null}
        {hasLocation && Number.isFinite(userPosition.accuracy) && (
          <div style={{ fontSize: "0.64rem", color: "#64748b" }}>
            Accuracy: about {Math.round(userPosition.accuracy)} m
          </div>
        )}
        {permissionState === "denied" && (
          <div style={{ fontSize: "0.66rem", color: "#b91c1c", lineHeight: 1.35 }}>
            Browser location permission is currently denied.
          </div>
        )}
        {permissionState === "unsupported" && (
          <div style={{ fontSize: "0.66rem", color: "#b91c1c", lineHeight: 1.35 }}>
            This browser does not support geolocation.
          </div>
        )}
        {locationError && (
          <div style={{ fontSize: "0.66rem", color: "#b91c1c", lineHeight: 1.35 }}>
            {locationError}
          </div>
        )}
        {routeError && (
          <div style={{ fontSize: "0.66rem", color: "#b91c1c", lineHeight: 1.35 }}>
            {routeError}
          </div>
        )}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.28rem" }}>
        {isTracking ? (
          <button type="button" onClick={onStopTracking} style={gpsButtonStyle}>
            GPS
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartTracking}
            disabled={permissionState === "unsupported"}
            style={permissionState === "unsupported" ? { ...mutedButtonStyle, minWidth: "2.1rem", padding: "0.32rem 0.45rem" } : gpsButtonStyle}
          >
            GPS
          </button>
        )}
        <button
          type="button"
          onClick={onCenterOnUser}
          disabled={!hasLocation}
          style={!hasLocation ? mutedButtonStyle : actionButtonStyle}
        >
          Center
        </button>
        <button
          type="button"
          onClick={onToggleFollowUser}
          disabled={!isTracking}
          style={
            !isTracking
              ? mutedButtonStyle
              : followUser
                ? { ...actionButtonStyle, background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" }
                : actionButtonStyle
          }
        >
          {followUser ? "Following" : "Follow"}
        </button>
        {hasStreetRoute && (
          <button type="button" onClick={onClearRoute} style={actionButtonStyle}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

const StaticMapLayers = memo(function StaticMapLayers({
  onSelect,
  poles,
  equipment,
  segments,
  poleTypeFilter,
  selectedPoleId,
}) {
  const filteredPoles = poles.filter((pole) => matchesPoleTypeFilter(pole, poleTypeFilter));

  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {segments.map((seg) => (
        <FiberPolyline
          key={seg.id}
          from={seg.fromPole}
          to={seg.toPole}
        />
      ))}
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={44}
        disableClusteringAtZoom={searchFocusZoom}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
      >
        {filteredPoles.map((pole) => (
          <PoleMarker
            key={pole.id}
            pole={pole}
            isSelected={selectedPoleId === pole.id}
            onClick={() => onSelect?.({ type: "pole", data: pole })}
          />
        ))}
      </MarkerClusterGroup>
      {equipment.map((eq) => (
        <EquipmentMarker
          key={eq.id}
          equipment={eq}
          onClick={() => onSelect?.({ type: "equipment", data: eq })}
        />
      ))}
    </>
  );
});

const DynamicMapLayers = memo(function DynamicMapLayers({
  userPosition,
  guidanceTarget,
  streetRoutePositions,
}) {
  const guidancePositions =
    !streetRoutePositions && userPosition && guidanceTarget
      ? [
          [userPosition.lat, userPosition.lng],
          [guidanceTarget.lat, guidanceTarget.lng],
        ]
      : null;

  return (
    <>
      {streetRoutePositions && (
        <Polyline
          positions={streetRoutePositions}
          pathOptions={{
            color: "#1d4ed8",
            weight: 5,
            opacity: 0.9,
            lineCap: "round",
          }}
        />
      )}
      {guidancePositions && (
        <Polyline
          positions={guidancePositions}
          pathOptions={{
            color: "#2563eb",
            weight: 4,
            opacity: 0.9,
            dashArray: "10 8",
            lineCap: "round",
          }}
        />
      )}
      <UserLocationMarker location={userPosition} />
    </>
  );
});

export default function MapInner({
  onSelect,
  projectIds,
  selected,
  poleTypeFilter,
  setPoleTypeFilter,
  onPoleTypeCountsChange,
  projectFocusRequest,
  onProjectFocusConsumed,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [focusTarget, setFocusTarget] = useState(null);
  const [polePopupPosition, setPolePopupPosition] = useState(null);
  const [popoverPortalRoot, setPopoverPortalRoot] = useState(null);
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [locationPermission, setLocationPermission] = useState("prompt");
  const [locationError, setLocationError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [userPosition, setUserPosition] = useState(() => readLastKnownLocation());
  const [streetRoute, setStreetRoute] = useState(null);
  const [followUser, setFollowUser] = useState(true);
  const [centerOnUserRequestToken, setCenterOnUserRequestToken] = useState(0);
  const geolocationWatchIdRef = useRef(null);
  const userPositionRef = useRef(userPosition);

  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  useEffect(() => {
    setPopoverPortalRoot(document.getElementById("pole-map-popover-root"));
  }, []);

  const { data } = useQuery(
    trpc.map.getData.queryOptions({
      projectIds: projectIds?.length ? projectIds : undefined,
    })
  );

  const poles = data?.poles ?? [];
  const equipment = data?.equipment ?? [];
  const segments = data?.segments ?? [];
  const directServedPoleLookup = useMemo(
    () => buildDirectServedPoleLookup(poles, segments),
    [poles, segments]
  );
  const connectionCountLookup = useMemo(
    () => buildPoleConnectionCountLookup(poles, segments),
    [poles, segments]
  );
  const decoratedPoles = useMemo(
    () =>
      poles.map((pole) =>
        decorateMapPole(pole, directServedPoleLookup, connectionCountLookup)
      ),
    [poles, directServedPoleLookup, connectionCountLookup]
  );
  const selectedPoleId = selected?.type === "pole" ? selected?.data?.id : null;
  const selectedPoleTarget = useMemo(() => {
    if (selected?.type !== "pole") return null;
    const lat = parseFloat(selected?.data?.lat);
    const lng = parseFloat(selected?.data?.lng);
    if (!hasRenderableLatLng(lat, lng)) return null;
    return {
      id: selected.data.id,
      lat,
      lng,
      poleNumber: selected.data.poleNumber,
    };
  }, [selected]);
  const guidanceMetrics = useMemo(() => {
    if (!userPosition || !selectedPoleTarget) return null;
    const distanceMeters = L.latLng(userPosition.lat, userPosition.lng).distanceTo([
      selectedPoleTarget.lat,
      selectedPoleTarget.lng,
    ]);
    const bearingDegrees = getBearingDegrees(
      userPosition.lat,
      userPosition.lng,
      selectedPoleTarget.lat,
      selectedPoleTarget.lng
    );
    return {
      distanceMeters,
      distanceLabel: formatDistance(distanceMeters),
      bearingDegrees,
      bearingLabel: getBearingLabel(bearingDegrees),
    };
  }, [selectedPoleTarget, userPosition]);
  const activeStreetRoute = useMemo(() => {
    if (!selectedPoleId) return null;
    return streetRoute?.pole?.id === selectedPoleId ? streetRoute : null;
  }, [selectedPoleId, streetRoute]);
  const streetRoutePositions = useMemo(() => {
    if (!activeStreetRoute?.coordinates?.length) return null;
    const positions = activeStreetRoute.coordinates
      .map((point) => [Number(point?.lat), Number(point?.lng)])
      .filter(([lat, lng]) => hasRenderableLatLng(lat, lng));
    return positions.length >= 2 ? positions : null;
  }, [activeStreetRoute]);
  const routeOriginDistanceMeters = useMemo(() => {
    if (!userPosition || !activeStreetRoute?.origin) return null;
    return L.latLng(userPosition.lat, userPosition.lng).distanceTo([
      activeStreetRoute.origin.lat,
      activeStreetRoute.origin.lng,
    ]);
  }, [activeStreetRoute, userPosition]);
  const routeNeedsRefresh = Boolean(Number.isFinite(routeOriginDistanceMeters) && routeOriginDistanceMeters > 40);
  const streetRouteSummary = useMemo(() => {
    if (!activeStreetRoute) return null;
    return {
      distanceLabel: formatDistance(activeStreetRoute.distanceMeters),
      durationLabel: formatDuration(activeStreetRoute.durationSeconds),
      nextInstruction: activeStreetRoute.steps?.find((step) => step?.instruction)?.instruction || null,
    };
  }, [activeStreetRoute]);
  const streetRouteMutation = useMutation(
    trpc.map.streetRoute.mutationOptions({
      onSuccess: (result, variables) => {
        setRouteError("");
        setStreetRoute({
          ...result,
          origin: {
            lat: variables.origin.lat,
            lng: variables.origin.lng,
            timestamp: Date.now(),
          },
        });
      },
      onError: (error) => {
        setRouteError(error?.message || "Could not find a street route for this pole.");
      },
    })
  );

  const handleNavigateToPole = useCallback(
    (pole) => {
      if (!pole?.id) return;
      const lat = parseFloat(pole.lat);
      const lng = parseFloat(pole.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      const decorated = decoratedPoles.find((p) => p.id === pole.id);
      onSelect?.({ type: "pole", data: decorated ?? pole });
      setFocusTarget({
        id: `pole-nav:${pole.id}:${Date.now()}`,
        lat,
        lng,
        zoom: searchFocusZoom,
      });
    },
    [decoratedPoles, onSelect]
  );
  const handleFindRoute = useCallback(async () => {
    if (!selectedPoleTarget) return;
    if (!userPosition) {
      setRouteError("Start live location first to find a street route.");
      return;
    }

    setRouteError("");
    try {
      await streetRouteMutation.mutateAsync({
        poleId: selectedPoleTarget.id,
        origin: {
          lat: userPosition.lat,
          lng: userPosition.lng,
        },
      });
    } catch {
      // Error state is handled in the mutation callbacks.
    }
  }, [selectedPoleTarget, streetRouteMutation, userPosition]);
  const handleClearRoute = useCallback(() => {
    setStreetRoute(null);
    setRouteError("");
  }, []);
  const searchEntries = useMemo(() => buildSearchEntries(decoratedPoles), [decoratedPoles]);
  const rankedResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return [];

    return searchEntries
      .map((entry) => {
        const match = getBestSearchMatch(entry.searchValues, query);
        if (!match) return null;
        return { ...entry, matchScore: match.score, matchValue: match.value };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;
        if (a.label.length !== b.label.length) return a.label.length - b.label.length;

        const aPoleNumber = String(a.pole?.poleNumber || "");
        const bPoleNumber = String(b.pole?.poleNumber || "");
        return aPoleNumber.localeCompare(bPoleNumber);
      })
      .slice(0, maxSearchResults);
  }, [searchEntries, searchQuery]);
  const poleTypeCounts = useMemo(() => {
    const acc = { ote: 0, distribution: 0, splitter: 0, total: decoratedPoles.length };
    for (const pole of decoratedPoles) {
      const isDistribution = pole?.distribution?.isDistribution;
      const isSplitter = !isDistribution && isSplitterPole(pole);
      if (isDistribution) acc.distribution += 1;
      else if (isSplitter) acc.splitter += 1;
      else acc.ote += 1;
    }
    return acc;
  }, [decoratedPoles]);

  useEffect(() => {
    onPoleTypeCountsChange?.(poleTypeCounts);
  }, [poleTypeCounts, onPoleTypeCountsChange]);

  useEffect(() => {
    if (!selectedPoleId) {
      setStreetRoute(null);
      setRouteError("");
      return;
    }

    setStreetRoute((current) => (current?.pole?.id === selectedPoleId ? current : null));
    setRouteError("");
  }, [selectedPoleId]);

  useEffect(() => {
    if (!rankedResults.length) {
      setHighlightedIndex(0);
      return;
    }

    setHighlightedIndex((current) => Math.min(current, rankedResults.length - 1));
  }, [rankedResults]);

  useEffect(() => {
    let cleanup = () => {};
    if (!navigator.permissions?.query) return cleanup;

    let active = true;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permissionStatus) => {
        if (!active) return;
        setLocationPermission(permissionStatus.state);

        const handleChange = () => {
          setLocationPermission(permissionStatus.state);
        };

        if (typeof permissionStatus.addEventListener === "function") {
          permissionStatus.addEventListener("change", handleChange);
          cleanup = () => permissionStatus.removeEventListener("change", handleChange);
          return;
        }

        permissionStatus.onchange = handleChange;
        cleanup = () => {
          permissionStatus.onchange = null;
        };
      })
      .catch(() => {});

    return () => {
      active = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!isLocationTracking) {
      if (geolocationWatchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
        geolocationWatchIdRef.current = null;
      }
      return undefined;
    }

    if (!navigator.geolocation) {
      setLocationPermission("unsupported");
      setLocationError("This browser does not support geolocation.");
      setIsLocationTracking(false);
      return undefined;
    }

    let cancelled = false;
    setLocationError("");
    const seedBestEffortLocation = async () => {
      try {
        const cachedPosition = await getCurrentPositionAsync(cachedGeolocationOptions);
        if (cancelled) return;
        const nextPosition = toUserPosition(cachedPosition);
        setLocationPermission("granted");
        setLocationError("");
        setUserPosition(nextPosition);
        storeLastKnownLocation(nextPosition);
        return;
      } catch {
        // Fall through to a rough network estimate.
      }

      if (cancelled || userPositionRef.current) return;

      try {
        const approximateLocation = await fetchApproximateLocation();
        if (cancelled) return;
        setUserPosition((current) => current ?? approximateLocation);
        setLocationError("Showing an approximate network location until GPS becomes available.");
        storeLastKnownLocation(approximateLocation);
      } catch {
        // Ignore and let the GPS watch continue trying.
      }
    };

    seedBestEffortLocation();

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextPosition = toUserPosition(position);

        setLocationPermission("granted");
        setLocationError("");
        setUserPosition(nextPosition);
        storeLastKnownLocation(nextPosition);
      },
      (error) => {
        const currentPosition = userPositionRef.current;
        const hasKnownPosition = Boolean(
          currentPosition && hasRenderableLatLng(currentPosition.lat, currentPosition.lng)
        );
        setLocationError(
          error?.code === 3 && hasKnownPosition
            ? "Showing your last known location while the browser keeps trying to refresh it."
            : getGeolocationErrorMessage(error)
        );
        if (error?.code === 1) {
          setLocationPermission("denied");
          setIsLocationTracking(false);
        }
      },
      geolocationOptions
    );

    geolocationWatchIdRef.current = watchId;

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      if (geolocationWatchIdRef.current === watchId) {
        geolocationWatchIdRef.current = null;
      }
    };
  }, [isLocationTracking]);

  const handleStartLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationPermission("unsupported");
      setLocationError("This browser does not support geolocation.");
      return;
    }
    setLocationError("");
    setFollowUser(true);
    setIsLocationTracking(true);
  }, []);

  const handleStopLocationTracking = useCallback(() => {
    setIsLocationTracking(false);
    setFollowUser(false);
  }, []);

  const handleCenterOnUser = useCallback(() => {
    if (!userPosition) return;
    setCenterOnUserRequestToken((value) => value + 1);
  }, [userPosition]);

  function handleSelectResult(result) {
    if (!result?.pole) return;

    setSearchQuery(result.label);
    setHighlightedIndex(0);
    setPoleTypeFilter("all");

    setFocusTarget({
      id: `${result.id}:${Date.now()}`,
      lat: result.lat,
      lng: result.lng,
      zoom: searchFocusZoom,
    });
    onSelect?.({ type: "pole", data: result.pole });
  }

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <MapResizeController />
        <MapInitialFitController
          poles={decoratedPoles}
          focusTarget={focusTarget}
          projectFocusRequest={projectFocusRequest}
        />
        <MapFocusController
          focusTarget={focusTarget}
          projectFocusRequest={projectFocusRequest}
          onProjectFocusConsumed={onProjectFocusConsumed}
        />
        <UserLocationFocusController
          userPosition={userPosition}
          followUser={followUser}
          centerRequestToken={centerOnUserRequestToken}
        />
        <PolePopupPositionController selected={selected} onPositionChange={setPolePopupPosition} />
        <StaticMapLayers
          onSelect={onSelect}
          poles={decoratedPoles}
          equipment={equipment}
          segments={segments}
          poleTypeFilter={poleTypeFilter}
          selectedPoleId={selectedPoleId}
        />
        <DynamicMapLayers
          userPosition={userPosition}
          guidanceTarget={isLocationTracking ? selectedPoleTarget : null}
          streetRoutePositions={streetRoutePositions}
        />
      </MapContainer>
      <div
        style={{
          position: "absolute",
          bottom: "3rem",
          right: "0.75rem",
          width: "min(220px, calc(100% - 1.5rem))",
          zIndex: 705,
        }}
      >
        <LocationGuidanceCard
          isTracking={isLocationTracking}
          permissionState={locationPermission}
          locationError={locationError}
          routeError={routeError}
          userPosition={userPosition}
          selectedPole={selectedPoleTarget}
          guidanceMetrics={guidanceMetrics}
          streetRoute={streetRouteSummary}
          routeNeedsRefresh={routeNeedsRefresh}
          onFindRoute={handleFindRoute}
          onClearRoute={handleClearRoute}
          isFindingRoute={streetRouteMutation.isPending}
          followUser={followUser}
          onStartTracking={handleStartLocationTracking}
          onStopTracking={handleStopLocationTracking}
          onToggleFollowUser={() => setFollowUser((current) => !current)}
          onCenterOnUser={handleCenterOnUser}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "1rem",
          transform: "translateX(-50%)",
          width: "min(460px, calc(100% - 24rem))",
          zIndex: 710,
        }}
      >
        <MapSearchCard
          searchQuery={searchQuery}
          onSearchQueryChange={(value) => {
            setSearchQuery(value);
            setHighlightedIndex(0);
          }}
          results={rankedResults}
          highlightedIndex={highlightedIndex}
          onHighlightChange={setHighlightedIndex}
          onSelectResult={handleSelectResult}
          onCloseResults={() => {
            setSearchQuery("");
            setHighlightedIndex(0);
          }}
        />
      </div>
      <PoleDetailPopover
        selected={selected}
        position={polePopupPosition}
        onClose={() => onSelect?.(null)}
        onNavigateToPole={handleNavigateToPole}
        onFindRoute={handleFindRoute}
        onClearRoute={handleClearRoute}
        hasStreetRoute={Boolean(streetRoutePositions)}
        isFindingRoute={streetRouteMutation.isPending}
        canFindRoute={Boolean(userPosition)}
        routeError={routeError}
        portalRoot={popoverPortalRoot}
      />
    </div>
  );
}
