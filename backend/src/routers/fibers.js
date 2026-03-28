import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import {
  parseFiberRows,
  computeAssignmentSummary,
  buildVisitPlan,
  getFiberColorSequence,
} from "../services/fiber-assignment-engine.js";
import { extractFiberRowsFromExcel } from "../services/excel-parser.js";
import { downloadImportBuffer } from "../services/import-buffer-loader.js";

export const fibersRouter = router({
  getColorSequence: protectedProcedure.query(() => getFiberColorSequence()),

  computeAssignment: protectedProcedure
    .input(
      z.object({
        rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
      })
    )
    .mutation(({ input }) => {
      const normalized = input.rows.map((row) =>
        row.map((c) => (c == null ? "" : String(c)))
      );
      const { records, warnings } = parseFiberRows(normalized);
      const summary = computeAssignmentSummary(records);
      const visitPlan = buildVisitPlan(records);
      return {
        records,
        summary: {
          bySheath: summary.bySheath,
          activeCount: summary.activeCount,
          darkCount: summary.darkCount,
          mechanicalCount: summary.mechanicalCount,
          inconsistencies: summary.inconsistencies,
          totalFiberColors: summary.totalFiberColors,
        },
        visitPlan,
        warnings,
      };
    }),

  computeFromExcel: protectedProcedure
    .input(z.object({ filePath: z.string() }))
    .mutation(async ({ input }) => {
      const buffer = await downloadImportBuffer(input.filePath);
      const { rows, sheetsUsed } = extractFiberRowsFromExcel(buffer);
      if (rows.length < 2) {
        return {
          error: "No fiber data found. Sheets need BUFFER and FIBER columns.",
          sheetsUsed: [],
        };
      }
      const normalized = rows.map((row) =>
        row.map((c) => (c == null ? "" : String(c)))
      );
      const { records, warnings } = parseFiberRows(normalized);
      const summary = computeAssignmentSummary(records);
      const visitPlan = buildVisitPlan(records);
      return {
        records,
        summary: {
          bySheath: summary.bySheath,
          activeCount: summary.activeCount,
          darkCount: summary.darkCount,
          mechanicalCount: summary.mechanicalCount,
          inconsistencies: summary.inconsistencies,
          totalFiberColors: summary.totalFiberColors,
        },
        visitPlan,
        warnings,
        sheetsUsed,
      };
    }),
});
