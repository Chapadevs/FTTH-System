import { describe, it } from "node:test";
import assert from "node:assert";
import * as XLSX from "xlsx";
import { parseExcelBuffer, extractFiberRowsFromExcel, getImportableSheetNames, previewExcelSheet } from "./excel-parser.js";

function excelBufferFromRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("excel-parser", () => {
  it("parses map-style start/end enclosure sheets without fiber columns", () => {
    const buf = excelBufferFromRows([
      ["START ENCLOSURE", "END ENCLOSURE", "LAT", "LNG"],
      ["2303E", "ANTPOWER2_SC_038", "39.10", "-82.30"],
      ["ANTPOWER2_SC_038", "2303E", "39.10", "-82.30"],
    ]);
    const result = parseExcelBuffer(buf);
    assert.strictEqual(result.poles.length, 2);
    assert.ok(result.poles.some((p) => p.poleNumber === "2303E"));
    assert.ok(result.poles.some((p) => p.poleNumber === "ANTPOWER2_SC_038"));
    assert.strictEqual(result.rawSegments.length, 1);
    assert.ok(result.rawSegments.some((s) => (s.from === "2303E" && s.to === "ANTPOWER2_SC_038") || (s.from === "ANTPOWER2_SC_038" && s.to === "2303E")));
  });

  it("parses from_pole / to_pole header variants", () => {
    const buf = excelBufferFromRows([
      ["from_pole", "to_pole", "length_ft"],
      ["P001", "P002", "150"],
      ["P002", "P003", "200"],
    ]);
    const result = parseExcelBuffer(buf);
    assert.strictEqual(result.poles.length, 3);
    assert.strictEqual(result.rawSegments.length, 2);
    assert.strictEqual(result.rawSegments[0].lengthFt, 150);
    assert.strictEqual(result.rawSegments[1].lengthFt, 200);
  });

  it("parses pole-only format", () => {
    const buf = excelBufferFromRows([
      ["pole", "street_name"],
      ["12345", "Main St"],
      ["12346", "Oak Ave"],
    ]);
    const result = parseExcelBuffer(buf);
    assert.strictEqual(result.poles.length, 2);
    assert.strictEqual(result.rawSegments.length, 0);
    assert.strictEqual(result.poles[0].poleNumber, "12345");
    assert.strictEqual(result.poles[0].streetName, "Main St");
  });

  it("deduplicates segments", () => {
    const buf = excelBufferFromRows([
      ["START ENCLOSURE", "END ENCLOSURE"],
      ["A", "B"],
      ["A", "B"],
      ["A", "B"],
    ]);
    const result = parseExcelBuffer(buf);
    assert.strictEqual(result.rawSegments.length, 1);
    assert.strictEqual(result.poles.length, 2);
  });

  it("skips rows with missing from/to and reports warnings", () => {
    const buf = excelBufferFromRows([
      ["START ENCLOSURE", "END ENCLOSURE"],
      ["A", "B"],
      ["", "C"],
      ["D", ""],
      ["X", "Y"],
    ]);
    const result = parseExcelBuffer(buf);
    assert.strictEqual(result.poles.length, 4);
    assert.strictEqual(result.rawSegments.length, 2);
    assert.ok(result.warnings.some((w) => w.includes("skipped")));
  });

  it("throws when required columns are missing", () => {
    const buf = excelBufferFromRows([
      ["FOO", "BAR", "BAZ"],
      ["a", "b", "c"],
    ]);
    assert.throws(
      () => parseExcelBuffer(buf),
      /No valid poles or enclosures|skipped \(missing/
    );
  });

  it("throws when sheet has no data rows", () => {
    const buf = excelBufferFromRows([["HEADER"]]);
    assert.throws(
      () => parseExcelBuffer(buf),
      /no data rows|No valid poles/
    );
  });

  it("extracts fiber rows from sheets with BUFFER+FIBER, skips others", () => {
    const wsPole = XLSX.utils.aoa_to_sheet([
      ["START ENCLOSURE", "END ENCLOSURE"],
      ["A", "B"],
    ]);
    const wsFiber = XLSX.utils.aoa_to_sheet([
      ["SHEATH", "BUFFER", "FIBER", "CONNECTION"],
      ["12CT", "BL", "OR", "FUSION"],
      ["12CT", "BL", "GR", "X"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsPole, "Poles");
    XLSX.utils.book_append_sheet(wb, wsFiber, "FiberData");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const { rows, sheetsUsed } = extractFiberRowsFromExcel(buf);
    assert.strictEqual(sheetsUsed.length, 1);
    assert.strictEqual(sheetsUsed[0], "FiberData");
    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(rows[0], ["SHEATH", "BUFFER", "FIBER", "CONNECTION"]);
  });

  it("lists and parses selected sheets only", () => {
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["START ENCLOSURE", "END ENCLOSURE"],
      ["A", "B"],
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["START ENCLOSURE", "END ENCLOSURE"],
      ["C", "D"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Sheet1");
    XLSX.utils.book_append_sheet(wb, ws2, "Sheet2");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const result = parseExcelBuffer(buf, { sheetNames: ["Sheet1"] });
    assert.strictEqual(result.poles.length, 2);
    assert.ok(result.poles.some((p) => p.poleNumber === "A"));
    assert.ok(result.poles.some((p) => p.poleNumber === "B"));
    assert.strictEqual(result.metadata?.ignoredSheets?.includes("Sheet2"), true);
  });

  it("includes all sheets; validates by column presence", () => {
    const wsData = XLSX.utils.aoa_to_sheet([
      ["START ENCLOSURE", "END ENCLOSURE"],
      ["A", "B"],
    ]);
    const wsInstr = XLSX.utils.aoa_to_sheet([["How to use"], ["Step 1"], ["Step 2"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, "Data");
    XLSX.utils.book_append_sheet(wb, wsInstr, "INSTRUCTIONS");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const importable = getImportableSheetNames(buf);
    assert.strictEqual(importable.includes("INSTRUCTIONS"), true);
    assert.strictEqual(importable.includes("Data"), true);
    const preview = previewExcelSheet(buf, "INSTRUCTIONS");
    assert.strictEqual(preview.valid, false);
    assert.ok(preview.warnings?.some((w) => w.includes("Missing required columns") || w.includes("from") || w.includes("pole")));
    const result = parseExcelBuffer(buf);
    assert.strictEqual(result.poles.length, 2);
  });

  it("does not treat fiber export sheets as map sheets", () => {
    const buf = excelBufferFromRows([
      ["SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION"],
      ["12CT A-B", "A", "B", "BL", "OR", "FUSION"],
    ]);

    const preview = previewExcelSheet(buf, "Sheet1");
    assert.strictEqual(preview.valid, false);
    assert.ok(preview.warnings.some((w) => w.includes("Fiber export detected")));
    assert.throws(
      () => parseExcelBuffer(buf),
      /No valid poles or enclosures/
    );
  });

  it("parses enclosure workbook sheets with location metadata", () => {
    const buf = excelBufferFromRows([
      ["ENCLOSURE NAME", "2302E"],
      ["ENCLOSURE LOCATION", "39.45983,-82.07542"],
      [],
      ["SHEATH UUID", "SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER"],
      ["uuid-1", "12CT MWC23T137 TO 2302E", "2302E", "MWC23T137", "BL", "OR"],
    ]);

    const preview = previewExcelSheet(buf, "Sheet1");
    assert.strictEqual(preview.valid, true);

    const result = parseExcelBuffer(buf);
    assert.ok(result.poles.some((p) => p.poleNumber === "2302E" && p.lat === 39.45983 && p.lng === -82.07542));
    assert.ok(result.poles.some((p) => p.poleNumber === "MWC23T137"));
    assert.strictEqual(result.rawSegments.length, 1);
  });

  it("extracts fiber rows from enclosure workbook sheets with delayed headers", () => {
    const buf = excelBufferFromRows([
      ["ENCLOSURE NAME", "2302E"],
      ["ENCLOSURE LOCATION", "39.45983,-82.07542"],
      [],
      ["SHEATH UUID", "SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION"],
      ["uuid-1", "12CT MWC23T137 TO 2302E", "2302E", "MWC23T137", "BL", "OR", "FUSION"],
      ["uuid-1", "12CT MWC23T137 TO 2302E", "2302E", "MWC23T137", "BL", "GR", "X"],
    ]);

    const { rows, sheetsUsed } = extractFiberRowsFromExcel(buf);
    assert.deepStrictEqual(sheetsUsed, ["Sheet1"]);
    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(rows[0], ["SHEATH UUID", "SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION"]);
  });
});
