import { annotateFibersForPole, summarizeAnnotatedFibers } from "./fusion-planner.js";

function buildAssignmentLabel(assignment) {
  const parts = [];
  if (assignment.deviceName) parts.push(assignment.deviceName);
  if (assignment.portName) parts.push(assignment.portName);
  return parts.join(" - ");
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function buildSheathLabel(sheathName, connectedPoleNumbers) {
  if (!sheathName) {
    return connectedPoleNumbers.length > 0
      ? `the sheath toward ${connectedPoleNumbers.join(", ")}`
      : "this sheath";
  }

  if (isUuidLike(sheathName)) {
    return connectedPoleNumbers.length > 0
      ? `the sheath toward ${connectedPoleNumbers.join(", ")}`
      : "this sheath";
  }

  return sheathName;
}

function buildFiberAction(fiber, sheathName, role, connectedPoleNumbers) {
  if (!fiber.operationalNeedFusion) return null;

  const direction = fiber.direction ? ` ${String(fiber.direction).toLowerCase()}` : "";
  const connectedLabel = connectedPoleNumbers.length > 0
    ? ` toward ${connectedPoleNumbers.join(", ")}`
    : "";
  const sheathLabel = buildSheathLabel(sheathName, connectedPoleNumbers);
  const assignmentLabel = fiber.assignments.length > 0
    ? fiber.assignments.map(buildAssignmentLabel).filter(Boolean).join(", ")
    : "missing assignment";
  const endpointLabel = role === "END" ? "tail endpoint" : "start endpoint";

  return `Fuse ${fiber.fiberColor} fiber in ${fiber.bufferColor} tube${direction} on ${sheathLabel}${connectedLabel} (${endpointLabel}) - ${assignmentLabel || "missing assignment"}`;
}

export function buildPoleDetail(pole) {
  const sheathMap = new Map();
  const segmentNeighbors = [];

  for (const segment of pole.segmentsFrom || []) {
    if (segment.toPole) {
      segmentNeighbors.push({
        id: segment.id,
        lengthFt: segment.lengthFt,
        pole: segment.toPole,
        direction: "outbound",
      });
    }
  }

  for (const segment of pole.segmentsTo || []) {
    if (segment.fromPole) {
      segmentNeighbors.push({
        id: segment.id,
        lengthFt: segment.lengthFt,
        pole: segment.fromPole,
        direction: "inbound",
      });
    }
  }

  for (const endpoint of pole.sheathEndpoints || []) {
    const sheath = endpoint.sheath;
    if (!sheath) continue;

    const connectedPoleNumbers = Array.from(
      new Set(
        (sheath.endpoints || [])
          .filter((candidate) => candidate.poleId !== pole.id)
          .map((candidate) => candidate.pole?.poleNumber)
          .filter(Boolean)
      )
    );

    const fibers = annotateFibersForPole({
      pole,
      endpoint,
      fiberRecords: sheath.fiberRecords,
    });
    const summary = summarizeAnnotatedFibers(fibers);
    const actions = fibers
      .map((fiber) => buildFiberAction(fiber, sheath.name, endpoint.role, connectedPoleNumbers))
      .filter(Boolean);

    sheathMap.set(sheath.id, {
      id: sheath.id,
      name: sheath.name,
      role: endpoint.role,
      connectedPoleNumbers,
      summary,
      fibers,
      actions,
    });
  }

  const sheaths = Array.from(sheathMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const overallSummary = sheaths.reduce(
    (acc, sheath) => {
      acc.sheathCount++;
      acc.activeCount += sheath.summary.activeCount;
      acc.darkCount += sheath.summary.darkCount;
      acc.needFusionOperationalCount += sheath.summary.needFusionOperationalCount;
      acc.inconsistencyCount += sheath.summary.inconsistencyCount;
      acc.actionCount += sheath.actions.length;
      return acc;
    },
    {
      sheathCount: 0,
      activeCount: 0,
      darkCount: 0,
      needFusionOperationalCount: 0,
      inconsistencyCount: 0,
      actionCount: 0,
    }
  );

  const taskCount = sheaths.reduce((count, sheath) => count + sheath.actions.length, 0);
  const nextAction = sheaths.flatMap((sheath) => sheath.actions)[0] || null;
  const workStatus = taskCount > 0
    ? "NEEDS_WORK"
    : overallSummary.activeCount > 0
      ? "CONNECTED"
      : overallSummary.darkCount > 0
        ? "DARK_ONLY"
        : "NO_DATA";

  return {
    id: pole.id,
    poleNumber: pole.poleNumber,
    streetName: pole.streetName,
    status: pole.status,
    lat: pole.lat,
    lng: pole.lng,
    projectId: pole.projectId,
    summary: {
      ...overallSummary,
      inconsistentCount: overallSummary.needFusionOperationalCount,
      equipmentCount: (pole.equipment || []).length,
      connectedPoleCount: segmentNeighbors.length,
    },
    work: {
      status: workStatus,
      taskCount,
      nextAction,
    },
    equipment: (pole.equipment || []).map((equipment) => ({
      id: equipment.id,
      tag: equipment.tag,
      name: equipment.name,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      equipType: equipment.equipType,
      portCount: equipment.portCount,
    })),
    connectedPoles: segmentNeighbors,
    sheaths,
  };
}
