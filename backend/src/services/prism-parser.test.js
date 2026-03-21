import { describe, it } from "node:test";
import assert from "node:assert";
import AdmZip from "adm-zip";
import { parsePrismBuffer } from "./prism-parser.js";

function zipBufferWithTxtFiles(entries) {
  const zip = new AdmZip();
  for (const [name, content] of entries) {
    zip.addFile(name, Buffer.from(content, "utf8"));
  }
  return zip.toBuffer();
}

describe("prism-parser", () => {
  it("extracts poles from 5-digit numbers", () => {
    const buf = zipBufferWithTxtFiles([
      ["page1.txt", "12345 Main Street\n12346 Oak Road"],
    ]);
    const result = parsePrismBuffer(buf);
    assert.strictEqual(result.poles.length, 2);
    assert.ok(result.poles.some((p) => p.poleNumber === "12345" && p.streetName === "12345 Main Street"));
    assert.ok(result.poles.some((p) => p.poleNumber === "12346" && p.streetName === "12346 Oak Road"));
  });

  it("extracts segments with feet", () => {
    const buf = zipBufferWithTxtFiles([
      ["page1.txt", "Main Street\n12345 12346 150'"],
    ]);
    const result = parsePrismBuffer(buf);
    assert.strictEqual(result.rawSegments.length, 1);
    assert.strictEqual(result.rawSegments[0].from, "12345");
    assert.strictEqual(result.rawSegments[0].to, "12346");
    assert.strictEqual(result.rawSegments[0].lengthFt, 150);
  });

  it("ignores non-txt entries", () => {
    const buf = zipBufferWithTxtFiles([
      ["data.csv", "12345,12346"],
      ["page.txt", "12345 Main St"],
    ]);
    const result = parsePrismBuffer(buf);
    assert.strictEqual(result.poles.length, 1);
    assert.strictEqual(result.poles[0].poleNumber, "12345");
  });

  it("returns metadata with pageCount", () => {
    const buf = zipBufferWithTxtFiles([
      ["a.txt", "12345"],
      ["b.txt", "12346"],
    ]);
    const result = parsePrismBuffer(buf);
    assert.strictEqual(result.metadata.pageCount, 2);
  });
});
