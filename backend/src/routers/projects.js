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
import { hasRenderableCoordinates } from "../lib/geo.js";

const EXCEL_EXT = /\.(xlsx|xls)$/i;
const ZIP_EXT = /\.zip$/i;

async function deleteProjectGraph(tx, projectId) {
  await tx.fiberAssignment.deleteMany({
    where: {
      OR: [
        { equipment: { projectId } },
        { fiberRecord: { sheath: { projectId } } },
      ],
    },
  });

  await tx.fiberEndpointObservation.deleteMany({
    where: {
      OR: [
        { pole: { projectId } },
        { fiberRecord: { sheath: { projectId } } },
      ],
    },
  });

  await tx.fiberRecord.deleteMany({ where: { sheath: { projectId } } });

  await tx.sheathEndpoint.deleteMany({
    where: {
      OR: [{ pole: { projectId } }, { sheath: { projectId } }],
    },
  });

  await tx.sheath.deleteMany({ where: { projectId } });
  await tx.equipment.deleteMany({ where: { projectId } });
  await tx.fiberSegment.deleteMany({ where: { projectId } });
  await tx.pole.deleteMany({ where: { projectId } });
}

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

  /** Bounding box of poles with valid coordinates; used to focus the map on a project. */
  getMapBounds: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const poles = await prisma.pole.findMany({
        where: { projectId: input.projectId },
        select: { lat: true, lng: true },
      });
      const valid = poles.filter((p) =>
        hasRenderableCoordinates(parseFloat(p.lat), parseFloat(p.lng))
      );
      if (valid.length === 0) return null;

      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const p of valid) {
        const lat = parseFloat(p.lat);
        const lng = parseFloat(p.lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }

      return { minLat, maxLat, minLng, maxLng };
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
          timeout: 180_000,
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
      await prisma.$transaction(async (tx) => {
        await deleteProjectGraph(tx, input.id);
        await tx.project.delete({ where: { id: input.id } });
      });
      return { success: true };
    }),

  deleteAll: protectedProcedure.mutation(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.fiberAssignment.deleteMany();
      await tx.fiberEndpointObservation.deleteMany();
      await tx.fiberRecord.deleteMany();
      await tx.sheathEndpoint.deleteMany();
      await tx.sheath.deleteMany();
      await tx.equipment.deleteMany();
      await tx.fiberSegment.deleteMany();
      await tx.pole.deleteMany();
      await tx.project.deleteMany();
    });
    return { success: true };
  }),
});
