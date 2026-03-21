import { describe, it } from "node:test";
import assert from "node:assert";
import * as XLSX from "xlsx";
import { parseExcelBuffer } from "./excel-parser.js";

function excelBufferFromRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("excel-parser", () => {
  it("parses splice report format (START ENCLOSURE, END ENCLOSURE)", () => {
    const buf = excelBufferFromRows([
      ["SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER"],
      ["ANTPOWER2_SC_038_TO_2303E", "2303E", "ANTPOWER2_SC_038", "BL", "01"],
      ["ANTPOWER2_SC_038_TO_2303E", "ANTPOWER2_SC_038", "2303E", "BL", "02"],
    ]);
    const result = parseExcelBuffer(buf);
    assert.strictEqual(result.poles.length, 2);
    assert.ok(result.poles.some((p) => p.poleNumber === "2303E"));
    assert.ok(result.poles.some((p) => p.poleNumber === "ANTPOWER2_SC_038"));
    assert.strictEqual(result.rawSegments.length, 2);
    assert.ok(result.rawSegments.some((s) => s.from === "2303E" && s.to === "ANTPOWER2_SC_038"));
    assert.ok(result.rawSegments.some((s) => s.from === "ANTPOWER2_SC_038" && s.to === "2303E"));
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
      /Could not find required columns/
    );
  });

  it("throws when sheet has no data rows", () => {
    const buf = excelBufferFromRows([["HEADER"]]);
    assert.throws(
      () => parseExcelBuffer(buf),
      /no data rows/
    );
  });
});
