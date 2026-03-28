import { getFiberColorIndex } from "./fiber-assignment-engine.js";

function normalizeKey(value) {
  if (value == null) return "";
  return String(value).trim().toUpperCase();
}

function hasAssignmentData(candidate) {
  return Boolean(candidate?.deviceName || candidate?.portName);
}

function getMeaningfulAssignments(fiberRecord) {
  return (fiberRecord.assignments || []).filter(hasAssignmentData);
}

export function matchesPoleAssignment(assignment, pole) {
  if (!hasAssignmentData(assignment)) return false;

  const deviceKey = normalizeKey(assignment.deviceName);
  const poleKey = normalizeKey(pole?.poleNumber);
  if (!poleKey) return Boolean(deviceKey || assignment.portName);
  if (!deviceKey) return true;
  return deviceKey === poleKey || deviceKey.includes(poleKey);
}

/** Splitter fan-out row in design data: Out-n port on a named splitter (not a tail drop). */
export function isSplitterDesignOutputObservation(observation) {
  if (!observation) return false;
  const port = String(observation.portName || "").trim();
  const device = String(observation.deviceName || "").toUpperCase();
  if (!port) return false;
  const isOutPort = /^Out-\d+/i.test(port) || /^OUT-\d+/i.test(port);
  if (!isOutPort) return false;
  return (
    device.includes("SPL") ||
    device.includes("SPLITTER") ||
    /\d+X\d+/i.test(device) ||
    device.includes("FTTX")
  );
}

function isSplitterOutputAssignment(assignment) {
  const port = String(assignment.portName || "").trim();
  const dev = String(assignment.deviceName || "").toUpperCase();
  const isOut = /^Out-\d+/i.test(port) || /^OUT-\d+/i.test(port);
  if (!isOut) return false;
  return (
    dev.includes("SPL") ||
    dev.includes("SPLITTER") ||
    /\d+X\d+/i.test(dev) ||
    dev.includes("FTTX")
  );
}

/** Record is dominated by splitter output ports (PRISM export); scope pending work per pole. */
function isSplitterFanOutRecord(fiberRecord) {
  const meaningful = getMeaningfulAssignments(fiberRecord);
  if (meaningful.length === 0) return false;
  return meaningful.every(isSplitterOutputAssignment);
}

function fallbackObservationState(fiberRecord, assignment) {
  if (assignment?.status === "ACTIVE") return "ACTIVE";
  if (assignment?.status === "INCONSISTENT") return "NEEDS_FUSION";
  if (fiberRecord.connectionType === "FUSION" && fiberRecord.wavelength != null) return "ACTIVE";
  return "DARK";
}

export function getPoleFiberObservation(pole, endpoint, fiberRecord) {
  const directObservation = (fiberRecord.endpointObservations || []).find(
    (observation) => observation.poleId === pole.id
  );
  if (directObservation) return directObservation;

  const localAssignment =
    (fiberRecord.assignments || []).find((assignment) => matchesPoleAssignment(assignment, pole)) ||
    null;

  return {
    poleId: pole.id,
    role: endpoint?.role ?? null,
    connectionType: fiberRecord.connectionType,
    rawConnection: null,
    wavelength: fiberRecord.wavelength,
    deviceName: localAssignment?.deviceName ?? null,
    portName: localAssignment?.portName ?? null,
    state: fallbackObservationState(fiberRecord, localAssignment),
  };
}

export function hasDataInconsistency(fiberRecord) {
  const assignmentStatuses = new Set((fiberRecord.assignments || []).map((assignment) => assignment.status));
  if (assignmentStatuses.has("INCONSISTENT")) return true;
  if (assignmentStatuses.has("ACTIVE")) return false;
  if (assignmentStatuses.has("DARK")) return false;

  const hasWavelength = fiberRecord.wavelength != null && fiberRecord.wavelength !== "";
  if (fiberRecord.connectionType === "MECHANICAL") {
    return hasWavelength;
  }
  if (fiberRecord.connectionType === "FUSION" && hasWavelength) return false;
  if (fiberRecord.connectionType === "DARK" && !hasWavelength) return false;
  return true;
}

/**
 * Field splice still required at this pole (technician work), excluding modeled splitter outputs.
 */
