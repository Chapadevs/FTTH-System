import {
  extractFiberRowsFromWorkbook,
  getImportableSheetNamesFromWorkbook,
  parseExcelWorkbook,
  previewExcelSheetFromWorkbook,
  readExcelWorkbook,
} from "./excel-parser.js";
import { parsePrismBuffer } from "./prism-parser.js";
import {
  buildVisitPlan,
  computeAssignmentSummary,
  parseFiberRows,
} from "./fiber-assignment-engine.js";

const EXCEL_EXT = /\.(xlsx|xls)$/i;
const ZIP_EXT = /\.zip$/i;

function normalizeKey(value) {
  if (value == null) return "";
  return String(value).trim().toUpperCase();
}

function buildFiberWarnings(summary, parseWarnings) {
  const warnings = [...(parseWarnings || [])];
  if (summary.inconsistencies.length > 0) {
    warnings.push(`${summary.inconsistencies.length} fiber inconsistency issue(s) detected`);
  }
  return warnings;
}

function buildCrossReference(records, mapPoles) {
  const knownPoleKeys = new Set((mapPoles || []).map((pole) => normalizeKey(pole.poleNumber)));
  const endpointNames = new Set();

  for (const record of records) {
    if (record.startEnclosure) endpointNames.add(String(record.startEnclosure).trim());
    if (record.endEnclosure) endpointNames.add(String(record.endEnclosure).trim());
  }

  const missingPoleNames = Array.from(endpointNames)
    .filter((name) => !knownPoleKeys.has(normalizeKey(name)))
    .sort((a, b) => a.localeCompare(b));

  return {
    endpointCount: endpointNames.size,
    matchedEndpointCount: endpointNames.size - missingPoleNames.length,
    missingPoleNames,
  };
}

function buildFiberPreview(records, warnings, sheetsUsed, mapPoles) {
  const summary = computeAssignmentSummary(records);
  const visitPlan = buildVisitPlan(records);
  const crossReference = buildCrossReference(records, mapPoles);

  return {
    present: records.length > 0,
    recordCount: records.length,
    sheetsUsed,
    warnings: buildFiberWarnings(summary, warnings),
    summary: {
      bySheath: summary.bySheath,
      activeCount: summary.activeCount,
      darkCount: summary.darkCount,
      inconsistencies: summary.inconsistencies,
      totalFiberColors: summary.totalFiberColors,
    },
    visitPlan,
    crossReference,
  };
}

function buildMapPreview(mapData) {
  if (!mapData) {
    return {
      present: false,
      polesCount: 0,
      segmentsCount: 0,
      samplePoleNumbers: [],
      warnings: [],
      selectedSheets: [],
      ignoredSheets: [],
    };
  }

  return {
    present: true,
    polesCount: mapData.poles.length,
    segmentsCount: mapData.rawSegments.length,
    samplePoleNumbers: mapData.poles.slice(0, 8).map((pole) => pole.poleNumber),
    warnings: mapData.warnings || [],
    selectedSheets: mapData.metadata?.sheetNames || [],
    ignoredSheets: mapData.metadata?.ignoredSheets || [],
  };
}

function parseExcelImportBuffer(buffer, options = {}) {
  const workbook = readExcelWorkbook(buffer);
  const allSheetNames = getImportableSheetNamesFromWorkbook(workbook);
  const selectedSheetNames =
    options.selectedSheets?.length
      ? options.selectedSheets.filter((name) => allSheetNames.includes(name))
      : allSheetNames;

  const mapSheetPreviews = selectedSheetNames.map((name) => ({
    name,
    ...previewExcelSheetFromWorkbook(workbook, name),
  }));
  const validMapSheetNames = mapSheetPreviews.filter((sheet) => sheet.valid).map((sheet) => sheet.name);

  const mapData = validMapSheetNames.length > 0
    ? parseExcelWorkbook(workbook, { sheetNames: validMapSheetNames })
    : null;

  const { rows, sheetsUsed } = extractFiberRowsFromWorkbook(workbook, { sheetNames: selectedSheetNames });
  const normalizedRows = rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
  const { records, warnings } = parseFiberRows(normalizedRows);
  const fiberData = records.length > 0
    ? {
        records,
        warnings,
        sheetsUsed,
      }
    : null;

  if (!mapData && !fiberData) {
    throw new Error("No supported map or fiber data found. Need map columns (from/to or pole) or fiber columns (buffer/fiber).");
  }

  return {
    fileType: "excel",
    mapData,
    fiberData,
    sheetPreviews: mapSheetPreviews,
    selectedSheetNames,
  };
}

