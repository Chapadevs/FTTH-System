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

  it("preserves PI rows as pink fibers during workbook import", () => {
    const buffer = workbookBufferFromSheets([
      ["Map", [
        ["START ENCLOSURE", "END ENCLOSURE"],
        ["2302E_SE_006", "2302E_FT_068"],
      ]],
      ["Fiber", [
        ["SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION", "PORT NAME"],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "PI", "<- FUSION ->", "PORT1"],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "AQ", "<- FUSION ->", "PORT2"],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "OR", "BL", "<- FUSION ->", "PORT3"],
      ]],
    ]);

    const parsed = parseImportFile(buffer, "pink-pi-import.xlsx");
    const verification = buildImportVerification(parsed);
    const fibersByColor = verification.fiber.summary.bySheath["48CT 2302E_SE_006 TO 2302E_FT_068"].fibers
      .map((fiber) => `${fiber.bufferColor}/${fiber.fiberColor}`)
      .sort();

    assert.strictEqual(verification.fiber.recordCount, 3);
    assert.ok(fibersByColor.includes("BLUE/PINK"));
    assert.ok(fibersByColor.includes("BLUE/AQUA"));
    assert.ok(fibersByColor.includes("ORANGE/BLUE"));
  });

  it("flags only actual fusion rows when continuous rows contain N/A placeholders", () => {
    const buffer = workbookBufferFromSheets([
      ["Map", [
        ["START ENCLOSURE", "END ENCLOSURE"],
        ["2302E_SE_006", "2302E_FT_068"],
      ]],
      ["Fiber", [
        [
          "SHEATH NAME",
          "START ENCLOSURE",
          "END ENCLOSURE",
          "BUFFER",
          "FIBER",
          "CONNECTION",
          "WAVELENGTH",
          "DEVICE NAME",
          "PORT NAME",
        ],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "PI", "<- FUSION ->", "", "N/A", "PORT1"],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "AQ", "<- FUSION ->", "", "N/A", "PORT2"],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "OR", "BL", "<- FUSION ->", "", "N/A", "PORT3"],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "BK", "<- CONTINUOUS ->", "", "N/A", "N/A"],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "YE", "<- CONTINUOUS ->", "", "NA", "-"],
        ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "VI", "<- CONTINUOUS ->", "", "N/A", "N/A"],
      ]],
    ]);

    const parsed = parseImportFile(buffer, "fusion-scope-control.xlsx");
    const verification = buildImportVerification(parsed);
    const inconsistencyFibers = verification.fiber.summary.inconsistencies
      .map((issue) => issue.fiber)
      .sort();

    assert.strictEqual(verification.fiber.recordCount, 6);
    assert.strictEqual(verification.fiber.summary.inconsistencies.length, 3);
    assert.deepStrictEqual(
      inconsistencyFibers,
      ["BLUE/AQUA", "BLUE/PINK", "ORANGE/BLUE"]
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
