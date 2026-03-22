import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";
import { getImportableSheetNames, previewExcelSheet } from "../services/excel-parser.js";
import { downloadImportBuffer } from "../services/import-buffer-loader.js";
import {
  buildImportVerification,
  parseImportFile,
  persistParsedImport,
} from "../services/project-import.js";
import { enrichProjectPoleStreetNames } from "../services/reverse-geocode.js";

const EXCEL_EXT = /\.(xlsx|xls)$/i;
const ZIP_EXT = /\.zip$/i;

export const projectsRouter = router({
  list: publicProcedure.query(async () => {
    return prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true, email: true } } },
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return prisma.project.findUnique({
        where: { id: input.id },
        include: {
          poles: true,
          equipment: { include: { pole: true } },
          segments: { include: { fromPole: true, toPole: true } },
          createdBy: { select: { name: true, email: true } },
        },
      });
    }),

  previewImportFile: protectedProcedure
    .input(z.object({ filePath: z.string() }))
    .query(async ({ input }) => {
      const buffer = await downloadImportBuffer(input.filePath);
      const lower = input.filePath.toLowerCase();
      if (EXCEL_EXT.test(lower)) {
        const sheetNames = getImportableSheetNames(buffer);
        const sheets = sheetNames.map((name) => {
          const preview = previewExcelSheet(buffer, name);
          return { name, ...preview };
        });
        return { type: "excel", sheets };
      }
      if (ZIP_EXT.test(lower)) {
        return { type: "zip", sheets: [{ name: "prism", valid: true, rowCount: null, warnings: [], hasFromTo: false, hasPoleOnly: true }] };
      }
      throw new Error("Unsupported file format. Use .xlsx, .xls, or .zip");
    }),

  verifyImport: protectedProcedure
    .input(
      z.object({
        filePath: z.string(),
        selectedSheets: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const buffer = await downloadImportBuffer(input.filePath);
      const parsed = parseImportFile(buffer, input.filePath, {
        selectedSheets: input.selectedSheets,
      });
      return buildImportVerification(parsed);
    }),

  importFromGcs: protectedProcedure
    .input(
      z.object({
        filePath: z.string(),
        prismId: z.string(),
        name: z.string(),
        node: z.string(),
        instance: z.string().optional(),
        selectedSheets: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = await downloadImportBuffer(input.filePath);
      const parsed = parseImportFile(buffer, input.filePath, {
        selectedSheets: input.selectedSheets,
      });
      const verification = buildImportVerification(parsed);

      const result = await prisma.$transaction(
        (tx) => persistParsedImport(tx, input, ctx.user.id, parsed, verification),
        {
          maxWait: 10_000,
          timeout: 60_000,
        }
      );

      void enrichProjectPoleStreetNames(prisma, result.project.id).catch((error) => {
        console.warn("Street enrichment failed for project", result.project.id, error?.message || error);
      });

      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.project.delete({ where: { id: input.id } });
      return { success: true };
    }),

  deleteAll: protectedProcedure.mutation(async () => {
    await prisma.project.deleteMany();
    return { success: true };
  }),
});
