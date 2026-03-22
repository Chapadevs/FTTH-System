import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";
import { PoleMarker } from "./PoleMarker.jsx";
import { EquipmentMarker } from "./EquipmentMarker.jsx";
import { FiberPolyline } from "./FiberPolyline.jsx";
import { LayerControls } from "./LayerControls.jsx";
import { PoleDetailContent } from "../detail/DetailSheet.jsx";
import { buildDirectServedPoleLookup, decorateMapPole } from "./distribution-pole.js";

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

const focusTabTones = {
  "needs-work": {
    background: "#fff7ed",
    border: "#fdba74",
    text: "#c2410c",
    muted: "#9a3412",
  },
  connected: {
    background: "#f0fdf4",
    border: "#86efac",
    text: "#15803d",
    muted: "#166534",
  },
  "dark-only": {
    background: "#f8fafc",
    border: "#cbd5e1",
    text: "#334155",
    muted: "#475569",
  },
  all: {
    background: "#eff6ff",
    border: "#bfdbfe",
    text: "#1d4ed8",
    muted: "#1e40af",
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function PoleFocusButton({ label, count, tone, active, onClick }) {
  const style = focusTabTones[tone] || focusTabTones.all;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.34rem",
        border: active ? "1px solid #0f172a" : `1px solid ${style.border}`,
        background: active ? "#0f172a" : style.background,
        color: active ? "#ffffff" : style.text,
        borderRadius: "999px",
        padding: "0.3rem 0.54rem",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontSize: "0.64rem",
          fontWeight: 700,
          color: active ? "rgba(255,255,255,0.78)" : style.muted,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "0.76rem", fontWeight: 800 }}>
        {count}
      </span>
    </button>
  );
}

function WorkSummaryCard({ counts, poleFocus, setPoleFocus }) {
  return (
    <div style={{ ...overlayCardStyle, padding: "0.28rem 0.36rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          flexWrap: "nowrap",
          overflowX: "auto",
          scrollbarWidth: "thin",
        }}
      >
        <span
          style={{
            flexShrink: 0,
            padding: "0 0.1rem",
            fontSize: "0.62rem",
            fontWeight: 800,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Filter
        </span>
        <PoleFocusButton
          label="Needs work"
          count={counts.needsWork}
          tone="needs-work"
          active={poleFocus === "needs-work"}
          onClick={() => setPoleFocus("needs-work")}
        />
        <PoleFocusButton
          label="All poles"
          count={counts.total}
          tone="all"
          active={poleFocus === "all"}
          onClick={() => setPoleFocus("all")}
        />
        <PoleFocusButton
          label="Connected"
          count={counts.connected}
          tone="connected"
          active={poleFocus === "connected"}
          onClick={() => setPoleFocus("connected")}
        />
        <PoleFocusButton
          label="Dark only"
          count={counts.darkOnly}
          tone="dark-only"
          active={poleFocus === "dark-only"}
          onClick={() => setPoleFocus("dark-only")}
        />
      </div>
    </div>
  );
}

function matchesPoleFocus(pole, poleFocus) {
  if (poleFocus === "needs-work") return (pole?.work?.taskCount || 0) > 0;
  if (poleFocus === "connected") return pole?.work?.status === "CONNECTED";
  if (poleFocus === "dark-only") return pole?.work?.status === "DARK_ONLY";
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

function MapFocusController({ focusTarget }) {
  const map = useMap();

  useEffect(() => {
    if (!focusTarget) return;

    map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom || searchFocusZoom, {
      duration: 0.8,
    });
  }, [focusTarget, map]);

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
      const width = clamp(Math.min(360, size.x - 24), 280, 360);
      const placement = point.x < size.x * 0.56 ? "right" : "left";
      const left = placement === "right"
        ? clamp(point.x + 28, 12, size.x - width - 12)
        : clamp(point.x - width - 28, 12, size.x - width - 12);
      const top = clamp(point.y - 52, 76, Math.max(76, size.y - 260));
      const maxHeight = Math.max(220, size.y - top - 16);
      const pointerTop = clamp(point.y - top, 24, Math.max(24, maxHeight - 24));

      onPositionChange({
        left,
        top,
        width,
        maxHeight,
        placement,
        pointerTop,
      });
    };

    updatePosition();
    map.on("move", updatePosition);
    map.on("zoom", updatePosition);
    map.on("resize", updatePosition);

    return () => {
      map.off("move", updatePosition);
      map.off("zoom", updatePosition);
      map.off("resize", updatePosition);
    };
  }, [map, onPositionChange, selected]);

  return null;
}