function parseZipImportBuffer(buffer) {
  const result = parsePrismBuffer(buffer);
  return {
    fileType: "zip",
    mapData: {
      poles: result.poles,
      rawSegments: result.rawSegments,
      metadata: result.metadata,
      warnings: [],
    },
    fiberData: null,
    sheetPreviews: [],
    selectedSheetNames: [],
  };
}

export function parseImportFile(buffer, filePath, options = {}) {
  const lower = filePath.toLowerCase();
  if (EXCEL_EXT.test(lower)) {
    return parseExcelImportBuffer(buffer, options);
  }
  if (ZIP_EXT.test(lower)) {
    return parseZipImportBuffer(buffer);
  }
  throw new Error("Unsupported file format. Use .xlsx, .xls, or .zip");
}

export function buildImportVerification(parsed) {
  const map = buildMapPreview(parsed.mapData);
  const fiber = parsed.fiberData
    ? buildFiberPreview(parsed.fiberData.records, parsed.fiberData.warnings, parsed.fiberData.sheetsUsed, parsed.mapData?.poles || [])
    : null;
  const warnings = [
    ...(!map.present && fiber?.present
      ? ["No map geometry found. Fiber data can be imported, but generated poles will not appear in the project area without coordinates."]
      : []),
    ...(map.warnings || []),
    ...(fiber?.warnings || []),
    ...(fiber?.crossReference?.missingPoleNames?.length
      ? [`${fiber.crossReference.missingPoleNames.length} fiber endpoint(s) are not present in map data`]
      : []),
  ];

  return {
    fileType: parsed.fileType,
    readyToImport: Boolean(map.present || fiber?.present),
    map,
    fiber,
    warnings,
    sheetPreviews: parsed.sheetPreviews,
    selectedSheets: parsed.selectedSheetNames,
  };
}

function deriveFiberStatus(record) {
  const hasWavelength = record.wavelength != null;
  if (record.connectionType === "FUSION" && hasWavelength) return "ACTIVE";
  if (record.connectionType === "DARK" && !hasWavelength) return "DARK";
  return "INCONSISTENT";
}

function hasAssignmentData(record) {
  return Boolean(record.deviceName || record.portName);
}

function mergeConnectionType(currentType, nextType) {
  return currentType === "FUSION" || nextType === "FUSION" ? "FUSION" : "DARK";
}

function pickPreferredValue(currentValue, nextValue) {
  return currentValue ?? nextValue ?? null;
}

function getObservationPriority(state) {
  if (state === "ACTIVE") return 3;
  if (state === "NEEDS_FUSION") return 2;
  return 1;
}

function mergeObservationState(currentState, nextState) {
  return getObservationPriority(nextState) > getObservationPriority(currentState)
    ? nextState
    : currentState;
}

function endpointMatchesAssignment(endpoint, record) {
  if (!hasAssignmentData(record)) return false;

  const deviceKey = normalizeKey(record.deviceName);
  const poleKey = normalizeKey(endpoint.poleName);
  if (deviceKey && poleKey && (deviceKey === poleKey || deviceKey.includes(poleKey))) {
    return true;
  }

  // Splice reports usually attach port/device metadata to the local enclosure.
  return endpoint.role === "END";
}

function deriveObservationState(record, endpoint) {
  const hasWavelength = record.wavelength != null;
  if (endpointMatchesAssignment(endpoint, record)) {
    return record.connectionType === "FUSION" && hasWavelength ? "ACTIVE" : "NEEDS_FUSION";
  }
  if (record.connectionType === "FUSION" && hasWavelength) return "ACTIVE";
  return "DARK";
}

function groupSheathRecords(records) {
  const recordsBySheath = new Map();

  for (const record of records) {
    const sheathName = record.sheathName || `${record.startEnclosure || "UNKNOWN"}-${record.endEnclosure || "UNKNOWN"}`;
    if (!recordsBySheath.has(sheathName)) {
      recordsBySheath.set(sheathName, []);
    }
    recordsBySheath.get(sheathName).push(record);
  }

  return recordsBySheath;
}

