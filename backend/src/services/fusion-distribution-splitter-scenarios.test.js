import { describe, it } from "node:test";
import assert from "node:assert";
import { buildPoleDetail } from "./pole-detail.js";
import { annotateFibersForPole, summarizeAnnotatedFibers } from "./fusion-planner.js";

describe("fusion distribution / splitter scenarios", () => {
  it("does not count modeled splitter Out-n fusion rows as field-pending at the splitter pole", () => {
    const pole = { id: "pole-s007", poleNumber: "MWC2302S007" };
    const endpoint = { role: "END" };
    const fibers = [];
    for (let i = 1; i <= 6; i++) {
      fibers.push({
        id: `fiber-out-${i}`,
        bufferColor: "BLUE",
        fiberColor: "BLUE",
        bufferIndex: 0,
        fiberIndex: 0,
        direction: null,
        wavelength: null,
        connectionType: "FUSION",
        endpointObservations: [
          {
            poleId: "pole-s007",
            role: "END",
            connectionType: "FUSION",
            rawConnection: "<- FUSION ->",
            wavelength: null,
            deviceName: "FTTX_CO_1X32_SPL-01",
            portName: `Out-${i}`,
            state: "NEEDS_FUSION",
          },
        ],
        assignments: [
          {
            id: `asg-${i}`,
            deviceName: "FTTX_CO_1X32_SPL-01",
            portName: `Out-${i}`,
            status: "INCONSISTENT",
            equipment: null,
          },
        ],
      });
    }

    const annotated = annotateFibersForPole({ pole, endpoint, fiberRecords: fibers });
    assert.ok(annotated.every((f) => !f.pendingFieldFusion));
    assert.ok(annotated.every((f) => f.logicalModeledFusion));
    const summary = summarizeAnnotatedFibers(annotated);
    assert.strictEqual(summary.needFusionOperationalCount, 0);
    assert.strictEqual(summary.pendingFieldFusionCount, 0);
    assert.strictEqual(summary.logicalFusionModeledCount, 6);
  });

  it("still requires field fusion for Common / tail ports that are not splitter Out-n", () => {
    const pole = { id: "pole-d020", poleNumber: "MWC2302D020" };
    const endpoint = { role: "END" };
    const fibers = annotateFibersForPole({
      pole,
      endpoint,
      fiberRecords: [
        {
          id: "fiber-common",
          bufferColor: "ORANGE",
          fiberColor: "BLUE",
          bufferIndex: 1,
          fiberIndex: 0,
          direction: null,
          wavelength: null,
          connectionType: "FUSION",
          endpointObservations: [
            {
              poleId: "pole-d020",
              role: "END",
              connectionType: "FUSION",
              wavelength: null,
              deviceName: "MWC2302D020_CO_1X2_SPL_01",
              portName: "Common",
              state: "NEEDS_FUSION",
            },
          ],
          assignments: [
            {
              id: "a1",
              deviceName: "MWC2302D020_CO_1X2_SPL_01",
              portName: "Common",
              status: "INCONSISTENT",
              equipment: null,
            },
          ],
        },
        {
          id: "fiber-tail",
          bufferColor: "BLUE",
          fiberColor: "SLATE",
          bufferIndex: 0,
          fiberIndex: 4,
          direction: null,
          wavelength: null,
          connectionType: "FUSION",
          endpointObservations: [
            {
              poleId: "pole-d020",
              role: "END",
              connectionType: "FUSION",
              wavelength: null,
              deviceName: "MWC23020013",
              portName: "PORT1",
              state: "NEEDS_FUSION",
            },
          ],
          assignments: [
            {
              id: "a2",
              deviceName: "MWC23020013",
              portName: "PORT1",
              status: "INCONSISTENT",
              equipment: null,
            },
          ],
        },
      ],
    });

    assert.strictEqual(fibers.filter((f) => f.pendingFieldFusion).length, 2);
    const summary = summarizeAnnotatedFibers(fibers);
    assert.strictEqual(summary.needFusionOperationalCount, 2);
    assert.strictEqual(summary.logicalFusionModeledCount, 0);
  });

  it("aggregate pole detail exposes modeled splitter outs separately from field-pending count", () => {
    const detail = buildPoleDetail({
      id: "pole-s007",
      poleNumber: "MWC2302S007",
      streetName: null,
      status: "ACTIVE",
      lat: 39.47,
      lng: -82.08,
      projectId: "p1",
      equipment: [],
      segmentsFrom: [],
      segmentsTo: [],
      sheathEndpoints: [
        {
          role: "END",
          sheath: {
            id: "sheath-72",
            name: "48CT MWC2302S007 TO MWC23020072",
            endpoints: [
              { poleId: "pole-72", pole: { id: "pole-72", poleNumber: "MWC23020072" } },
              { poleId: "pole-s007", pole: { id: "pole-s007", poleNumber: "MWC2302S007" } },
            ],
            fiberRecords: [1, 2, 3].map((i) => ({
              id: `f-${i}`,
              bufferColor: "BLUE",
              fiberColor: i === 1 ? "BLUE" : i === 2 ? "ORANGE" : "GREEN",
              bufferIndex: 0,
              fiberIndex: i - 1,
              direction: null,
              wavelength: null,
              connectionType: "FUSION",
              endpointObservations: [
                {
                  poleId: "pole-s007",
                  role: "END",
                  connectionType: "FUSION",
                  deviceName: "FTTX_CO_1X32_SPL-01",
                  portName: `Out-${i}`,
                  state: "NEEDS_FUSION",
                },
              ],
              assignments: [
                {
                  id: `as-${i}`,
                  deviceName: "FTTX_CO_1X32_SPL-01",
                  portName: `Out-${i}`,
                  status: "INCONSISTENT",
                  equipment: null,
                },
              ],
            })),
          },
        },
      ],
    });

    assert.strictEqual(detail.summary.needFusionOperationalCount, 0);
    assert.strictEqual(detail.summary.logicalFusionModeledCount, 3);
    assert.strictEqual(detail.summary.fiberRecordCount, 3);
    assert.strictEqual(detail.work.taskCount, 0);
  });
});
