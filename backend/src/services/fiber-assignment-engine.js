/**
 * Fiber Assignment Engine — parses fiber export data, classifies active/dark fibers,
 * detects inconsistencies, and produces technician-ready visit plans with 12-color ordering.
 */

const FIBER_COLORS = [
  "BLUE",
  "ORANGE",
  "GREEN",
  "BROWN",
  "SLATE",
  "WHITE",
  "RED",
  "BLACK",
  "YELLOW",
  "VIOLET",
  "PINK",
  "AQUA",
];

const COLOR_CODE_MAP = {
  BL: 0,
  OR: 1,
  GR: 2,
  BR: 3,
  SL: 4,
  WH: 5,
  RD: 6,
  BK: 7,
  YE: 8,
  VI: 9,
  RS: 10,
  PI: 10,
  AQ: 11,
};

/** Full-word matches (Excel often uses PINK / ROSE / VIOLET instead of short codes). */
const COLOR_NAME_TO_INDEX = {
  BLUE: 0,
  ORANGE: 1,
  GREEN: 2,
  BROWN: 3,
  SLATE: 4,
  WHITE: 5,
  RED: 6,
  BLACK: 7,
  YELLOW: 8,
  VIOLET: 9,
  PINK: 10,
  ROSE: 10,
  AQUA: 11,
};

const INDEX_TO_CODE = Object.fromEntries(
  Object.entries(COLOR_CODE_MAP).map(([code, idx]) => [idx, code])
);

/** TIA Rose; persisted as PINK */
function humanFiberColorLabel(color) {
  return color === "PINK" ? "ROSE" : color;
}

function normalizeColorCode(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;

  if (Object.prototype.hasOwnProperty.call(COLOR_NAME_TO_INDEX, s)) {
    const idx = COLOR_NAME_TO_INDEX[s];
    return INDEX_TO_CODE[idx];
  }

  const code2 = s.slice(0, 2);
  if (COLOR_CODE_MAP[code2] !== undefined) return code2;

  return null;
}

/** Parse PRISM/Excel connection column: fusion splice, mechanical continuity, or dark/pass-through. */
export function parseConnection(raw) {
  if (raw == null || typeof raw !== "string") return "DARK";
  const s = String(raw).trim().toUpperCase();
  if (s.includes("MECHANICAL")) return "MECHANICAL";
  if (s.includes("FUSION") || s === "<- FUSION ->") return "FUSION";
  return "DARK";
}

function normalizeTextField(raw) {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const normalized = value.toUpperCase();
  if (
    normalized === "N/A" ||
    normalized === "NA" ||
    normalized === "NONE" ||
    normalized === "NULL" ||
    normalized === "-" ||
    normalized === "--"
  ) {
    return null;
  }

  return value;
}

function rowToFiberRecord(row, getColumn) {
  const bufferRaw = getColumn(row, "buffer", "BUFFER");
  const fiberRaw = getColumn(row, "fiber", "FIBER");
  const connectionRaw = getColumn(row, "connection", "CONNECTION");
  const wavelengthRaw = getColumn(row, "wavelength", "WAVELENGTH");
  const deviceRaw = getColumn(row, "device", "DEVICE NAME", "DEVICE");
  const portRaw = getColumn(row, "port", "PORT NAME", "PORT");
  const sheathRaw = getColumn(row, "sheath", "SHEATH NAME", "SHEATH");
  const startRaw = getColumn(row, "start", "START ENCLOSURE", "START");
  const endRaw = getColumn(row, "end", "END ENCLOSURE", "END");

  const bufferCode = normalizeColorCode(bufferRaw);
  const fiberCode = normalizeColorCode(fiberRaw);
  if (!bufferCode || !fiberCode) return null;

  const bufferIndex = COLOR_CODE_MAP[bufferCode];
  const fiberIndex = COLOR_CODE_MAP[fiberCode];
  const rawConnection = connectionRaw == null ? null : String(connectionRaw).trim();
  const connectionType = parseConnection(connectionRaw);
  const normalizedWavelength = wavelengthRaw == null ? "" : String(wavelengthRaw).trim();
  const parsedWavelength = normalizedWavelength !== "" && normalizedWavelength.toUpperCase() !== "N/A"
    ? parseFloat(normalizedWavelength)
    : NaN;
  const wavelength = Number.isFinite(parsedWavelength) && parsedWavelength > 0 ? parsedWavelength : null;

  return {
    sheathName: normalizeTextField(sheathRaw),
    startEnclosure: normalizeTextField(startRaw),
    endEnclosure: normalizeTextField(endRaw),
    bufferColor: FIBER_COLORS[bufferIndex],
    fiberColor: FIBER_COLORS[fiberIndex],
    bufferIndex,
    fiberIndex,
    rawConnection,
    connectionType,
    wavelength,
    deviceName: normalizeTextField(deviceRaw),
    portName: normalizeTextField(portRaw),
  };
}

