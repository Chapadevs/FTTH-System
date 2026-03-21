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

export function parseExcelBuffer(buffer) {
  const warnings = [];
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no worksheets");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length < 2) {
    throw new Error("Excel sheet has no data rows (need at least a header and one row)");
  }

  const headerRow = rows[0].map((c) => (c != null ? String(c) : ""));
  const dataRows = rows.slice(1);

  const colFrom = findColumn(
    headerRow,
    "start_enclosure",
    "start enclosure",
    "from_pole",
    "from pole",
    "from",
    "pole_from",
    "source"
  );
  const colTo = findColumn(
    headerRow,
    "end_enclosure",
    "end enclosure",
    "to_pole",
    "to pole",
    "to",
    "pole_to",
    "destination"
  );
  const colPole = findColumn(headerRow, "pole", "pole_number", "pole number", "enclosure", "node");
  const colLength = findColumn(
    headerRow,
    "length",
    "length_ft",
    "length ft",
    "feet",
    "distance",
    "distance_ft"
  );
  const colStreet = findColumn(headerRow, "street", "street_name", "street name", "address");
  const colLat = findColumn(headerRow, "lat", "latitude");
  const colLng = findColumn(headerRow, "lng", "lon", "longitude");

  const hasFromTo = colFrom >= 0 && colTo >= 0;
  const hasPoleOnly = colPole >= 0 && !hasFromTo;

  if (!hasFromTo && !hasPoleOnly) {
    const sample = headerRow.slice(0, 8).join(", ");
    throw new Error(
      `Could not find required columns. Need (start enclosure / from) and (end enclosure / to), or a single pole column. Found headers: ${sample}...`
    );
  }

  const poles = new Map();
  const rawSegments = [];
  const seenSegments = new Set();
  let skippedRows = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
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
        skippedRows++;
        continue;
      }
      const lengthFt = parseFloat(get(colLength)) || 0;
      const segKey = `${from}|${to}`;
      if (seenSegments.has(segKey)) continue;
      seenSegments.add(segKey);

      rawSegments.push({ from, to, lengthFt });

      const street = get(colStreet) || "";
      const lat = colLat >= 0 ? parseFloat(get(colLat)) : NaN;
      const lng = colLng >= 0 ? parseFloat(get(colLng)) : NaN;
      const hasCoords = !isNaN(lat) && !isNaN(lng);

      if (!poles.has(from)) {
        poles.set(from, {
          poleNumber: from,
          streetName: street,
          lat: hasCoords ? lat : 0,
          lng: hasCoords ? lng : 0,
        });
      }
      if (!poles.has(to)) {
        poles.set(to, {
          poleNumber: to,
          streetName: "",
          lat: 0,
          lng: 0,
        });
      }
    } else {
      const poleNum = get(colPole);
      if (!poleNum) {
        skippedRows++;
        continue;
      }
      if (!poles.has(poleNum)) {
        const street = get(colStreet) || "";
        const lat = colLat >= 0 ? parseFloat(get(colLat)) : NaN;
        const lng = colLng >= 0 ? parseFloat(get(colLng)) : NaN;
        const hasCoords = !isNaN(lat) && !isNaN(lng);
        poles.set(poleNum, {
          poleNumber: poleNum,
          streetName: street,
          lat: hasCoords ? lat : 0,
          lng: hasCoords ? lng : 0,
        });
      }
    }
  }

  if (poles.size === 0) {
    throw new Error("No valid poles or enclosures found in the sheet");
  }

  if (skippedRows > 0) {
    warnings.push(`${skippedRows} row(s) skipped (missing from/to or pole data)`);
  }
  if (colLat < 0 || colLng < 0) {
    warnings.push("No latitude/longitude columns found — poles will show at origin until coordinates are added");
  }

  return {
    poles: Array.from(poles.values()),
    rawSegments,
    metadata: { rowCount: dataRows.length, sheetName },
    warnings,
  };
}
