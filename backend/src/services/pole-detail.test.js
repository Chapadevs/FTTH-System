import { describe, it } from "node:test";
import assert from "node:assert";
import { buildPoleDetail } from "./pole-detail.js";

describe("pole-detail", () => {
  it("groups persisted sheaths and builds fiber summary for a pole", () => {
    const detail = buildPoleDetail({
      id: "pole-1",
      poleNumber: "2302E",
      streetName: null,
      status: "PLANNED",
      lat: 39.45,
      lng: -82.07,
      projectId: "project-1",
      equipment: [
        { id: "eq-1", tag: "EQ-1", name: "Splitter", manufacturer: "Acme", model: "S1", equipType: "SPLITTER", portCount: 16 },
      ],
      segmentsFrom: [
        {
          id: "seg-1",
          lengthFt: 120,
          toPole: { id: "pole-2", poleNumber: "MWC23T137", streetName: null, lat: 39.46, lng: -82.08, status: "PLANNED" },
        },
      ],
      segmentsTo: [],
      sheathEndpoints: [
        {
          role: "START",
          sheath: {
            id: "sheath-1",
            name: "12CT MWC23T137 TO 2302E",
            endpoints: [
              { poleId: "pole-1", pole: { id: "pole-1", poleNumber: "2302E" } },
              { poleId: "pole-2", pole: { id: "pole-2", poleNumber: "MWC23T137" } },
            ],
            fiberRecords: [
              {
                id: "fiber-1",
                bufferColor: "BLUE",
                fiberColor: "ORANGE",
                bufferIndex: 0,
                fiberIndex: 1,
                direction: "FORWARD",
                wavelength: 1561.42,
                connectionType: "FUSION",
                assignments: [
                  {
                    id: "assignment-1",
                    deviceName: "2302E_SFP1",
                    portName: "FORWARD",
                    status: "ACTIVE",
                    equipment: null,
                  },
                ],
              },
              {
                id: "fiber-2",
                bufferColor: "BLUE",
                fiberColor: "GREEN",
                bufferIndex: 0,
                fiberIndex: 2,
                direction: "RETURN",
                wavelength: 1550,
                connectionType: "UNKNOWN",
                assignments: [
                  {
                    id: "assignment-2",
                    deviceName: "2302E_SPLITTER",
                    portName: "OUT-2",
                    status: "INCONSISTENT",
                    equipment: null,
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    assert.strictEqual(detail.summary.fiberRecordCount, 2);
    assert.strictEqual(detail.summary.sheathCount, 1);
    assert.strictEqual(detail.summary.activeCount, 1);
    assert.strictEqual(detail.summary.darkCount, 0);
    assert.strictEqual(detail.summary.needFusionOperationalCount, 1);
    assert.strictEqual(detail.summary.inconsistentCount, 1);
    assert.strictEqual(detail.summary.inconsistencyCount, 1);
    assert.strictEqual(detail.summary.equipmentCount, 1);
    assert.strictEqual(detail.connectedPoles.length, 1);
    assert.strictEqual(detail.sheaths[0].connectedPoleNumbers[0], "MWC23T137");
    assert.strictEqual(detail.sheaths[0].actions.length, 1);
    assert.strictEqual(detail.work.status, "NEEDS_WORK");
    assert.strictEqual(detail.work.taskCount, 1);
    assert.match(detail.work.nextAction, /Fuse GREEN fiber in BLUE tube/i);
  });

  it("counts only tail-assigned fusion work for operational tasks", () => {
    const makeDarkMismatch = (id, fiberColor) => ({
      id,
      bufferColor: "BLUE",
      fiberColor,
      bufferIndex: 0,
      fiberIndex: 0,
      direction: null,
      wavelength: null,
      connectionType: "DARK",
      assignments: [
        { id: `${id}-dark`, deviceName: null, portName: null, status: "DARK", equipment: null },
        { id: `${id}-issue`, deviceName: null, portName: null, status: "INCONSISTENT", equipment: null },
      ],
    });

    const detail = buildPoleDetail({
      id: "pole-13",
      poleNumber: "MWC23020013",
      streetName: "Concord Church Road",
      status: "ACTIVE",
      lat: 39.45,
      lng: -82.05,
      projectId: "project-1",
      equipment: [],
      segmentsFrom: [],
      segmentsTo: [],
      sheathEndpoints: [
        {
          role: "END",
          sheath: {
            id: "sheath-a",
            name: "48CT MWC2302D007 TO MWC23020013",
            endpoints: [
              { poleId: "pole-up-a", pole: { id: "pole-up-a", poleNumber: "MWC2302D007" } },
              { poleId: "pole-13", pole: { id: "pole-13", poleNumber: "MWC23020013" } },
            ],
            fiberRecords: [
              makeDarkMismatch("fiber-a-green", "GREEN"),
              makeDarkMismatch("fiber-a-brown", "BROWN"),
            ],
          },
        },
        {
          role: "END",
          sheath: {
            id: "sheath-b",
            name: "48CT MWC23020013 TO MWC2302D003",
            endpoints: [
              { poleId: "pole-up-b", pole: { id: "pole-up-b", poleNumber: "MWC2302D003" } },
              { poleId: "pole-13", pole: { id: "pole-13", poleNumber: "MWC23020013" } },
            ],
            fiberRecords: [
              makeDarkMismatch("fiber-b-blue", "BLUE"),
              makeDarkMismatch("fiber-b-orange", "ORANGE"),
              makeDarkMismatch("fiber-b-green", "GREEN"),
              makeDarkMismatch("fiber-b-brown", "BROWN"),
              {
                id: "fiber-b-slate",
                bufferColor: "BLUE",
                fiberColor: "SLATE",
                bufferIndex: 0,
                fiberIndex: 4,
                direction: null,
                wavelength: null,
                connectionType: "FUSION",
                assignments: [
                  {
                    id: "assignment-local",
                    deviceName: "MWC23020013",
                    portName: "PORT1",
                    status: "INCONSISTENT",
                    equipment: null,
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    assert.strictEqual(detail.summary.fiberRecordCount, 7);
    assert.strictEqual(detail.summary.needFusionOperationalCount, 1);
    assert.strictEqual(detail.summary.actionCount, 1);
    assert.strictEqual(detail.summary.inconsistencyCount, 7);
    assert.strictEqual(detail.work.taskCount, 1);
    assert.match(detail.work.nextAction, /SLATE fiber in BLUE tube/i);
  });
});