export function buildSheathCreateInput(projectId, sheathName, sheathRecords, poleMap) {
  const endpointMap = new Map();
  const fiberMap = new Map();

  for (const record of sheathRecords) {
    const endpoints = [
      { role: "START", poleName: record.startEnclosure },
      { role: "END", poleName: record.endEnclosure },
    ];

    for (const endpoint of endpoints) {
      if (!endpoint.poleName) continue;
      const pole = poleMap.get(normalizeKey(endpoint.poleName));
      if (!pole) continue;
      const endpointKey = `${endpoint.role}|${pole.id}`;
      if (!endpointMap.has(endpointKey)) {
        endpointMap.set(endpointKey, {
          poleId: pole.id,
          role: endpoint.role,
        });
      }
    }

    const fiberKey = `${record.bufferIndex}|${record.fiberIndex}`;
    if (!fiberMap.has(fiberKey)) {
      fiberMap.set(fiberKey, {
        bufferColor: record.bufferColor,
        fiberColor: record.fiberColor,
        bufferIndex: record.bufferIndex,
        fiberIndex: record.fiberIndex,
        direction: record.direction ?? null,
        wavelength: record.wavelength ?? null,
        connectionType: record.connectionType,
        assignmentKeySet: new Set(),
        assignments: [],
        endpointObservationMap: new Map(),
      });
    }

    const fiberState = fiberMap.get(fiberKey);
    fiberState.connectionType = mergeConnectionType(fiberState.connectionType, record.connectionType);
    fiberState.wavelength = pickPreferredValue(fiberState.wavelength, record.wavelength);
    fiberState.direction = pickPreferredValue(fiberState.direction, record.direction);

    for (const endpoint of endpoints) {
      if (!endpoint.poleName) continue;
      const pole = poleMap.get(normalizeKey(endpoint.poleName));
      if (!pole) continue;

      const observationKey = pole.id;
      const state = deriveObservationState(record, endpoint);
      const nextObservation = {
        poleId: pole.id,
        role: endpoint.role,
        connectionType: record.connectionType,
        rawConnection: record.rawConnection ?? null,
        wavelength: record.wavelength ?? null,
        deviceName: endpointMatchesAssignment(endpoint, record) ? record.deviceName : null,
        portName: endpointMatchesAssignment(endpoint, record) ? record.portName : null,
        state,
      };
      const existingObservation = fiberState.endpointObservationMap.get(observationKey);

      if (!existingObservation) {
        fiberState.endpointObservationMap.set(observationKey, nextObservation);
      } else {
        fiberState.endpointObservationMap.set(observationKey, {
          ...existingObservation,
          connectionType: mergeConnectionType(existingObservation.connectionType, nextObservation.connectionType),
          rawConnection: existingObservation.rawConnection || nextObservation.rawConnection,
          wavelength: pickPreferredValue(existingObservation.wavelength, nextObservation.wavelength),
          deviceName: existingObservation.deviceName || nextObservation.deviceName,
          portName: existingObservation.portName || nextObservation.portName,
          state: mergeObservationState(existingObservation.state, nextObservation.state),
        });
      }
    }
  }

  const fiberRecords = Array.from(fiberMap.values()).map((fiberState) => {
    const endpointObservations = Array.from(fiberState.endpointObservationMap.values());

    for (const observation of endpointObservations) {
      if (!observation.deviceName && !observation.portName) continue;

      const status = observation.state === "ACTIVE" ? "ACTIVE" : "INCONSISTENT";
      const assignmentKey = [
        observation.poleId,
        observation.deviceName || "",
        observation.portName || "",
        status,
      ].join("|");

      if (!fiberState.assignmentKeySet.has(assignmentKey)) {
        fiberState.assignmentKeySet.add(assignmentKey);
        fiberState.assignments.push({
          deviceName: observation.deviceName,
          portName: observation.portName,
          status,
        });
      }
    }

    return {
      bufferColor: fiberState.bufferColor,
      fiberColor: fiberState.fiberColor,
      bufferIndex: fiberState.bufferIndex,
      fiberIndex: fiberState.fiberIndex,
      direction: fiberState.direction,
      wavelength: fiberState.wavelength,
      connectionType: fiberState.connectionType,
      assignments: fiberState.assignments,
      endpointObservations,
    };
  });

  return {
    data: {
      name: sheathName,
      projectId,
      ...(endpointMap.size > 0
        ? {
            endpoints: {
              create: Array.from(endpointMap.values()),
            },
          }
        : {}),
      ...(fiberRecords.length > 0
        ? {
            fiberRecords: {
              create: fiberRecords.map((fiberRecord) => ({
                bufferColor: fiberRecord.bufferColor,
                fiberColor: fiberRecord.fiberColor,
                bufferIndex: fiberRecord.bufferIndex,
                fiberIndex: fiberRecord.fiberIndex,
                direction: fiberRecord.direction,
                wavelength: fiberRecord.wavelength,
                connectionType: fiberRecord.connectionType,
                ...(fiberRecord.assignments.length > 0
                  ? {
                      assignments: {
                        create: fiberRecord.assignments,
                      },
                    }
                  : {}),
                ...(fiberRecord.endpointObservations.length > 0
                  ? {
                      endpointObservations: {
                        create: fiberRecord.endpointObservations.map((observation) => ({
                          poleId: observation.poleId,
                          role: observation.role,
                          connectionType: observation.connectionType,
                          rawConnection: observation.rawConnection,
                          wavelength: observation.wavelength,
                          deviceName: observation.deviceName,
                          portName: observation.portName,
                          state: observation.state,
                        })),
                      },
                    }
                  : {}),
              })),
            },
          }
        : {}),
    },
    summary: {
      endpointCount: endpointMap.size,
      fiberRecordCount: fiberRecords.length,
      assignmentCount: fiberRecords.reduce((sum, fiberRecord) => sum + fiberRecord.assignments.length, 0),
      endpointObservationCount: fiberRecords.reduce(
        (sum, fiberRecord) => sum + fiberRecord.endpointObservations.length,
        0
      ),
    },
  };
}

