import { describe, it } from "node:test";
import assert from "node:assert";
import * as XLSX from "xlsx";
import { downloadImportBuffer } from "./import-buffer-loader.js";
import { saveLocalImportBuffer } from "./local-import-storage.js";
import { extractFiberRowsFromExcel } from "./excel-parser.js";
import { parseFiberRows, computeAssignmentSummary } from "./fiber-assignment-engine.js";

describe("import-buffer-loader", () => {
  it("loads buffer from local import path", async () => {
    const original = Buffer.from("test excel content");
    const filePath = await saveLocalImportBuffer(original, "test.xlsx");
    assert.ok(filePath.startsWith("local-imports/"));
    const loaded = await downloadImportBuffer(filePath);
    assert.ok(Buffer.isBuffer(loaded));
    assert.strictEqual(loaded.toString(), original.toString());
  });

  it("supports fiber flow via filePath (no base64)", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["SHEATH", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION"],
      ["12CT", "2302E", "MVC23", "BL", "OR", "FUSION"],
      ["12CT", "2302E", "MVC23", "BL", "GR", "X"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FiberData");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filePath = await saveLocalImportBuffer(buf, "fiber-test.xlsx");
    const buffer = await downloadImportBuffer(filePath);
    const { rows, sheetsUsed } = extractFiberRowsFromExcel(buffer);
    assert.strictEqual(sheetsUsed.length, 1);
    assert.ok(rows.length >= 2);
    const { records } = parseFiberRows(rows);
    const summary = computeAssignmentSummary(records);
    assert.strictEqual(summary.activeCount, 1);
    assert.strictEqual(summary.darkCount, 1);
  });
});
