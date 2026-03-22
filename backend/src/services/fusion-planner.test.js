import { describe, it } from "node:test";
import assert from "node:assert";
import { annotateFibersForPole, summarizeAnnotatedFibers } from "./fusion-planner.js";

describe("fusion-planner", () => {
  it("marks only local assigned tail fibers as operational fusion work", () => {
    const pole = { id: "pole-13", poleNumber: "MWC23020013" };
    const endpoint = { role: "END" };
    const fibers = annotateFibersForPole({
      pole,
      endpoint,
      fiberRecords: [
        {
          id: "fiber-green",
          bufferColor: "BLUE",
          fiberColor: "GREEN",
          bufferIndex: 0,
          fiberIndex: 2,
          direction: null,
          wavelength: null,
          connectionType: "DARK",
          assignments: [
            { id: "green-1", deviceName: null, portName: null, status: "INCONSISTENT" },
          ],
        },
        {
          id: "fiber-slate",
          bufferColor: "BLUE",
          fiberColor: "SLATE",
          bufferIndex: 0,
          fiberIndex: 4,
          direction: null,
          wavelength: null,
          connectionType: "FUSION",
          assignments: [
            { id: "slate-1", deviceName: "MWC23020013", portName: "PORT1", status: "INCONSISTENT" },
          ],
        },
      ],
    });

    assert.strictEqual(fibers[0].fiberColor, "GREEN");
    assert.strictEqual(fibers[1].fiberColor, "SLATE");
    assert.strictEqual(fibers[0].operationalNeedFusion, false);
    assert.strictEqual(fibers[1].operationalNeedFusion, true);

    const summary = summarizeAnnotatedFibers(fibers);
    assert.strictEqual(summary.needFusionOperationalCount, 1);
    assert.strictEqual(summary.inconsistencyCount, 2);
  });

  it("prefers endpoint observations when they exist", () => {
    const pole = { id: "pole-13", poleNumber: "MWC23020013" };
    const endpoint = { role: "END" };
    const [fiber] = annotateFibersForPole({
      pole,
      endpoint,
      fiberRecords: [
        {
          id: "fiber-observed",
          bufferColor: "BLUE",
          fiberColor: "SLATE",
          bufferIndex: 0,
          fiberIndex: 4,
          direction: null,
          wavelength: null,
          connectionType: "DARK",
          endpointObservations: [
            {
              poleId: "pole-13",
              role: "END",
              connectionType: "FUSION",
              rawConnection: "<- FUSION ->",
              wavelength: null,
              deviceName: "MWC23020013",
              portName: "PORT1",
              state: "NEEDS_FUSION",
            },
          ],
          assignments: [],
        },
      ],
    });

    assert.strictEqual(fiber.operationalNeedFusion, true);
    assert.strictEqual(fiber.observation.state, "NEEDS_FUSION");
  });
});
