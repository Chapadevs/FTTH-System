import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";
import { buildPoleDetail } from "../services/pole-detail.js";

export const mapRouter = router({
  getData: publicProcedure
    .input(
      z
        .object({ projectIds: z.array(z.string()).optional() })
        .optional()
    )
    .query(async ({ input }) => {
      const projectIds = input?.projectIds;
      const where =
        projectIds && projectIds.length > 0
          ? { projectId: { in: projectIds } }
          : {};

      const [poles, equipment, segments] = await Promise.all([
        prisma.pole.findMany({
          where,
          include: {
            equipment: true,
            sheathEndpoints: {
              include: {
                sheath: {
                  include: {
                    endpoints: {
                      include: {
                        pole: {
                          select: {
                            id: true,
                            poleNumber: true,
                          },
                        },
                      },
                    },
                    fiberRecords: {
                      include: {
                        assignments: {
                          select: {
                            id: true,
                            deviceName: true,
                            portName: true,
                            status: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.equipment.findMany({
          where,
          include: { pole: true },
        }),
        prisma.fiberSegment.findMany({
          where,
          include: { fromPole: true, toPole: true },
        }),
      ]);

      return {
        poles: poles.map((pole) => {
          const detail = buildPoleDetail(pole);

          return {
            id: pole.id,
            poleNumber: pole.poleNumber,
            streetName: pole.streetName,
            status: pole.status,
            lat: pole.lat,
            lng: pole.lng,
            projectId: pole.projectId,
            summary: detail.summary,
            work: detail.work,
          };
        }),
        equipment,
        segments,
      };
    }),
});
