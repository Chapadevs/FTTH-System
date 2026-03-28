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
          connectionType: "FUSION",
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
          connectionType: "FUSION",
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

  it("counts a demanded inconsistent fiber on upstream distribution poles too", () => {
    const pole = { id: "pole-dist", poleNumber: "MWC2302D003" };
    const endpoint = { role: "START" };
    const [fiber] = annotateFibersForPole({
      pole,
      endpoint,
      fiberRecords: [
        {
          id: "fiber-upstream",
          bufferColor: "BLUE",
          fiberColor: "SLATE",
          bufferIndex: 0,
          fiberIndex: 4,
          direction: null,
          wavelength: null,
          connectionType: "FUSION",
          assignments: [
            { id: "client-1", deviceName: "MWC23020013", portName: "PORT1", status: "INCONSISTENT" },
            { id: "blank-1", deviceName: null, portName: null, status: "INCONSISTENT" },
          ],
        },
      ],
    });

    assert.strictEqual(fiber.operationalNeedFusion, true);
    assert.strictEqual(fiber.status, "INCONSISTENT");
  });

  it("treats MECHANICAL continuity strands as not field-fusion work", () => {
    const pole = { id: "pole-a", poleNumber: "MWC2302D018" };
    const endpoint = { role: "END" };
    const [fiber] = annotateFibersForPole({
      pole,
      endpoint,
      fiberRecords: [
        {
          id: "fiber-mech",
          bufferColor: "BROWN",
          fiberColor: "GREEN",
          bufferIndex: 2,
          fiberIndex: 1,
          direction: null,
          wavelength: null,
          connectionType: "MECHANICAL",
          endpointObservations: [
            {
              poleId: "pole-a",
              role: "END",
              connectionType: "MECHANICAL",
              rawConnection: "<- MECHANICAL ->",
              wavelength: null,
              deviceName: null,
              portName: null,
              state: "DARK",
            },
          ],
          assignments: [],
        },
      ],
    });

    assert.strictEqual(fiber.pendingFieldFusion, false);
    assert.strictEqual(fiber.operationalNeedFusion, false);
  });

  it("does not create fusion tasks for DARK rows even with assignment metadata", () => {
    const pole = { id: "pole-13", poleNumber: "MWC23020013" };
    const endpoint = { role: "END" };
    const [fiber] = annotateFibersForPole({
      pole,
      endpoint,
      fiberRecords: [
        {
          id: "fiber-dark-assigned",
          bufferColor: "BLUE",
          fiberColor: "BLACK",
          bufferIndex: 0,
          fiberIndex: 7,
          direction: null,
          wavelength: null,
          connectionType: "DARK",
          endpointObservations: [
            {
              poleId: "pole-13",
              role: "END",
              connectionType: "DARK",
              rawConnection: "<- CONTINUOUS ->",
              wavelength: null,
              deviceName: "MWC23020013",
              portName: "PORT9",
              state: "NEEDS_FUSION",
            },
          ],
          assignments: [
            { id: "assignment-dark", deviceName: "MWC23020013", portName: "PORT9", status: "INCONSISTENT" },
          ],
        },
      ],
    });

    assert.strictEqual(fiber.connectionType, "DARK");
    assert.strictEqual(fiber.operationalNeedFusion, false);
    assert.strictEqual(fiber.status, "DARK");
  });
});
