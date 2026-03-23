import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";
import { hasRenderableCoordinates } from "../lib/geo.js";
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
                        endpointObservations: true,
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
        poles: poles
          .filter((pole) => hasRenderableCoordinates(pole.lat, pole.lng))
          .map((pole) => {
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
        segments: segments.filter(
          (seg) =>
            hasRenderableCoordinates(seg.fromPole.lat, seg.fromPole.lng) &&
            hasRenderableCoordinates(seg.toPole.lat, seg.toPole.lng)
        ),
      };
    }),
});
