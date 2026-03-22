import { describe, it } from "node:test";
import assert from "node:assert";
import * as XLSX from "xlsx";
import { buildImportVerification, buildSheathCreateInput, parseImportFile } from "./project-import.js";

function workbookBufferFromSheets(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("project-import", () => {
  it("builds combined verification for map and fiber sheets", () => {
    const buffer = workbookBufferFromSheets([
      ["Map", [
        ["START ENCLOSURE", "END ENCLOSURE"],
        ["A", "B"],
      ]],
      ["Fiber", [
        ["SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION", "WAVELENGTH", "DEVICE NAME", "PORT NAME"],
        ["12CT A-B", "A", "B", "BL", "OR", "FUSION", "1550.10", "OLT-1", "PON-1"],
        ["12CT A-B", "A", "B", "BL", "GR", "X", "", "", ""],
      ]],
    ]);

    const parsed = parseImportFile(buffer, "fiber-import.xlsx");
    const verification = buildImportVerification(parsed);

    assert.strictEqual(verification.fileType, "excel");
    assert.strictEqual(verification.readyToImport, true);
    assert.strictEqual(verification.map.polesCount, 2);
    assert.strictEqual(verification.map.segmentsCount, 1);
    assert.strictEqual(verification.fiber.recordCount, 2);
    assert.strictEqual(verification.fiber.summary.activeCount, 1);
    assert.strictEqual(verification.fiber.summary.darkCount, 1);
    assert.deepStrictEqual(verification.fiber.sheetsUsed, ["Fiber"]);
    assert.strictEqual(verification.fiber.visitPlan.visits.length, 2);
  });

  it("throws when workbook has no supported map or fiber columns", () => {
    const buffer = workbookBufferFromSheets([
      ["Notes", [
        ["Instructions"],
        ["Nothing to import"],
      ]],
    ]);

    assert.throws(
      () => parseImportFile(buffer, "notes.xlsx"),
      /No supported map or fiber data found/
    );
  });

  it("warns when the file contains fiber data but no map geometry", () => {
    const buffer = workbookBufferFromSheets([
      ["Fiber", [
        ["SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION"],
        ["12CT A-B", "A", "B", "BL", "OR", "FUSION"],
      ]],
    ]);

    const parsed = parseImportFile(buffer, "fiber-only.xlsx");
    const verification = buildImportVerification(parsed);

    assert.strictEqual(verification.map.present, false);
    assert.strictEqual(verification.fiber.present, true);
    assert.ok(
      verification.warnings.some((warning) => warning.includes("No map geometry found"))
    );
  });

  it("preserves endpoint-level observations and only creates meaningful assignments", () => {
    const poleMap = new Map([
      ["A", { id: "pole-a", poleNumber: "A" }],
      ["B", { id: "pole-b", poleNumber: "B" }],
    ]);
    const sheathInput = buildSheathCreateInput(
      "project-1",
      "48CT A TO B",
      [
        {
          sheathName: "48CT A TO B",
          startEnclosure: "A",
          endEnclosure: "B",
          bufferColor: "BLUE",
          fiberColor: "SLATE",
          bufferIndex: 0,
          fiberIndex: 4,
          direction: null,
          rawConnection: "<- FUSION ->",
          connectionType: "FUSION",
          wavelength: null,
          deviceName: "B",
          portName: "PORT1",
        },
        {
          sheathName: "48CT A TO B",
          startEnclosure: "A",
          endEnclosure: "B",
          bufferColor: "BLUE",
          fiberColor: "GREEN",
          bufferIndex: 0,
          fiberIndex: 2,
          direction: null,
          rawConnection: "X",
          connectionType: "DARK",
          wavelength: null,
          deviceName: null,
          portName: null,
        },
      ],
      poleMap
    );

    const slateFiber = sheathInput.data.fiberRecords.create.find((fiber) => fiber.fiberColor === "SLATE");
    const greenFiber = sheathInput.data.fiberRecords.create.find((fiber) => fiber.fiberColor === "GREEN");
    assert.strictEqual(slateFiber.assignments.create.length, 1);
    assert.strictEqual(slateFiber.assignments.create[0].deviceName, "B");
    assert.strictEqual(slateFiber.endpointObservations.create.length, 2);
    assert.strictEqual(
      slateFiber.endpointObservations.create.find((observation) => observation.poleId === "pole-b").state,
      "NEEDS_FUSION"
    );
    assert.ok(!greenFiber.assignments);
    assert.strictEqual(greenFiber.endpointObservations.create.length, 2);
    assert.strictEqual(
      greenFiber.endpointObservations.create.every((observation) => observation.state === "DARK"),
      true
    );
  });
});