function PoleDetailPopover({ selected, position, onClose }) {
  if (selected?.type !== "pole" || !position) return null;

  const isRight = position.placement === "right";
  const isDistribution = selected?.data?.distribution?.isDistribution;

  return (
    <div
      style={{
        position: "absolute",
        left: position.left,
        top: position.top,
        width: position.width,
        maxWidth: "calc(100% - 1rem)",
        maxHeight: position.maxHeight,
        background: "rgba(255,255,255,0.98)",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        boxShadow: "0 18px 36px rgba(15, 23, 42, 0.16)",
        backdropFilter: "blur(14px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 760,
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
          padding: "0.9rem 1rem",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {isDistribution ? "Distribution" : "Pole"}
          </div>
          <div style={{ marginTop: "0.15rem", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
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
            width: "2rem",
            height: "2rem",
            cursor: "pointer",
            fontSize: "1rem",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: "1rem", overflow: "auto", minHeight: 0 }}>
        <PoleDetailContent data={selected.data} compact />
      </div>
    </div>
  );
}

function MapLayers({ onSelect, poles, equipment, segments, showPoles, showEquipment, showRoutes, poleFocus, selectedPoleId }) {
  const filteredPoles = poles.filter((pole) => matchesPoleFocus(pole, poleFocus));

  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {showRoutes &&
        segments.map((seg) => (
          <FiberPolyline
            key={seg.id}
            from={seg.fromPole}
            to={seg.toPole}
          />
        ))}
      {showPoles &&
        filteredPoles.map((pole) => (
          <PoleMarker
            key={pole.id}
            pole={pole}
            isSelected={selectedPoleId === pole.id}
            onClick={() => onSelect?.({ type: "pole", data: pole })}
          />
        ))}
      {showEquipment &&
        equipment.map((eq) => (
          <EquipmentMarker
            key={eq.id}
            equipment={eq}
            onClick={() => onSelect?.({ type: "equipment", data: eq })}
          />
        ))}
    </>
  );
}

export default function MapInner({ onSelect, projectIds, selected }) {
  const [showPoles, setShowPoles] = useState(true);
  const [showEquipment, setShowEquipment] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [poleFocus, setPoleFocus] = useState("needs-work");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [focusTarget, setFocusTarget] = useState(null);
  const [polePopupPosition, setPolePopupPosition] = useState(null);
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
  const decoratedPoles = useMemo(
    () => poles.map((pole) => decorateMapPole(pole, directServedPoleLookup)),
    [poles, directServedPoleLookup]
  );
  const selectedPoleId = selected?.type === "pole" ? selected?.data?.id : null;
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
  const workCounts = decoratedPoles.reduce(
    (acc, pole) => {
      if ((pole?.work?.taskCount || 0) > 0) acc.needsWork += 1;
      else if (pole?.work?.status === "CONNECTED") acc.connected += 1;
      else if (pole?.work?.status === "DARK_ONLY") acc.darkOnly += 1;
      else acc.noData += 1;
      return acc;
    },
    { needsWork: 0, connected: 0, darkOnly: 0, noData: 0, total: 0 }
  );
  workCounts.total = decoratedPoles.length;

  useEffect(() => {
    if (!rankedResults.length) {
      setHighlightedIndex(0);
      return;
    }

    setHighlightedIndex((current) => Math.min(current, rankedResults.length - 1));
  }, [rankedResults]);

  function handleSelectResult(result) {
    if (!result?.pole) return;

    setSearchQuery(result.label);
    setHighlightedIndex(0);
    setPoleFocus("all");
    setShowPoles(true);

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
        <MapFocusController focusTarget={focusTarget} />
        <PolePopupPositionController selected={selected} onPositionChange={setPolePopupPosition} />
        <MapLayers
          onSelect={onSelect}
          poles={decoratedPoles}
          equipment={equipment}
          segments={segments}
          showPoles={showPoles}
          showEquipment={showEquipment}
          showRoutes={showRoutes}
          poleFocus={poleFocus}
          selectedPoleId={selectedPoleId}
        />
      </MapContainer>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "15.5rem",
          width: "min(430px, calc(100% - 17rem))",
          zIndex: 700,
          display: "flex",
          justifyContent: "flex-start",
          pointerEvents: "none",
        }}
      >
        <div style={{ width: "fit-content", maxWidth: "100%", pointerEvents: "auto" }}>
          <WorkSummaryCard counts={workCounts} poleFocus={poleFocus} setPoleFocus={setPoleFocus} />
        </div>
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
      <PoleDetailPopover selected={selected} position={polePopupPosition} onClose={() => onSelect?.(null)} />
      <div
        style={{
          position: "absolute",
          bottom: "0.75rem",
          right: "0.75rem",
          zIndex: 700,
        }}
      >
        <LayerControls
          showPoles={showPoles}
          setShowPoles={setShowPoles}
          showEquipment={showEquipment}
          setShowEquipment={setShowEquipment}
          showRoutes={showRoutes}
          setShowRoutes={setShowRoutes}
          poleFocus={poleFocus}
        />
      </div>
    </div>
  );
}