export function isPendingFieldFusion(observation, fiberRecord, pole) {
  if (fiberRecord?.connectionType === "MECHANICAL") return false;
  if (fiberRecord?.connectionType !== "FUSION") return false;
  if (observation?.state === "ACTIVE") return false;

  if (observation?.state === "NEEDS_FUSION" && hasAssignmentData(observation)) {
    if (isSplitterDesignOutputObservation(observation)) return false;
    return true;
  }

  if (!hasDataInconsistency(fiberRecord)) return false;

  const meaningful = getMeaningfulAssignments(fiberRecord);
  const poleScopedDemand = meaningful.some((a) => matchesPoleAssignment(a, pole));

  if (isSplitterFanOutRecord(fiberRecord)) {
    return poleScopedDemand || hasAssignmentData(observation);
  }

  const demandedByAssignment = meaningful.length > 0;
  const demandedByObservation = hasAssignmentData(observation);
  return demandedByAssignment || demandedByObservation;
}

/** Design-modeled fusion (e.g. splitter Out-n) — not counted as outstanding field fusion. */
export function isLogicalModeledFusion(observation, fiberRecord, pendingFieldFusion) {
  if (pendingFieldFusion) return false;
  if (fiberRecord?.connectionType !== "FUSION") return false;
  if (observation?.state === "ACTIVE") return false;
  return isSplitterDesignOutputObservation(observation);
}

export function isOperationalNeedFusion(observation, fiberRecord, pole) {
  return isPendingFieldFusion(observation, fiberRecord, pole);
}

export function annotateFibersForPole({ pole, endpoint, fiberRecords }) {
  return (fiberRecords || [])
    .map((fiberRecord) => {
      const observation = getPoleFiberObservation(pole, endpoint, fiberRecord);
      const pendingFieldFusion = isPendingFieldFusion(observation, fiberRecord, pole);
      const logicalModeledFusion = isLogicalModeledFusion(observation, fiberRecord, pendingFieldFusion);
      const dataIssue = hasDataInconsistency(fiberRecord) && !logicalModeledFusion;

      const status = pendingFieldFusion
        ? "INCONSISTENT"
        : observation.state === "ACTIVE"
          ? "ACTIVE"
          : logicalModeledFusion
            ? "ACTIVE"
            : "DARK";

      return {
        id: fiberRecord.id,
        bufferColor: fiberRecord.bufferColor,
        fiberColor: fiberRecord.fiberColor,
        bufferIndex: fiberRecord.bufferIndex,
        fiberIndex: fiberRecord.fiberIndex,
        direction: fiberRecord.direction,
        wavelength: fiberRecord.wavelength,
        connectionType: fiberRecord.connectionType,
        status,
        pendingFieldFusion,
        logicalModeledFusion,
        operationalNeedFusion: pendingFieldFusion,
        dataIssue,
        observation,
        assignments: (fiberRecord.assignments || []).map((assignment) => ({
          id: assignment.id,
          deviceName: assignment.deviceName,
          portName: assignment.portName,
          status: assignment.status,
          equipment: assignment.equipment
            ? {
                id: assignment.equipment.id,
                tag: assignment.equipment.tag,
                name: assignment.equipment.name,
                equipType: assignment.equipment.equipType,
              }
            : null,
        })),
      };
    })
    .sort(compareFibers);
}

export function summarizeAnnotatedFibers(fibers) {
  return fibers.reduce(
    (acc, fiber) => {
      if (fiber.pendingFieldFusion) {
        acc.pendingFieldFusionCount++;
        acc.needFusionOperationalCount++;
      } else if (fiber.status === "ACTIVE") {
        acc.activeCount++;
        if (fiber.logicalModeledFusion) acc.logicalFusionModeledCount++;
      } else {
        acc.darkCount++;
      }

      if (fiber.dataIssue) acc.inconsistencyCount++;
      return acc;
    },
    {
      activeCount: 0,
      darkCount: 0,
      needFusionOperationalCount: 0,
      pendingFieldFusionCount: 0,
      logicalFusionModeledCount: 0,
      inconsistencyCount: 0,
    }
  );
}

function compareFibers(a, b) {
  const bufferDelta = (a.bufferIndex ?? getFiberColorIndex(a.bufferColor)) - (b.bufferIndex ?? getFiberColorIndex(b.bufferColor));
  if (bufferDelta !== 0) return bufferDelta;

  return (a.fiberIndex ?? getFiberColorIndex(a.fiberColor)) - (b.fiberIndex ?? getFiberColorIndex(b.fiberColor));
}
