import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";
import { parsePrismBuffer } from "../services/prism-parser.js";
import { parseExcelBuffer } from "../services/excel-parser.js";
import { Storage } from "@google-cloud/storage";

const storage = new Storage();

const EXCEL_EXT = /\.(xlsx|xls)$/i;
const ZIP_EXT = /\.zip$/i;

function parseImportBuffer(buffer, filePath) {
  const lower = filePath.toLowerCase();
  if (EXCEL_EXT.test(lower)) {
    const result = parseExcelBuffer(buffer);
    return { ...result, warnings: result.warnings || [] };
  }
  if (ZIP_EXT.test(lower)) {
    const result = parsePrismBuffer(buffer);
    return { poles: result.poles, rawSegments: result.rawSegments, metadata: result.metadata, warnings: [] };
  }
  throw new Error("Unsupported file format. Use .xlsx, .xls, or .zip");
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

  importFromGcs: protectedProcedure
    .input(
      z.object({
        filePath: z.string(),
        prismId: z.string(),
        name: z.string(),
        node: z.string(),
        instance: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const bucket = storage.bucket(process.env.GCS_BUCKET_IMPORTS);
      const file = bucket.file(input.filePath);
      const [buffer] = await file.download();
      const parsed = parseImportBuffer(buffer, input.filePath);

      const project = await prisma.project.create({
        data: {
          prismId: input.prismId,
          name: input.name,
          node: input.node,
          instance: input.instance || "DEFAULT",
          status: "ACTIVE",
          totalPassings: parsed.poles.length,
          sourceFilePath: input.filePath,
          createdById: ctx.user.id,
        },
      });

      const poleMap = {};
      for (const p of parsed.poles) {
        const pole = await prisma.pole.create({
          data: {
            poleNumber: p.poleNumber,
            streetName: p.streetName || null,
            lat: p.lat ?? 0,
            lng: p.lng ?? 0,
            projectId: project.id,
          },
        });
        poleMap[p.poleNumber] = pole;
      }

      let segmentsCreated = 0;
      for (const seg of parsed.rawSegments) {
        const fromPole = poleMap[seg.from];
        const toPole = poleMap[seg.to];
        if (fromPole && toPole) {
          await prisma.fiberSegment.create({
            data: {
              lengthFt: seg.lengthFt,
              projectId: project.id,
              fromPoleId: fromPole.id,
              toPoleId: toPole.id,
            },
          });
          segmentsCreated++;
        }
      }

      return {
        project,
        summary: {
          polesCreated: parsed.poles.length,
          segmentsCreated,
          skippedRows: parsed.metadata?.rowCount != null ? parsed.metadata.rowCount - parsed.poles.length - segmentsCreated : undefined,
        },
        warnings: parsed.warnings || [],
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.project.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
