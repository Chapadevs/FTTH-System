function deriveFiberStatus(fiberRecord) {
  const assignmentStatuses = new Set((fiberRecord.assignments || []).map((assignment) => assignment.status));
  if (assignmentStatuses.has("INCONSISTENT")) return "INCONSISTENT";
  if (assignmentStatuses.has("ACTIVE")) return "ACTIVE";
  if (assignmentStatuses.has("DARK")) return "DARK";

  const hasWavelength = fiberRecord.wavelength != null && fiberRecord.wavelength !== "";
  if (fiberRecord.connectionType === "FUSION" && hasWavelength) return "ACTIVE";
  if (fiberRecord.connectionType === "DARK" && !hasWavelength) return "DARK";
  return fiberRecord.connectionType === "FUSION" ? "ACTIVE" : "INCONSISTENT";
}

function buildAssignmentLabel(assignment) {
  const parts = [];
  if (assignment.deviceName) parts.push(assignment.deviceName);
  if (assignment.portName) parts.push(assignment.portName);
  return parts.join(" - ") || "No assignment";
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
  if (fiber.status !== "INCONSISTENT") return null;

  const direction = fiber.direction ? ` ${String(fiber.direction).toLowerCase()}` : "";
  const connectedLabel = connectedPoleNumbers.length > 0
    ? ` toward ${connectedPoleNumbers.join(", ")}`
    : "";
  const sheathLabel = buildSheathLabel(sheathName, connectedPoleNumbers);
  const assignmentLabel = fiber.assignments.length > 0
    ? fiber.assignments.map(buildAssignmentLabel).join(", ")
    : "missing assignment";

  return `Fuse ${fiber.fiberColor} fiber in ${fiber.bufferColor} tube${direction} on ${sheathLabel}${connectedLabel} (${role.toLowerCase()} end) - ${assignmentLabel}`;
}

function summarizeFibers(fibers) {
  return fibers.reduce(
    (acc, fiber) => {
      if (fiber.status === "ACTIVE") acc.activeCount++;
      else if (fiber.status === "DARK") acc.darkCount++;
      else acc.inconsistentCount++;
      return acc;
    },
    { activeCount: 0, darkCount: 0, inconsistentCount: 0 }
  );
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

    const fibers = (sheath.fiberRecords || [])
      .map((fiberRecord) => {
        const status = deriveFiberStatus(fiberRecord);
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
      .sort((a, b) => a.bufferIndex - b.bufferIndex || a.fiberIndex - b.fiberIndex);

    const summary = summarizeFibers(fibers);
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
      acc.inconsistentCount += sheath.summary.inconsistentCount;
      acc.actionCount += sheath.actions.length;
      return acc;
    },
    {
      sheathCount: 0,
      activeCount: 0,
      darkCount: 0,
      inconsistentCount: 0,
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
