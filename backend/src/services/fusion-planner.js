import { getFiberColorIndex } from "./fiber-assignment-engine.js";

function normalizeKey(value) {
  if (value == null) return "";
  return String(value).trim().toUpperCase();
}

function hasAssignmentData(candidate) {
  return Boolean(candidate?.deviceName || candidate?.portName);
}

function matchesPoleAssignment(assignment, pole) {
  if (!hasAssignmentData(assignment)) return false;

  const deviceKey = normalizeKey(assignment.deviceName);
  const poleKey = normalizeKey(pole?.poleNumber);
  if (!poleKey) return Boolean(deviceKey || assignment.portName);
  if (!deviceKey) return true;
  return deviceKey === poleKey || deviceKey.includes(poleKey);
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

export function isOperationalNeedFusion(observation) {
  return observation?.state === "NEEDS_FUSION" && hasAssignmentData(observation);
}

export function hasDataInconsistency(fiberRecord) {
  const assignmentStatuses = new Set((fiberRecord.assignments || []).map((assignment) => assignment.status));
  if (assignmentStatuses.has("INCONSISTENT")) return true;
  if (assignmentStatuses.has("ACTIVE")) return false;
  if (assignmentStatuses.has("DARK")) return false;

  const hasWavelength = fiberRecord.wavelength != null && fiberRecord.wavelength !== "";
  if (fiberRecord.connectionType === "FUSION" && hasWavelength) return false;
  if (fiberRecord.connectionType === "DARK" && !hasWavelength) return false;
  return true;
}

function compareFibers(a, b) {
  const bufferDelta = (a.bufferIndex ?? getFiberColorIndex(a.bufferColor)) - (b.bufferIndex ?? getFiberColorIndex(b.bufferColor));
  if (bufferDelta !== 0) return bufferDelta;

  return (a.fiberIndex ?? getFiberColorIndex(a.fiberColor)) - (b.fiberIndex ?? getFiberColorIndex(b.fiberColor));
}

export function annotateFibersForPole({ pole, endpoint, fiberRecords }) {
  return (fiberRecords || [])
    .map((fiberRecord) => {
      const observation = getPoleFiberObservation(pole, endpoint, fiberRecord);
      const operationalNeedFusion = isOperationalNeedFusion(observation);
      const dataIssue = hasDataInconsistency(fiberRecord);
      const status = operationalNeedFusion
        ? "INCONSISTENT"
        : observation.state === "ACTIVE"
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
        operationalNeedFusion,
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
      if (fiber.status === "ACTIVE") acc.activeCount++;
      else if (fiber.status === "DARK") acc.darkCount++;
      else acc.needFusionOperationalCount++;

      if (fiber.dataIssue) acc.inconsistencyCount++;
      return acc;
    },
    {
      activeCount: 0,
      darkCount: 0,
      needFusionOperationalCount: 0,
      inconsistencyCount: 0,
    }
  );
}
