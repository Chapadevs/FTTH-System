import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseFiberRows,
  computeAssignmentSummary,
  buildVisitPlan,
  getFiberColorSequence,
} from "./fiber-assignment-engine.js";

describe("fiber-assignment-engine", () => {
  it("returns 12 fiber colors in standard order", () => {
    const seq = getFiberColorSequence();
    assert.strictEqual(seq.length, 12);
    assert.strictEqual(seq[0], "BLUE");
    assert.strictEqual(seq[11], "AQUA");
  });

  it("parses fiber rows with buffer and fiber color codes", () => {
    const rows = [
      ["SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION", "WAVELENGTH"],
      ["12CT A TO B", "A", "B", "BL", "OR", "<- FUSION ->", "1550.61"],
      ["12CT A TO B", "A", "B", "BL", "GR", "X", ""],
    ];
    const { records } = parseFiberRows(rows);
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].bufferColor, "BLUE");
    assert.strictEqual(records[0].fiberColor, "ORANGE");
    assert.strictEqual(records[0].connectionType, "FUSION");
    assert.strictEqual(records[1].connectionType, "DARK");
  });

  it("classifies active and dark fibers and detects inconsistencies", () => {
    const rows = [
      ["BUFFER", "FIBER", "CONNECTION", "WAVELENGTH"],
      ["BL", "OR", "FUSION", "1550"],
      ["BL", "GR", "X", "1551"],
      ["BL", "BR", "FUSION", ""],
    ];
    const { records } = parseFiberRows(rows);
    const summary = computeAssignmentSummary(records);
    assert.strictEqual(summary.activeCount, 2);
    assert.strictEqual(summary.darkCount, 1);
    assert.ok(summary.inconsistencies.some((i) => i.type === "WAVELENGTH_WITHOUT_FUSION"));
    assert.ok(summary.inconsistencies.some((i) => i.type === "FUSION_WITHOUT_WAVELENGTH"));
  });

  it("builds ordered visit plan from fused fibers", () => {
    const rows = [
      ["SHEATH", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION", "DEVICE NAME"],
      ["12CT", "2302E", "MVC23T137", "BL", "OR", "FUSION", "2302E_SFP1"],
      ["12CT", "2302E", "MVC23T137", "BL", "GR", "FUSION", "2302E_SFP2"],
    ];
    const { records } = parseFiberRows(rows);
    const plan = buildVisitPlan(records);
    assert.strictEqual(plan.visits.length, 2);
    const locs = plan.visits.map((v) => v.location).sort();
    assert.deepStrictEqual(locs, ["2302E", "MVC23T137"]);
    const visit2302 = plan.visits.find((v) => v.location === "2302E");
    assert.strictEqual(visit2302.actions.length, 2);
  });
});