function buildProjectMetadata(parsed, verification) {
  return {
    fileType: parsed.fileType,
    map: {
      selectedSheets: verification.map.selectedSheets,
      ignoredSheets: verification.map.ignoredSheets,
      warnings: verification.map.warnings,
    },
    fiber: verification.fiber
      ? {
          sheetsUsed: verification.fiber.sheetsUsed,
          warnings: verification.fiber.warnings,
          inconsistencies: verification.fiber.summary.inconsistencies,
          missingPoleNames: verification.fiber.crossReference.missingPoleNames,
        }
      : null,
    warnings: verification.warnings,
  };
}

export async function persistParsedImport(tx, input, createdById, parsed, verification) {
  const basePoles = parsed.mapData?.poles || [];
  const extraFiberPoleNames = verification.fiber?.crossReference?.missingPoleNames || [];
  const uniquePoles = new Map();

  for (const pole of basePoles) {
    const key = normalizeKey(pole.poleNumber);
    if (!key || uniquePoles.has(key)) continue;
    uniquePoles.set(key, {
      poleNumber: pole.poleNumber,
      streetName: pole.streetName || null,
      lat: pole.lat ?? 0,
      lng: pole.lng ?? 0,
    });
  }

  for (const poleName of extraFiberPoleNames) {
    const key = normalizeKey(poleName);
    if (!key || uniquePoles.has(key)) continue;
    uniquePoles.set(key, {
      poleNumber: poleName,
      streetName: null,
      lat: 0,
      lng: 0,
    });
  }

  const project = await tx.project.create({
    data: {
      prismId: input.prismId,
      name: input.name,
      node: input.node,
      instance: input.instance || "DEFAULT",
      status: "ACTIVE",
      totalPassings: uniquePoles.size,
      sourceFilePath: input.filePath,
      createdById,
      importMetadata: buildProjectMetadata(parsed, verification),
    },
  });

  const poleMap = new Map();
  for (const pole of uniquePoles.values()) {
    const createdPole = await tx.pole.create({
      data: {
        ...pole,
        projectId: project.id,
      },
    });
    poleMap.set(normalizeKey(createdPole.poleNumber), createdPole);
  }

  let segmentsCreated = 0;
  for (const segment of parsed.mapData?.rawSegments || []) {
    const fromPole = poleMap.get(normalizeKey(segment.from));
    const toPole = poleMap.get(normalizeKey(segment.to));
    if (!fromPole || !toPole) continue;

    await tx.fiberSegment.create({
      data: {
        lengthFt: segment.lengthFt,
        projectId: project.id,
        fromPoleId: fromPole.id,
        toPoleId: toPole.id,
      },
    });
    segmentsCreated++;
  }

  let sheathsCreated = 0;
  let fiberRecordsCreated = 0;
  let assignmentsCreated = 0;
  let endpointObservationsCreated = 0;
  const virtualPolesCreated = extraFiberPoleNames.length;

  if (parsed.fiberData?.records?.length) {
    const recordsBySheath = groupSheathRecords(parsed.fiberData.records);

    for (const [sheathName, sheathRecords] of recordsBySheath.entries()) {
      const sheathInput = buildSheathCreateInput(project.id, sheathName, sheathRecords, poleMap);
      await tx.sheath.create({ data: sheathInput.data });
      sheathsCreated++;
      fiberRecordsCreated += sheathInput.summary.fiberRecordCount;
      assignmentsCreated += sheathInput.summary.assignmentCount;
      endpointObservationsCreated += sheathInput.summary.endpointObservationCount;
    }
  }

  return {
    project,
    summary: {
      polesCreated: uniquePoles.size,
      virtualPolesCreated,
      segmentsCreated,
      sheathsCreated,
      fiberRecordsCreated,
      assignmentsCreated,
      endpointObservationsCreated,
    },
    verification,
    warnings: verification.warnings,
  };
}
