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

  it("parses full color names PINK ROSE VIOLET (Excel), not only 2-letter codes", () => {
    const rows = [
      ["BUFFER", "FIBER", "CONNECTION"],
      ["ORANGE", "PINK", "DARK"],
      ["ORANGE", "ROSE", "DARK"],
      ["ORANGE", "VIOLET", "DARK"],
    ];
    const { records } = parseFiberRows(rows);
    assert.strictEqual(records.length, 3);
    assert.strictEqual(records[0].fiberColor, "PINK");
    assert.strictEqual(records[1].fiberColor, "PINK");
    assert.strictEqual(records[2].fiberColor, "VIOLET");
  });

  it("parses PI as the pink/rose fiber code used in some sheets", () => {
    const rows = [
      ["SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION"],
      ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "PI", "<- FUSION ->"],
      ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "PI", "AQ", "<- FUSION ->"],
    ];
    const { records } = parseFiberRows(rows);
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].bufferColor, "BLUE");
    assert.strictEqual(records[0].fiberColor, "PINK");
    assert.strictEqual(records[1].bufferColor, "PINK");
    assert.strictEqual(records[1].fiberColor, "AQUA");
  });

  it("treats N/A-like placeholders as empty assignment fields", () => {
    const rows = [
      ["SHEATH NAME", "START ENCLOSURE", "END ENCLOSURE", "BUFFER", "FIBER", "CONNECTION", "DEVICE NAME", "PORT NAME"],
      ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "BK", "<- CONTINUOUS ->", "N/A", "N/A"],
      ["48CT 2302E_SE_006 TO 2302E_FT_068", "2302E_SE_006", "2302E_FT_068", "BL", "YE", "<- CONTINUOUS ->", "NA", "-"],
    ];
    const { records } = parseFiberRows(rows);
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].deviceName, null);
    assert.strictEqual(records[0].portName, null);
    assert.strictEqual(records[1].deviceName, null);
    assert.strictEqual(records[1].portName, null);
    assert.strictEqual(records[0].connectionType, "DARK");
    assert.strictEqual(records[1].connectionType, "DARK");
  });

  it("does not treat DEVICE UUID / REPORT columns as assignment demand", () => {
    const rows = [
      [
        "SHEATH UUID",
        "SHEATH NAME",
        "START ENCLOSURE",
        "END ENCLOSURE",
        "BUFFER",
        "FIBER",
        "SUB-CIRCUIT",
        "WAVELENGTH",
        "CIRCUIT",
        "CONNECTION",
        "DEVICE UUID",
        "REPORT DATE",
      ],
      [
        "d9cec964-551e-4286-a480-ad0e43a6aefe",
        "2302E_SE_006_TO_2302E_FT_068_48CT",
        "2302E_SE_006",
        "2302E_FT_068",
        "BL",
        "BK",
        "N/A",
        "N/A",
        "N/A",
        "<- CONTINUOUS ->",
        "f4124ddd-65fb-45c9-b9df-0ae6fc9a92fe",
        "2/26/2025",
      ],
    ];

    const { records } = parseFiberRows(rows);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].bufferColor, "BLUE");
    assert.strictEqual(records[0].fiberColor, "BLACK");
    assert.strictEqual(records[0].connectionType, "DARK");
    assert.strictEqual(records[0].deviceName, null);
    assert.strictEqual(records[0].portName, null);
  });

  it("parses MECHANICAL continuity as distinct from fusion", () => {
    const rows = [
      ["BUFFER", "FIBER", "CONNECTION", "WAVELENGTH"],
      ["BL", "OR", "<- MECHANICAL ->", "0"],
      ["BL", "GR", "<- FUSION ->", ""],
    ];
    const { records } = parseFiberRows(rows);
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].connectionType, "MECHANICAL");
    assert.strictEqual(records[0].wavelength, null);
    assert.strictEqual(records[1].connectionType, "FUSION");
    const summary = computeAssignmentSummary(records);
    assert.strictEqual(summary.mechanicalCount, 1);
    assert.strictEqual(summary.activeCount, 1);
    assert.strictEqual(summary.darkCount, 1);
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
