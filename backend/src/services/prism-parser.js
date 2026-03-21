import AdmZip from "adm-zip";

const POLE_REGEX = /\b\d{5}\b/g;
const FEET_REGEX = /\b(\d+)'(?:\b|$)/g;
const STREET_REGEX = /(?:Road|Street|Highway|Lane|Drive)/i;

export function parsePrismBuffer(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const poles = new Map();
  const rawSegments = [];
  let pageCount = 0;

  for (const entry of entries) {
    if (!entry.entryName.toLowerCase().endsWith(".txt")) continue;
    pageCount++;
    const content = entry.getData().toString("utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const poleMatches = line.match(POLE_REGEX);
      if (poleMatches) {
        let streetName = null;
        if (STREET_REGEX.test(line)) {
          streetName = line.trim();
        }
        for (const p of poleMatches) {
          if (!poles.has(p)) {
            poles.set(p, { poleNumber: p, streetName: streetName || "" });
          } else if (streetName && !poles.get(p).streetName) {
            poles.set(p, { poleNumber: p, streetName });
          }
        }
      }

      const feetMatches = [...line.matchAll(FEET_REGEX)];
      if (feetMatches.length > 0) {
        const poleNums = line.match(POLE_REGEX);
        if (poleNums && poleNums.length >= 2) {
          const lengthFt = parseInt(feetMatches[0][1], 10) || 0;
          rawSegments.push({
            from: poleNums[0],
            to: poleNums[1],
            lengthFt,
          });
        }
      }
    }
  }

  return {
    poles: Array.from(poles.values()),
    rawSegments,
    metadata: { pageCount },
  };
}
