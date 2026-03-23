function normalizePoleNumber(value) {
  return String(value || "").trim().toUpperCase();
}

export function isDistributionPole(poleOrPoleNumber) {
  const poleNumber =
    typeof poleOrPoleNumber === "string"
      ? poleOrPoleNumber
      : poleOrPoleNumber?.poleNumber;

  return /^[A-Z]+\d+D\d+$/i.test(normalizePoleNumber(poleNumber));
}

export function isSplitterPole(poleOrPoleNumber) {
  const poleNumber =
    typeof poleOrPoleNumber === "string"
      ? poleOrPoleNumber
      : poleOrPoleNumber?.poleNumber;
  const normalizedPoleNumber = normalizePoleNumber(poleNumber);

  if (isDistributionPole(normalizedPoleNumber)) return false;

  return normalizedPoleNumber.includes("_SE_") || /S\d+$/i.test(normalizedPoleNumber);
}

function uniquePolesById(poles) {
  const seen = new Set();

  return poles.filter((pole) => {
    if (!pole?.id || seen.has(pole.id)) return false;
    seen.add(pole.id);
    return true;
  });
}

export function buildDirectServedPoleLookup(poles, segments) {
  const poleById = new Map((poles || []).map((pole) => [pole.id, pole]));
  const neighborMap = new Map();

  function addNeighbor(poleId, neighborId) {
    if (!poleId || !neighborId || poleId === neighborId) return;
    if (!neighborMap.has(poleId)) {
      neighborMap.set(poleId, new Set());
    }
    neighborMap.get(poleId).add(neighborId);
  }

  for (const segment of segments || []) {
    const fromPoleId = segment?.fromPole?.id;
    const toPoleId = segment?.toPole?.id;
    addNeighbor(fromPoleId, toPoleId);
    addNeighbor(toPoleId, fromPoleId);
  }

  const servedLookup = new Map();
  for (const pole of poles || []) {
    if (!isDistributionPole(pole)) continue;

    const neighbors = Array.from(neighborMap.get(pole.id) || [])
      .map((neighborId) => poleById.get(neighborId))
      .filter(Boolean);
    const directServedPoles = uniquePolesById(
      neighbors.filter((neighbor) => !isDistributionPole(neighbor))
    ).sort((a, b) => String(a.poleNumber || "").localeCompare(String(b.poleNumber || "")));

    servedLookup.set(pole.id, directServedPoles);
  }

  return servedLookup;
}

export function buildPoleConnectionCountLookup(poles, segments) {
  const connectionLookup = new Map((poles || []).map((pole) => [pole.id, 0]));

  function incrementConnectionCount(poleId) {
    if (!poleId) return;
    connectionLookup.set(poleId, (connectionLookup.get(poleId) || 0) + 1);
  }

  for (const segment of segments || []) {
    incrementConnectionCount(segment?.fromPole?.id);
    incrementConnectionCount(segment?.toPole?.id);
  }

  return connectionLookup;
}

export function decorateMapPole(pole, servedLookup, connectionLookup) {
  const directServedPoles = servedLookup.get(pole.id) || [];
  const connectedPoleCount =
    connectionLookup?.get?.(pole.id) ??
    pole?.summary?.connectedPoleCount ??
    0;
  const distribution = {
    isDistribution: isDistributionPole(pole),
    directServedPoles,
    directServedPoleCount: directServedPoles.length,
  };

  return {
    ...pole,
    summary: {
      ...(pole.summary || {}),
      connectedPoleCount,
    },
    distribution,
  };
}
