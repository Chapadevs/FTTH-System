import * as XLSX from "xlsx";

function normalizeHeader(h) {
  if (h == null || typeof h !== "string") return "";
  return h
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\-\.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function findColumn(headers, ...candidates) {
  const normalized = headers.map((h) => normalizeHeader(h));
  for (const c of candidates) {
    const key = normalizeHeader(c);
    const idx = normalized.findIndex((h) => h === key || (h.length >= key.length && h.includes(key)));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Returns true if header row has BUFFER and FIBER columns (fiber export format) */
function sheetHasFiberColumns(headerRow) {
  const h = headerRow.map((c) => (c != null ? String(c) : ""));
  const colBuffer = findColumn(h, "buffer", "BUFFER");
  const colFiber = findColumn(h, "fiber", "FIBER");
  return colBuffer >= 0 && colFiber >= 0;
}

function sheetLooksLikeMapData(headerRow) {
  const h = headerRow.map((c) => (c != null ? String(c) : ""));
  if (sheetHasFiberColumns(h)) return false;

  const colFrom = findColumn(h, "start enclosure", "start_enclosure", "from_pole", "from pole", "from", "pole_from", "source", "a", "pole a");
  const colTo = findColumn(h, "end enclosure", "end_enclosure", "to_pole", "to pole", "to", "pole_to", "destination", "b", "pole b");
  const colPole = findColumn(h, "pole", "pole_number", "pole number", "enclosure", "node", "location");

  return (colFrom >= 0 && colTo >= 0) || colPole >= 0;
}

function parseCoordinatePair(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

function isValidCoordinate(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function hasUsableCoordinates(pole) {
  if (!pole) return false;
  return isValidCoordinate(pole.lat, pole.lng) && !(pole.lat === 0 && pole.lng === 0);
}

function mergePoleRecord(existingPole, nextPole) {
  if (!existingPole) return nextPole;
  const existingHasCoords = hasUsableCoordinates(existingPole);
  const nextHasCoords = hasUsableCoordinates(nextPole);

  return {
    ...existingPole,
    streetName: existingPole.streetName || nextPole.streetName || "",
    ...(nextHasCoords && !existingHasCoords
      ? { lat: nextPole.lat, lng: nextPole.lng }
      : {}),
  };
}

function getRowLabel(row) {
  return normalizeHeader(row?.[0] ?? "");
}

function rowLooksLikeRepeatedHeader(row) {
  const labels = new Set(
    (row || [])
      .map((cell) => normalizeHeader(cell))
      .filter(Boolean)
  );
  const knownHeaderLabels = [
    "sheath_uuid",
    "sheath_name",
    "start_enclosure",
    "end_enclosure",
    "buffer",
    "fiber",
    "connection",
    "device_uuid",
    "device_name",
    "port_name",
    "port_wavelength",
  ];
  let matches = 0;
  for (const label of knownHeaderLabels) {
    if (labels.has(label)) matches++;
  }
  return matches >= 3;
}

function getEnclosureSheetMetadata(rows, fallbackSheetName = "") {
  if (!rows?.length) return null;

  const nameRow = rows.find((row) => getRowLabel(row) === "enclosure_name");
  const locationRow = rows.find((row) => getRowLabel(row) === "enclosure_location");
  if (!nameRow && !locationRow) return null;

  const enclosureName = String(nameRow?.[1] ?? fallbackSheetName ?? "").trim() || fallbackSheetName || null;
  const coords = parseCoordinatePair(locationRow?.[1]);

  return {
    enclosureName,
    coords,
  };
}

function findPrimaryDataHeaderIndex(rows) {
  for (let i = 0; i < rows.length; i++) {
    const headerRow = rows[i].map((c) => (c != null ? String(c) : ""));
    if (sheetHasFiberColumns(headerRow)) return i;
  }
  for (let i = 0; i < rows.length; i++) {
    const headerRow = rows[i].map((c) => (c != null ? String(c) : ""));
    if (sheetLooksLikeMapData(headerRow)) return i;
  }
  return -1;
}

export function readExcelWorkbook(buffer) {
  return XLSX.read(buffer, { type: "buffer", cellDates: false });
}

function getWorkbookSheetNames(workbook) {
  return workbook?.SheetNames || [];
}

function selectSheetNames(workbook, requestedSheetNames) {
  const allSheetNames = getWorkbookSheetNames(workbook);
  return requestedSheetNames?.length
    ? requestedSheetNames.filter((name) => allSheetNames.includes(name))
    : allSheetNames;
}

/**
 * Auto-detect and extract rows from sheets that have BUFFER+FIBER columns.
 * When sheetNames is provided, only those sheets are scanned.
 */
export function extractFiberRowsFromExcel(buffer, options = {}) {
  const workbook = readExcelWorkbook(buffer);
  return extractFiberRowsFromWorkbook(workbook, options);
}

export function extractFiberRowsFromWorkbook(workbook, options = {}) {
  const allSheetNames = workbook.SheetNames || [];
  const selectedSheetNames =
    options.sheetNames?.length
      ? options.sheetNames.filter((name) => allSheetNames.includes(name))
      : allSheetNames;
  const mergedRows = [];
  const sheetsUsed = [];

  for (const sheetName of selectedSheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (rows.length < 2) continue;

    const headerIndex = findPrimaryDataHeaderIndex(rows);
    if (headerIndex < 0) continue;

    const headerRow = rows[headerIndex].map((c) => (c != null ? String(c) : ""));
    if (!sheetHasFiberColumns(headerRow)) continue;

    if (mergedRows.length === 0) {
      mergedRows.push(headerRow);
    }
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const normalizedRow = rows[i].map((c) => (c != null ? String(c) : ""));
      if (rowLooksLikeRepeatedHeader(normalizedRow)) break;
      mergedRows.push(normalizedRow);
    }
    sheetsUsed.push(sheetName);
  }

  return { rows: mergedRows, sheetsUsed };
}

/** List all worksheet names in an Excel workbook */
export function listExcelSheets(buffer) {
  const workbook = readExcelWorkbook(buffer);
  return { sheetNames: getWorkbookSheetNames(workbook) };
}

export function listExcelSheetsFromWorkbook(workbook) {
  return { sheetNames: getWorkbookSheetNames(workbook) };
}

/** Returns all sheet names (no exclusions by name — we scan all and use any with valid columns) */
export function getImportableSheetNames(buffer) {
  const { sheetNames } = listExcelSheets(buffer);
  return sheetNames || [];
}

export function getImportableSheetNamesFromWorkbook(workbook) {
  const { sheetNames } = listExcelSheetsFromWorkbook(workbook);
  return sheetNames || [];
}

/** Preview a single sheet: columns, row count, validation, warnings */
export function previewExcelSheet(buffer, sheetName) {
  const workbook = readExcelWorkbook(buffer);
  return previewExcelSheetFromWorkbook(workbook, sheetName);
}

export function previewExcelSheetFromWorkbook(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { valid: false, columns: [], rowCount: 0, warnings: ["Sheet not found"], hasFromTo: false, hasPoleOnly: false };
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const warnings = [];
  const enclosureMeta = getEnclosureSheetMetadata(rows, sheetName);

  if (rows.length < 2) {
    return { valid: false, columns: [], rowCount: Math.max(0, rows.length - 1), warnings: ["Need at least header and one data row"], hasFromTo: false, hasPoleOnly: false };
  }

  const headerIndex = findPrimaryDataHeaderIndex(rows);
  const headerRow = (headerIndex >= 0 ? rows[headerIndex] : rows[0]).map((c) => (c != null ? String(c) : ""));
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows.slice(1);
  const isFiberSheet = sheetHasFiberColumns(headerRow);
  const colFrom = findColumn(headerRow, "start enclosure", "start_enclosure", "from_pole", "from pole", "from", "pole_from", "source", "a", "pole a");
  const colTo = findColumn(headerRow, "end enclosure", "end_enclosure", "to_pole", "to pole", "to", "pole_to", "destination", "b", "pole b");
  const colPole = findColumn(headerRow, "pole", "pole_number", "pole number", "enclosure", "node", "location");
  const colLat = findColumn(headerRow, "lat", "latitude");
  const colLng = findColumn(headerRow, "lng", "lon", "longitude");

  const hasFromTo = colFrom >= 0 && colTo >= 0 && (!isFiberSheet || Boolean(enclosureMeta?.enclosureName));
  const hasPoleOnly = (!isFiberSheet && colPole >= 0 && !hasFromTo) || Boolean(enclosureMeta?.coords && enclosureMeta?.enclosureName);
  const valid = hasFromTo || hasPoleOnly;

  if (!valid) {
    warnings.push(isFiberSheet
      ? "Fiber export detected — this sheet is processed by the fiber workflow, not map import"
      : "Missing required columns: need (from/to) or (pole)");
  }
  if (!enclosureMeta?.coords && (colLat < 0 || colLng < 0)) {
    warnings.push("No lat/lng columns — poles may show at origin");
  }

  return {
    valid,
    columns: headerRow,
    rowCount: dataRows.length,
    warnings,
    hasFromTo,
    hasPoleOnly,
  };
}

/**
 * Parse Excel buffer. If sheetNames provided, process only those sheets and merge results.
 * Otherwise use first sheet (backward compatible).
 */
export function parseExcelBuffer(buffer, options = {}) {
  const workbook = readExcelWorkbook(buffer);
  return parseExcelWorkbook(workbook, options);
}

export function parseExcelWorkbook(workbook, options = {}) {
  const { sheetNames: requestedSheets } = options;
  const warnings = [];
  const allSheetNames = getWorkbookSheetNames(workbook);
  const sheetsToProcess = selectSheetNames(workbook, requestedSheets);

  if (sheetsToProcess.length === 0) {
    throw new Error(
      allSheetNames.length === 0
        ? "No sheets found in workbook."
        : "No valid sheets selected or sheet not found"
    );
  }

  const mergedPoles = new Map();
  const rawSegments = [];
  const seenSegments = new Set();
  let totalSkipped = 0;
  let hasAnyCoordColumns = false;
  const ignoredSheets = requestedSheets?.length ? allSheetNames.filter((s) => !requestedSheets.includes(s)) : [];

  for (const sheetName of sheetsToProcess) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const enclosureMeta = getEnclosureSheetMetadata(rows, sheetName);

    if (rows.length < 2) {
      warnings.push(`Sheet "${sheetName}": skipped (no data rows)`);
      continue;
    }

    if (enclosureMeta?.coords) {
      hasAnyCoordColumns = true;
      const key = enclosureMeta.enclosureName;
      if (key && !mergedPoles.has(key)) {
        mergedPoles.set(key, {
          poleNumber: key,
          streetName: null,
          lat: enclosureMeta.coords.lat,
          lng: enclosureMeta.coords.lng,
        });
      } else if (key) {
        const existing = mergedPoles.get(key);
        if ((existing.lat === 0 && existing.lng === 0) || existing.lat == null || existing.lng == null) {
          mergedPoles.set(key, {
            ...existing,
            lat: enclosureMeta.coords.lat,
            lng: enclosureMeta.coords.lng,
          });
        }
      }
    }

    const headerIndex = findPrimaryDataHeaderIndex(rows);
    if (headerIndex < 0) {
      if (enclosureMeta?.coords && enclosureMeta?.enclosureName) continue;
      warnings.push(`Sheet "${sheetName}": skipped (missing from/to or pole columns)`);
      continue;
    }

    const headerRow = rows[headerIndex].map((c) => (c != null ? String(c) : ""));
    const dataRows = rows.slice(headerIndex + 1);

    const colFrom = findColumn(headerRow, "start enclosure", "start_enclosure", "from_pole", "from pole", "from", "pole_from", "source", "a", "pole a");
    const colTo = findColumn(headerRow, "end enclosure", "end_enclosure", "to_pole", "to pole", "to", "pole_to", "destination", "b", "pole b");
    const colPole = findColumn(headerRow, "pole", "pole_number", "pole number", "enclosure", "node", "location");
    const colLength = findColumn(headerRow, "length", "length_ft", "length ft", "feet", "distance", "distance_ft");
    const colStreet = findColumn(headerRow, "street", "street_name", "street name", "address");
    const colLat = findColumn(headerRow, "lat", "latitude");
    const colLng = findColumn(headerRow, "lng", "lon", "longitude");
    if (colLat >= 0 && colLng >= 0) hasAnyCoordColumns = true;

    const isEnclosureSheet = Boolean(enclosureMeta?.enclosureName);
    const isMapSheet = sheetLooksLikeMapData(headerRow) || isEnclosureSheet;
    const hasFromTo = isMapSheet && colFrom >= 0 && colTo >= 0;
    const hasPoleOnly = isMapSheet && colPole >= 0 && !hasFromTo;

    if (!hasFromTo && !hasPoleOnly) {
      warnings.push(
        sheetHasFiberColumns(headerRow)
          ? `Sheet "${sheetName}": skipped for map import (fiber export sheet)`
          : `Sheet "${sheetName}": skipped (missing from/to or pole columns)`
      );
      continue;
    }

    let sheetSkipped = 0;
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (rowLooksLikeRepeatedHeader(row)) {
        break;
      }
      const get = (idx) => {
        if (idx < 0) return null;
        const v = row[idx];
        if (v == null) return null;
        const s = String(v).trim();
        return s || null;
      };

      if (hasFromTo) {
        const from = get(colFrom);
        const to = get(colTo);
        if (!from || !to || from === to) {
          sheetSkipped++;
          continue;
        }
        const lengthFt = parseFloat(get(colLength)) || 0;
        const [normFrom, normTo] = from < to ? [from, to] : [to, from];
        const segKey = `${normFrom}|${normTo}`;
        if (seenSegments.has(segKey)) continue;
        seenSegments.add(segKey);

        rawSegments.push({ from, to, lengthFt });

        const street = get(colStreet) || "";
        const lat = colLat >= 0 ? parseFloat(get(colLat)) : NaN;
        const lng = colLng >= 0 ? parseFloat(get(colLng)) : NaN;
        const hasCoords = !isNaN(lat) && !isNaN(lng);

        const fromCoords =
          enclosureMeta?.enclosureName === from && enclosureMeta.coords
            ? enclosureMeta.coords
            : null;
        const fromCandidate = {
          poleNumber: from,
          streetName: street,
          lat: fromCoords ? fromCoords.lat : (hasCoords ? lat : 0),
          lng: fromCoords ? fromCoords.lng : (hasCoords ? lng : 0),
        };
        mergedPoles.set(from, mergePoleRecord(mergedPoles.get(from), fromCandidate));

        const toCandidate = { poleNumber: to, streetName: "", lat: 0, lng: 0 };
        mergedPoles.set(to, mergePoleRecord(mergedPoles.get(to), toCandidate));
      } else {
        const poleNum = get(colPole);
        if (!poleNum) {
          sheetSkipped++;
          continue;
        }
        const street = get(colStreet) || "";
        const lat = colLat >= 0 ? parseFloat(get(colLat)) : NaN;
        const lng = colLng >= 0 ? parseFloat(get(colLng)) : NaN;
        const hasCoords = !isNaN(lat) && !isNaN(lng);
        const candidate = {
          poleNumber: poleNum,
          streetName: street,
          lat: hasCoords ? lat : 0,
          lng: hasCoords ? lng : 0,
        };
        mergedPoles.set(poleNum, mergePoleRecord(mergedPoles.get(poleNum), candidate));
      }
    }
    totalSkipped += sheetSkipped;
    if (sheetSkipped > 0) {
      warnings.push(`Sheet "${sheetName}": ${sheetSkipped} row(s) skipped`);
    }
  }

  const poles = Array.from(mergedPoles.values());

  if (poles.length === 0) {
    throw new Error("No valid poles or enclosures found in selected sheets");
  }

  if (!hasAnyCoordColumns) {
    warnings.push("No latitude/longitude columns found — poles will show at origin until coordinates are added");
  }

  return {
    poles,
    rawSegments,
    metadata: {
      rowCount: poles.length + rawSegments.length,
      sheetNames: sheetsToProcess,
      ignoredSheets,
    },
    warnings,
  };
}

