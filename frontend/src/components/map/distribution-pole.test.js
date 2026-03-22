import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectServedPoleLookup,
  decorateMapPole,
  isDistributionPole,
} from "./distribution-pole.js";

test("identifies distribution poles by pole number pattern", () => {
  assert.equal(isDistributionPole("MWC2302D003"), true);
  assert.equal(isDistributionPole("MWC23020013"), false);
});

test("builds direct served poles excluding distribution neighbors", () => {
  const poles = [
    { id: "dist-1", poleNumber: "MWC2302D003", streetName: "Hub Road" },
    { id: "dist-2", poleNumber: "MWC2302D007", streetName: "Hub Road" },
    { id: "pole-1", poleNumber: "MWC23020013", streetName: "Concord Church Road" },
    { id: "pole-2", poleNumber: "MWC23020014", streetName: "Concord Church Road" },
  ];
  const segments = [
    { fromPole: { id: "dist-1" }, toPole: { id: "dist-2" } },
    { fromPole: { id: "dist-1" }, toPole: { id: "pole-1" } },
    { fromPole: { id: "dist-1" }, toPole: { id: "pole-2" } },
  ];

  const servedLookup = buildDirectServedPoleLookup(poles, segments);
  const servedPoles = servedLookup.get("dist-1");

  assert.deepEqual(
    servedPoles.map((pole) => pole.poleNumber),
    ["MWC23020013", "MWC23020014"]
  );

  const decorated = decorateMapPole(poles[0], servedLookup);
  assert.equal(decorated.distribution.isDistribution, true);
  assert.equal(decorated.distribution.directServedPoleCount, 2);
});