/**
 * Build a column getter from header row (array of strings)
 */
function buildColumnGetter(headers) {
  const normalized = headers.map((h) =>
    String(h ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s\-\.]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
  );
  return (row, ...candidates) => {
    for (const c of candidates) {
      const key = c
        .trim()
        .toLowerCase()
        .replace(/[\s\-\.]+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      const idx = normalized.findIndex((h) => h === key);
      if (idx >= 0 && row[idx] != null && row[idx] !== "") return row[idx];
    }
    return null;
  };
}

/**
 * Process raw rows (array of arrays, first row = headers) into fiber records.
 */
export function parseFiberRows(rows) {
  if (!rows || rows.length < 2) return { records: [], warnings: [] };
  const headerRow = rows[0];
  const getColumn = buildColumnGetter(headerRow);
  const records = [];
  const warnings = [];

  for (let i = 1; i < rows.length; i++) {
    const rec = rowToFiberRecord(rows[i], getColumn);
    if (rec) records.push(rec);
  }

  return { records, warnings };
}

/**
 * Classify fibers and detect inconsistencies.
 */
export function computeAssignmentSummary(records) {
  const bySheath = new Map();
  let activeCount = 0;
  let darkCount = 0;
  const inconsistencies = [];

  for (const r of records) {
    const key = r.sheathName || "unknown";
    if (!bySheath.has(key)) {
      bySheath.set(key, { active: 0, dark: 0, fibers: [] });
    }
    const bag = bySheath.get(key);
    bag.fibers.push(r);

    const isFusion = r.connectionType === "FUSION";
    const isMechanical = r.connectionType === "MECHANICAL";
    const hasWavelength = r.wavelength != null;

    if (isFusion) {
      activeCount++;
      bag.active++;
      if (!hasWavelength) {
        inconsistencies.push({
          type: "FUSION_WITHOUT_WAVELENGTH",
          sheath: key,
          fiber: `${r.bufferColor}/${r.fiberColor}`,
          message: `Fused fiber ${r.fiberColor} in ${r.bufferColor} tube has no wavelength`,
        });
      }
    } else if (isMechanical) {
      darkCount++;
      bag.dark++;
      if (hasWavelength) {
        inconsistencies.push({
          type: "WAVELENGTH_WITHOUT_MECHANICAL",
          sheath: key,
          fiber: `${r.bufferColor}/${r.fiberColor}`,
          message: `Mechanical continuity row ${r.fiberColor} in ${r.bufferColor} tube has wavelength (unexpected)`,
        });
      }
    } else {
      darkCount++;
      bag.dark++;
      if (hasWavelength) {
        inconsistencies.push({
          type: "WAVELENGTH_WITHOUT_FUSION",
          sheath: key,
          fiber: `${r.bufferColor}/${r.fiberColor}`,
          message: `Dark fiber ${r.fiberColor} has wavelength assigned`,
        });
      }
    }
  }

  return {
    bySheath: Object.fromEntries(bySheath),
    activeCount,
    darkCount,
    mechanicalCount: records.filter((r) => r.connectionType === "MECHANICAL").length,
    inconsistencies,
    totalFiberColors: 12,
  };
}

/**
 * Build an ordered visit plan: which poles to visit and what to do at each.
 */
export function buildVisitPlan(records) {
  const byLocation = new Map();

  for (const r of records) {
    if (r.connectionType !== "FUSION") continue;
    for (const loc of [r.startEnclosure, r.endEnclosure]) {
      if (!loc) continue;
      if (!byLocation.has(loc)) {
        byLocation.set(loc, { location: loc, actions: [] });
      }
      byLocation.get(loc).actions.push({
        sheath: r.sheathName,
        bufferColor: r.bufferColor,
        fiberColor: r.fiberColor,
        deviceName: r.deviceName,
        portName: r.portName,
        wavelength: r.wavelength,
        instruction: `Fuse ${humanFiberColorLabel(r.fiberColor)} fiber in ${humanFiberColorLabel(r.bufferColor)} tube${r.deviceName ? ` → ${r.deviceName}` : ""}${r.portName ? ` ${r.portName}` : ""}`,
      });
    }
  }

  const visits = Array.from(byLocation.values()).sort((a, b) =>
    String(a.location).localeCompare(b.location)
  );

  return { visits, orderedByLocation: true };
}

/**
 * Get the 12-color sequence for display/ordering.
 */
export function getFiberColorSequence() {
  return [...FIBER_COLORS];
}

export function getFiberColorIndex(colorName) {
  const idx = FIBER_COLORS.indexOf(String(colorName).toUpperCase());
  return idx >= 0 ? idx : null;
}
